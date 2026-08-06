import { NextResponse } from 'next/server';
import {
  CvBuilderFormSchema,
  cvBuilderFormErrorMessage,
  streamCvBuilderGeneration,
  validateTargetProfile,
  type CvBuilderStreamEvent,
} from '@/lib/ai/cv-builder';
import {
  isCvBuilderEnabled,
  loadCvBuilderContext,
} from '@/lib/ai/cv-builder-context';
import { streamOpenAIText } from '@/lib/ai/vinuni-grounded-evaluation';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const headers = {
  'Content-Type': 'application/x-ndjson; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
};
const sections = new Set([
  'about_me',
  'education',
  'experience',
  'projects',
  'activities',
  'awards',
  'skills',
  'assessment',
  'layout',
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isCvBuilderEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const context = await loadCvBuilderContext(id, user);
  if (!context) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const payload = await request.json().catch(() => null);
  const form = CvBuilderFormSchema.safeParse(payload?.form);
  if (!form.success) {
    return NextResponse.json(
      { error: cvBuilderFormErrorMessage(form.error) },
      { status: 400 },
    );
  }
  let targetProfile;
  try {
    targetProfile = validateTargetProfile(payload?.targetProfile, context.validSourceRefs);
  } catch {
    return NextResponse.json({ error: 'Invalid Target Profile.' }, { status: 400 });
  }
  const requestedSections = payload?.requestedSections;
  if (
    requestedSections !== undefined &&
    (!Array.isArray(requestedSections) ||
      requestedSections.some((section) => typeof section !== 'string' || !sections.has(section)))
  ) {
    return NextResponse.json({ error: 'Invalid list of sections to generate.' }, { status: 400 });
  }

  if (payload?.mode !== undefined && payload.mode !== 'clarification') {
    return NextResponse.json({ error: 'Invalid CV generation mode.' }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI service not configured. Set OPENAI_API_KEY in .env.local.' },
      { status: 500 },
    );
  }
  const model =
    payload?.mode === 'clarification'
      ? 'gpt-4o-mini'
      : process.env.OPENAI_MODEL || 'gpt-4o';
  const encoder = new TextEncoder();
  const encode = (event: CvBuilderStreamEvent) =>
    encoder.encode(`${JSON.stringify(event)}\n`);
  const abortController = new AbortController();
  request.signal.addEventListener('abort', () => abortController.abort(), { once: true });

  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of streamCvBuilderGeneration({
            form: form.data,
            targetProfile,
            apiKey,
            model,
            requestedSections,
            clarification: payload?.mode === 'clarification',
            stream: streamOpenAIText,
            signal: abortController.signal,
          })) {
            controller.enqueue(encode(event));
            if (event.type === 'complete') {
              console.info('CV builder stream complete', {
                provider: 'openai',
                model,
                firstSectionMs: event.timing.firstSectionMs,
                totalMs: event.timing.totalMs,
              });
            }
          }
        } catch (error) {
          if (!abortController.signal.aborted) {
            const detail = error instanceof Error ? error.message : String(error);
            const missingSections =
              detail
                .match(/^Missing CV builder sections: (.+)$/)?.[1]
                ?.split(',')
                .map((section) => section.trim())
                .filter(Boolean) ?? requestedSections ?? [];
            console.error('CV builder stream failed', {
              provider: 'openai',
              model,
              code: 'STREAM_FAILED',
              message: detail,
            });
            controller.enqueue(
              encode({
                type: 'error',
                code: 'STREAM_FAILED',
                missingSections,
                message: 'Could not finish the CV. Please retry the missing sections.',
                retryable: true,
              }),
            );
          }
        } finally {
          if (!abortController.signal.aborted) controller.close();
        }
      },
      cancel() {
        abortController.abort();
      },
    }),
    { headers },
  );
}
