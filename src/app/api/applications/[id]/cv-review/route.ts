import { NextResponse } from 'next/server';
import { fetchApplicationWorkspace } from '@/lib/api/application-workspace';
import { streamCvReview, type CvReviewStreamEvent } from '@/lib/ai/cv-review';
import { extractDocumentBytes } from '@/lib/ai/document-text';
import { streamDeepSeekText } from '@/lib/ai/vinuni-grounded-evaluation';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const MIN_TEXT_LENGTH = 80;
const MAX_TEXT_LENGTH = 15_000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

async function readCvText(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return { error: 'Vui lòng chọn file CV.', status: 400 };
    if (file.size > MAX_FILE_BYTES) {
      return { error: 'File CV không được vượt quá 5 MB.', status: 413 };
    }
    try {
      const text = await extractDocumentBytes(
        new Uint8Array(await file.arrayBuffer()),
        file.type,
        file.name,
      );
      return text
        ? { text }
        : {
            error: 'Không thể đọc CV. Hãy dùng PDF/DOCX có text hoặc dán nội dung.',
            status: 400,
          };
    } catch {
      return {
        error: 'Không thể đọc CV. Hãy dùng PDF/DOCX có text hoặc dán nội dung.',
        status: 400,
      };
    }
  }

  const body = await request.json().catch(() => ({}));
  return { text: typeof body?.text === 'string' ? body.text.trim() : '' };
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
      { error: `CV không được vượt quá ${MAX_TEXT_LENGTH.toLocaleString('vi-VN')} ký tự.` },
      { status: 413 },
    );
  }
  if (!input.text || input.text.length < MIN_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `CV cần có ít nhất ${MIN_TEXT_LENGTH} ký tự.` },
      { status: 400 },
    );
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI service not configured. Set DEEPSEEK_API_KEY in .env.local.' },
      { status: 500 },
    );
  }
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro';
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
          targetProfile,
          apiKey,
          model,
          stream: streamDeepSeekText,
          signal: abortController.signal,
        })) {
          controller.enqueue(encode(event));
          if (event.type === 'complete') {
            console.info('CV review stream complete', {
              provider: 'deepseek',
              model,
              firstSectionMs: event.timing.firstSectionMs,
              totalMs: event.timing.totalMs,
            });
          }
        }
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error('CV review stream failed', {
          provider: 'deepseek',
          model,
          code: 'STREAM_FAILED',
          message: error instanceof Error ? error.message : String(error),
        });
        controller.enqueue(
          encode({
            type: 'error',
            code: 'STREAM_FAILED',
            missingSections: [],
            message: 'Phân tích CV chưa hoàn tất. Vui lòng thử lại.',
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
