import { NextResponse } from 'next/server';
import { generateCvTargetProfile } from '@/lib/ai/cv-builder';
import {
  isCvBuilderEnabled,
  loadCvBuilderContext,
} from '@/lib/ai/cv-builder-context';
import { streamDeepSeekText } from '@/lib/ai/vinuni-grounded-evaluation';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const headers = {
  'Content-Type': 'application/x-ndjson; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
};

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

  const payload = await request.json().catch(() => null);
  const careerDirection = payload?.careerDirection;
  if (
    careerDirection !== undefined &&
    (typeof careerDirection !== 'string' || careerDirection.trim().length > 300)
  ) {
    return NextResponse.json({ error: 'Định hướng nghề nghiệp không hợp lệ.' }, { status: 400 });
  }

  const { id } = await params;
  const context = await loadCvBuilderContext(id, user);
  if (!context) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI service not configured. Set DEEPSEEK_API_KEY in .env.local.' },
      { status: 500 },
    );
  }
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro';
  const startedAt = Date.now();
  const encoder = new TextEncoder();
  const encode = (event: unknown) => encoder.encode(`${JSON.stringify(event)}\n`);
  const abortController = new AbortController();
  request.signal.addEventListener('abort', () => abortController.abort(), { once: true });

  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(
          encode({
            type: 'status',
            stage: 'preparing_context',
            message: 'Đang chuẩn bị dữ liệu hồ sơ và chương trình…',
          }),
        );
        controller.enqueue(
          encode({
            type: 'status',
            stage: 'building_target',
            message: 'AI đang xây dựng Target Profile…',
          }),
        );
        try {
          const targetProfile = await generateCvTargetProfile({
            context,
            careerDirection,
            apiKey,
            model,
            stream: streamDeepSeekText,
            signal: abortController.signal,
          });
          controller.enqueue(
            encode({
              type: 'complete',
              targetProfile,
              timing: { totalMs: Date.now() - startedAt },
            }),
          );
        } catch (error) {
          if (!abortController.signal.aborted) {
            console.error('CV target profile failed', {
              provider: 'deepseek',
              model,
              code: 'TARGET_PROFILE_FAILED',
              message: error instanceof Error ? error.message : String(error),
            });
            controller.enqueue(
              encode({
                type: 'error',
                code: 'TARGET_PROFILE_FAILED',
                message: 'Chưa thể tạo Target Profile. Vui lòng thử lại.',
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
