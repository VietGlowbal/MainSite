import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isSupportedCurrency } from '@/lib/mentors';

/**
 * POST /api/mentorship/signup
 *
 * Creates a pending mentor profile after the user has uploaded their
 * verification documents directly to the `mentor-documents` storage bucket.
 *
 * The client uploads each file via the Supabase JS SDK (RLS-scoped to the
 * user's own folder) and then sends the resulting storage keys here. We
 * never accept binary uploads through this route, which keeps the API
 * fast and removes a whole class of file-handling vulnerabilities.
 */

const SignupSchema = z.object({
  // 7 required pieces — name, university, dob, cv, acceptance letter,
  // transcript, student card.
  display_name: z.string().min(2).max(120),
  legal_name: z.string().min(2).max(160),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  university_id: z.number().int().positive(),

  cv_storage_key: z.string().min(1),
  acceptance_letter_storage_key: z.string().min(1),
  transcript_storage_key: z.string().min(1),
  student_card_storage_key: z.string().min(1),

  // Mentor profile content
  avatar_url: z.string().url().nullable().optional(),
  degree_level: z.enum(['undergraduate', 'masters', 'phd', 'alumni']),
  subject: z.string().min(2).max(120),
  graduation_year: z.number().int().min(1980).max(2050).nullable().optional(),
  study_start_year: z.number().int().min(1980).max(2050).nullable().optional(),
  currently_enrolled: z.boolean(),

  bio: z.string().min(20).max(800),
  help_topics: z.array(z.string().min(1).max(60)).min(1).max(15),
  strengths: z.array(z.string().min(1).max(60)).min(1).max(15),
  languages: z.array(z.string().min(1).max(40)).min(1).max(10),

  // Pricing
  hourly_rate_amount: z.number().int().positive(),
  hourly_rate_currency: z.string().refine(isSupportedCurrency, 'Currency must be USD, GBP or VND'),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid signup', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Sanity checks on dates
  const dob = new Date(`${input.date_of_birth}T00:00:00Z`);
  const now = new Date();
  const ageYears = (now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears < 16 || ageYears > 100) {
    return NextResponse.json(
      { error: 'Date of birth looks invalid' },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  // Check if a profile already exists; if so, return its status so the
  // client can route the user to their dashboard.
  const { data: existing } = await supabase
    .from('achiever_profiles')
    .select('id, status')
    .eq('id', user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: 'You already have a mentor profile', status: existing.status },
      { status: 409 },
    );
  }

  // Map currency-specific minimum hourly rate to surface clear errors.
  const minByCurrency: Record<string, number> = {
    USD: 500, // $5.00
    GBP: 500, // £5.00
    VND: 50000, // 50,000 ₫
  };
  if (input.hourly_rate_amount < minByCurrency[input.hourly_rate_currency]) {
    return NextResponse.json(
      { error: 'Hourly rate is below the minimum for this currency' },
      { status: 400 },
    );
  }

  const { error: insertErr } = await supabase.from('achiever_profiles').insert({
    id: user.id,
    display_name: input.display_name,
    legal_name: input.legal_name,
    date_of_birth: input.date_of_birth,
    avatar_url: input.avatar_url ?? null,
    university_id: input.university_id,
    degree_level: input.degree_level,
    subject: input.subject,
    graduation_year: input.graduation_year ?? null,
    study_start_year: input.study_start_year ?? null,
    currently_enrolled: input.currently_enrolled,
    bio: input.bio,
    help_topics: input.help_topics,
    strengths: input.strengths,
    languages: input.languages,
    // Multi-currency
    hourly_rate_amount: input.hourly_rate_amount,
    hourly_rate_currency: input.hourly_rate_currency,
    // Legacy VND fields — best-effort copy for compatibility.
    session_price_vnd:
      input.hourly_rate_currency === 'VND' ? input.hourly_rate_amount : 0,
    session_duration_mins: 60,
    // Documents
    cv_storage_key: input.cv_storage_key,
    acceptance_letter_storage_key: input.acceptance_letter_storage_key,
    transcript_storage_key: input.transcript_storage_key,
    student_card_storage_key: input.student_card_storage_key,
    status: 'pending',
  });

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
