import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  generateAspirationIdeas,
  generateSubjectMotivationIdeas,
} from '@/lib/ai/aspiration-ideas';
import { applyRateLimit, strategyAiLimiter } from '@/lib/rate-limiter';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/reflection/ideas
 *
 * A few short, editable sentences to help a student start answering "what do
 * you want to do after you graduate?" or "why this subject?".
 *
 * ─── IT SUGGESTS; IT DOES NOT SAVE ───────────────────────────────────────────
 *
 * Nothing here touches `student_profiles`. The response is a list the student
 * picks from, which lands in the textarea for them to edit and is then saved
 * by the ordinary autosave like anything they typed themselves. That is the
 * whole point of the spec's "AI should assist, not replace the student's
 * control" — and the only way to honour it is for this route to have no write
 * path at all.
 *
 * Rate-limited on the shared strategy AI budget: it sits behind a button a
 * student can press repeatedly for a different set of ideas.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const requestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('aspiration'),
    /** Subject labels, purely as context for the suggestions. */
    subjects: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
    draft: z.string().trim().max(2000).optional(),
  }),
  z.object({
    kind: z.literal('subject-motivation'),
    subject: z.string().trim().min(1).max(120),
    aspiration: z.string().trim().max(2000).optional(),
    draft: z.string().trim().max(2000).optional(),
  }),
]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = applyRateLimit(strategyAiLimiter, user.id, 'idea generation');
  if (limited) return limited;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'We could not read that request.' }, { status: 400 });
  }

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('[reflection/ideas] OPENAI_API_KEY is not set');
    return NextResponse.json(
      { error: 'Idea suggestions are unavailable right now — write in your own words instead.' },
      { status: 503 },
    );
  }

  try {
    const result =
      parsed.data.kind === 'aspiration'
        ? await generateAspirationIdeas({
            subjects: parsed.data.subjects,
            ...(parsed.data.draft === undefined ? {} : { draft: parsed.data.draft }),
            apiKey,
          })
        : await generateSubjectMotivationIdeas({
            subject: parsed.data.subject,
            ...(parsed.data.aspiration === undefined
              ? {}
              : { aspiration: parsed.data.aspiration }),
            ...(parsed.data.draft === undefined ? {} : { draft: parsed.data.draft }),
            apiKey,
          });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[reflection/ideas] generation failed:', error);
    return NextResponse.json(
      { error: 'We could not come up with ideas just now. Try again, or write your own.' },
      { status: 502 },
    );
  }
}
