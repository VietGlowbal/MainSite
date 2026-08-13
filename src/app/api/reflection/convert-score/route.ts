import { NextResponse } from 'next/server';
import { z } from 'zod';
import { convertScore } from '@/lib/ai/score-conversion';
import { applyRateLimit, strategyAiLimiter } from '@/lib/rate-limiter';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/reflection/convert-score
 *
 * Turns a student's own description of their results — "9 As at GCSE and 4 A*s
 * at A Level", "Grade A in Cambridge C1 Advanced", a Vietnamese 10-point
 * average — into an estimated GPA or IELTS band for the reflection form.
 *
 * ─── IT ESTIMATES, IT DOES NOT SAVE ──────────────────────────────────────────
 *
 * Nothing here touches `student_profiles`. The response is a suggestion the
 * student then accepts with "Use this GPA", at which point the ordinary
 * PATCH stores it along with the text they typed and a note that it came from
 * a conversion. Saving directly would make the estimate indistinguishable from
 * a grade the student actually holds, which is the one thing the spec is most
 * insistent about.
 *
 * ─── "I DO NOT KNOW" IS A 200, NOT AN ERROR ──────────────────────────────────
 *
 * A low-confidence answer comes back with `value: null` and an explanation of
 * what else would help. That is a successful call: the model was asked whether
 * it could place the qualification and said no, which is exactly the behaviour
 * the spec asks for, and the UI shows the reason rather than an invented
 * number. Only a missing key, a transport failure or an unparseable response
 * is an error.
 *
 * Rate-limited on the shared strategy AI budget: this is cheap per call but
 * sits behind a text box a student can retype in, so it needs the same guard
 * the other AI routes have.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const requestSchema = z.object({
  target: z.enum(['gpa', 'ielts']),
  /**
   * Bounded well above a realistic answer but far below an essay: this is a
   * description of grades, and a 5,000-word paste is either a mistake or an
   * attempt to run up a bill.
   */
  description: z.string().trim().min(2).max(1000),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = applyRateLimit(strategyAiLimiter, user.id, 'grade conversion');
  if (limited) return limited;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Tell us a little about your grades first.' },
      { status: 400 },
    );
  }

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('[convert-score] OPENAI_API_KEY is not set');
    return NextResponse.json(
      { error: 'Score conversion is unavailable right now. Enter your score directly instead.' },
      { status: 503 },
    );
  }

  try {
    const result = await convertScore({
      target: parsed.data.target,
      description: parsed.data.description,
      apiKey,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[convert-score] conversion failed:', error);
    return NextResponse.json(
      { error: 'We could not read those grades. Try rephrasing, or enter your score directly.' },
      { status: 502 },
    );
  }
}
