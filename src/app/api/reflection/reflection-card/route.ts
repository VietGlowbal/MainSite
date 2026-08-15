import { NextResponse } from 'next/server';
import { z } from 'zod';
import { activityReflectionSchema } from '@/features/apply/domain';
import { generateReflectionCard } from '@/lib/ai/reflection-card-generation';
import { applyRateLimit, strategyAiLimiter } from '@/lib/rate-limiter';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/reflection/reflection-card
 *
 * Generates an AI Reflection Card from one activity's raw seven-dimension
 * reflection answers. Stateless by design: the request carries the answers
 * directly rather than an achievement/activity id, because the item being
 * reflected on may still only exist in the student's unsaved draft state on
 * `/ai-strategy/reflection/achievements` — this route never reads or writes
 * `student_achievements`/`student_activities` itself. The client merges the
 * returned card into its local copy of the item and persists it through the
 * ordinary `PATCH /api/reflection` whole-list save, same as every other
 * field on that item.
 *
 * Rate-limited on the shared strategy AI budget, same as
 * `/api/reflection/ideas` and `/api/reflection/convert-score`.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const requestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  organisation: z.string().trim().max(200).optional(),
  categoryLabel: z.string().trim().min(1).max(80),
  reflection: activityReflectionSchema,
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = applyRateLimit(strategyAiLimiter, user.id, 'reflection card generation');
  if (limited) return limited;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'We could not read that request.' }, { status: 400 });
  }

  const hasAnyAnswer = [
    parsed.data.reflection.context,
    parsed.data.reflection.motivation,
    parsed.data.reflection.challenge,
    parsed.data.reflection.action,
    parsed.data.reflection.impact,
    parsed.data.reflection.transformation,
    parsed.data.reflection.future,
  ].some((value) => Boolean(value?.trim()));
  if (!hasAnyAnswer) {
    return NextResponse.json(
      { error: 'Answer at least one reflection question before generating a card.' },
      { status: 400 },
    );
  }

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('[reflection/reflection-card] OPENAI_API_KEY is not set');
    return NextResponse.json(
      {
        error:
          'We saved your reflection, but couldn’t create the summary — Reflection Cards are unavailable right now.',
      },
      { status: 503 },
    );
  }

  try {
    const card = await generateReflectionCard({
      title: parsed.data.title,
      ...(parsed.data.organisation ? { organisation: parsed.data.organisation } : {}),
      categoryLabel: parsed.data.categoryLabel,
      reflection: parsed.data.reflection,
      apiKey,
    });
    return NextResponse.json({ card });
  } catch (error) {
    console.error('[reflection/reflection-card] generation failed:', error);
    return NextResponse.json(
      { error: 'We saved your reflection, but couldn’t create the summary.' },
      { status: 502 },
    );
  }
}
