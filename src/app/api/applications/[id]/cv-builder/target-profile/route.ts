import { NextResponse } from 'next/server';
import { generateCvTargetProfile } from '@/lib/ai/cv-builder';
import {
  isCvBuilderEnabled,
  loadCvBuilderContext,
} from '@/lib/ai/cv-builder-context';
import {
  loadLatestCvStrategySnapshot,
  resolveCvSelectedDirection,
  type CvStrategyDatabase,
} from '@/lib/ai/cv-builder-strategy';
import { streamOpenAIText } from '@/lib/ai/vinuni-grounded-evaluation';
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

  const { id } = await params;
  // Resolve the owner-scoped application before inspecting business payloads.
  // This keeps malformed requests from revealing whether another user's
  // application exists (the same 404 contract as all other CV Builder APIs).
  const context = await loadCvBuilderContext(id, user);
  if (!context) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const payload = await request.json().catch(() => null);
  const validBody =
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    Object.keys(payload).length === 2 &&
    Object.keys(payload).every((key) =>
      key === 'expectedRecommendationId' || key === 'selectedDirection',
    ) &&
    typeof payload.expectedRecommendationId === 'string' &&
    typeof payload.selectedDirection === 'string' &&
    payload.expectedRecommendationId.trim().length > 0 &&
    payload.selectedDirection.trim().length > 0;
  if (!validBody) {
    return NextResponse.json(
      {
        code: 'INVALID_DIRECTION',
        error: 'Select one of the available Personalized Strategy directions.',
      },
      { status: 400 },
    );
  }
  const expectedRecommendationId = payload.expectedRecommendationId.trim();
  const selectedDirectionName = payload.selectedDirection.trim();

  const strategy = await loadLatestCvStrategySnapshot(
    supabase as unknown as CvStrategyDatabase,
    id,
    user.id,
  );
  if (!strategy) {
    return NextResponse.json(
      {
        code: 'STRATEGY_REQUIRED',
        error: 'A current Personalized Strategy is required before building a CV.',
      },
      { status: 422 },
    );
  }
  if (strategy.recommendationId !== expectedRecommendationId) {
    return NextResponse.json(
      {
        code: 'STRATEGY_STALE',
        error: 'Your Personalized Strategy changed. Refresh the CV Builder and try again.',
      },
      { status: 409 },
    );
  }
  const selectedDirection = resolveCvSelectedDirection(strategy, selectedDirectionName);
  if (!selectedDirection) {
    return NextResponse.json(
      {
        code: 'INVALID_DIRECTION',
        error: 'Select one of the available Personalized Strategy directions.',
      },
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
            message: 'Preparing profile and programme data…',
          }),
        );
        controller.enqueue(
          encode({
            type: 'status',
            stage: 'building_target',
            message: 'AI is building the Target Profile…',
          }),
        );
        try {
          const targetProfile = await generateCvTargetProfile({
            context,
            strategy,
            selectedDirection,
            apiKey,
            model,
            stream: streamOpenAIText,
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
              provider: 'openai',
              model,
              code: 'TARGET_PROFILE_FAILED',
              message: error instanceof Error ? error.message : String(error),
            });
            controller.enqueue(
              encode({
                type: 'error',
                code: 'TARGET_PROFILE_FAILED',
                message: 'Could not create the Target Profile. Please try again.',
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
