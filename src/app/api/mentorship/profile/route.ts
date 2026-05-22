import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isSupportedCurrency } from '@/lib/mentors';

/**
 * PATCH /api/mentorship/profile
 *
 * Lets the mentor update their public profile, pricing, and availability
 * settings. Anything verification-related (legal_name, dob, documents) can
 * only be updated through the admin interface to avoid review fraud.
 */

const PatchSchema = z
  .object({
    display_name: z.string().min(2).max(120).optional(),
    avatar_url: z.string().url().nullable().optional(),
    bio: z.string().max(800).optional(),
    help_topics: z.array(z.string().min(1).max(60)).max(20).optional(),
    strengths: z.array(z.string().min(1).max(60)).max(20).optional(),
    languages: z.array(z.string().min(1).max(40)).max(15).optional(),
    hourly_rate_amount: z.number().int().positive().optional(),
    hourly_rate_currency: z.string().refine(isSupportedCurrency).optional(),
    currently_enrolled: z.boolean().optional(),
    study_start_year: z.number().int().min(1980).max(2050).nullable().optional(),
    graduation_year: z.number().int().min(1980).max(2050).nullable().optional(),
  })
  .strict();

export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  // Currency + amount must be updated together (or neither) so we don't
  // accidentally end up with USD listed at 500,000 by mistake.
  const update: Record<string, unknown> = { ...parsed.data };
  const hasAmount = parsed.data.hourly_rate_amount !== undefined;
  const hasCurrency = parsed.data.hourly_rate_currency !== undefined;
  if (hasAmount !== hasCurrency) {
    return NextResponse.json(
      { error: 'When changing pricing, send both hourly_rate_amount and hourly_rate_currency.' },
      { status: 400 },
    );
  }

  // Backwards compat — keep the legacy VND column in sync.
  if (parsed.data.hourly_rate_currency === 'VND' && parsed.data.hourly_rate_amount) {
    update.session_price_vnd = parsed.data.hourly_rate_amount;
  }

  const { error } = await supabase
    .from('achiever_profiles')
    .update(update)
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
