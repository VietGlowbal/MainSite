import { NextResponse } from 'next/server';
import { fetchApplicationWorkspace } from '@/lib/api/application-workspace';
import { streamCvReview, type CvReviewStreamEvent } from '@/lib/ai/cv-review';
import { extractDocumentBytes } from '@/lib/ai/document-text';
import { parseCvPublicTemplate } from '@/lib/ai/cv-builder';
import { streamOpenAIText } from '@/lib/ai/vinuni-grounded-evaluation';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const MIN_TEXT_LENGTH = 80;
const MAX_TEXT_LENGTH = 15_000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

async function readCvText(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const template = parseCvPublicTemplate(formData.get('template'));
    if (!template) return { error: 'Please choose a supported CV format.', status: 400 };
    const file = formData.get('file');
    if (!(file instanceof File)) return { error: 'Please choose a CV file.', status: 400 };
    if (file.size > MAX_FILE_BYTES) {
      return { error: 'The CV file must not exceed 5 MB.', status: 413 };
    }
    try {
      const text = await extractDocumentBytes(
        new Uint8Array(await file.arrayBuffer()),
        file.type,
        file.name,
      );
      return text
        ? { text, template }
        : {
            error: 'Could not read the CV. Use a PDF/DOCX with selectable text, or paste the content instead.',
            status: 400,
          };
    } catch {
      return {
        error: 'Could not read the CV. Use a PDF/DOCX with selectable text, or paste the content instead.',
        status: 400,
      };
    }
  }

  const body = await request.json().catch(() => ({}));
  const template = parseCvPublicTemplate(body?.template);
  return template
    ? { text: typeof body?.text === 'string' ? body.text.trim() : '', template }
    : { error: 'Please choose a supported CV format.', status: 400 };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await fetchApplicationWorkspace(id, user.id);
  if (!workspace) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const input = await readCvText(request);
  if ('error' in input) {
    return NextResponse.json({ error: input.error }, { status: input.status });
  }
  if (input.text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `The CV must not exceed ${MAX_TEXT_LENGTH.toLocaleString('en-US')} characters.` },
      { status: 413 },
    );
  }
  if (!input.text || input.text.length < MIN_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `The CV needs at least ${MIN_TEXT_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI service not configured. Set OPENAI_API_KEY in .env.local.' },
      { status: 500 },
    );
  }
  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  const targetProfile = {
    universityName: workspace.application.universityName,
    programmeName: workspace.application.courseName,
    ...(workspace.application.degreeLevel
      ? { degreeLevel: workspace.application.degreeLevel }
      : {}),
    ...(workspace.application.subject ? { subject: workspace.application.subject } : {}),
    ...(workspace.course?.entryRequirementsSummary
      ? { entryRequirements: workspace.course.entryRequirementsSummary }
      : {}),
  };
  const abortController = new AbortController();
  request.signal.addEventListener('abort', () => abortController.abort(), { once: true });
  const encoder = new TextEncoder();
  const encode = (event: CvReviewStreamEvent) =>
    encoder.encode(`${JSON.stringify(event)}\n`);

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of streamCvReview({
          cvText: input.text,
          template: input.template,
          targetProfile,
          apiKey,
          model,
          stream: streamOpenAIText,
          signal: abortController.signal,
        })) {
          controller.enqueue(encode(event));
          if (event.type === 'complete') {
            console.info('CV review stream complete', {
              provider: 'openai',
              model,
              firstSectionMs: event.timing.firstSectionMs,
              totalMs: event.timing.totalMs,
            });
          }
        }
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error('CV review stream failed', {
          provider: 'openai',
          model,
          code: 'STREAM_FAILED',
          message: error instanceof Error ? error.message : String(error),
        });
        controller.enqueue(
          encode({
            type: 'error',
            code: 'STREAM_FAILED',
            missingSections: [],
            message: 'The CV analysis did not finish. Please try again.',
            retryable: true,
          }),
        );
      } finally {
        if (!abortController.signal.aborted) controller.close();
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
