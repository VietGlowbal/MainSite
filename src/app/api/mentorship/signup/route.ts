import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
  // Either pick an existing university (id) OR type in a new one. The refine
  // below guarantees exactly one of these paths is satisfied.
  university_id: z.number().int().positive().nullish(),
  custom_university_name: z.string().min(2).max(160).nullish(),
  custom_university_country: z.string().min(2).max(120).nullish(),

  // Documents are required for the standard flow but optional for a
  // token-authorised quick signup (validated below).
  cv_storage_key: z.string().min(1).nullish(),
  acceptance_letter_storage_key: z.string().min(1).nullish(),
  transcript_storage_key: z.string().min(1).nullish(),
  student_card_storage_key: z.string().min(1).nullish(),

  // Secret fast-track token (matched against MENTOR_QUICK_SIGNUP_TOKEN).
  quick_signup_token: z.string().nullish(),

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
}).refine(
  (d) =>
    (d.university_id != null) ||
    (!!d.custom_university_name && !!d.custom_university_country),
  { message: 'Pick a university or add your own (name + country).' },
);

/**
 * Match an existing university by (case-insensitive) name, or create a new one.
 * Used when a mentor types in a university that isn't in our list yet. New rows
 * are tagged so the team can review/enrich them — we insert with a `source`
 * marker when that column exists, falling back to a bare insert so signups keep
 * working even before the supabase-university-source.sql migration is applied.
 */
async function resolveCustomUniversity(
  name: string,
  country: string,
): Promise<number | null> {
  const admin = createAdminClient();

  const findByName = async () => {
    const { data } = await admin
      .from('universities')
      .select('id')
      .ilike('name', name)
      .limit(1)
      .maybeSingle();
    return data?.id ?? null;
  };

  const existing = await findByName();
  if (existing != null) return existing;

  // Try a tagged insert first; if the `source` column doesn't exist yet, retry
  // with just the required columns.
  let created = await admin
    .from('universities')
    .insert({ name, country, source: 'mentor_signup' })
    .select('id')
    .single();
  if (created.error) {
    created = await admin
      .from('universities')
      .insert({ name, country })
      .select('id')
      .single();
  }
  if (created.data?.id != null) return created.data.id;

  // An insert can still fail if a concurrent signup created the same name
  // (unique-name index) — fall back to re-selecting it.
  return findByName();
}

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

  // Fast-track ("quick signup"): only valid when the client presents the
  // secret token matching MENTOR_QUICK_SIGNUP_TOKEN. A forged or absent token
  // falls back to the standard flow, which requires all four documents below.
  const expectedToken = process.env.MENTOR_QUICK_SIGNUP_TOKEN ?? '';
  const isQuickSignup =
    expectedToken.length > 0 && input.quick_signup_token === expectedToken;

  if (!isQuickSignup) {
    const missingDocs =
      !input.cv_storage_key ||
      !input.acceptance_letter_storage_key ||
      !input.transcript_storage_key ||
      !input.student_card_storage_key;
    if (missingDocs) {
      return NextResponse.json(
        { error: 'All four verification documents are required.' },
        { status: 400 },
      );
    }
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
      { error: 'You already have an advisor profile', status: existing.status },
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

  // Resolve the university: an explicit id wins; otherwise match-or-create the
  // typed-in university so we always store a valid FK.
  let universityId = input.university_id ?? null;
  if (universityId == null && input.custom_university_name && input.custom_university_country) {
    universityId = await resolveCustomUniversity(
      input.custom_university_name.trim(),
      input.custom_university_country.trim(),
    );
  }
  if (universityId == null) {
    return NextResponse.json(
      { error: 'Could not save your university. Please try again.' },
      { status: 400 },
    );
  }

  const { error: insertErr } = await supabase.from('achiever_profiles').insert({
    id: user.id,
    display_name: input.display_name,
    legal_name: input.legal_name,
    date_of_birth: input.date_of_birth,
    avatar_url: input.avatar_url ?? null,
    university_id: universityId,
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
    // Documents (null for a fast-track signup)
    cv_storage_key: input.cv_storage_key ?? null,
    acceptance_letter_storage_key: input.acceptance_letter_storage_key ?? null,
    transcript_storage_key: input.transcript_storage_key ?? null,
    student_card_storage_key: input.student_card_storage_key ?? null,
    status: 'pending',
    // Only set on the fast-track path so standard signups don't depend on the
    // supabase-mentor-quick-signup.sql migration having been applied yet.
    ...(isQuickSignup ? { quick_signup: true } : {}),
  });

  if (insertErr) {
    // The legacy `session_price_vnd` column historically carried a
    // `>= 100000` check constraint. Mentors pricing in USD/GBP send 0 here,
    // which trips that constraint until the supabase-mentorship.sql migration
    // is applied. Surface a clear, actionable message instead of the raw error.
    console.error('Mentor signup insert failed', insertErr);
    if (insertErr.code === '23514' && insertErr.message.includes('session_price_vnd')) {
      return NextResponse.json(
        {
          error:
            'Advisor signups are temporarily unavailable due to a database update. Please try again shortly.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: 'Could not submit your application. Please try again.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
