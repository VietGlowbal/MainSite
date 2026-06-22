import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/profile/dob
 *
 * Stores the date of birth collected at sign-up onto the user's
 * student_profiles (contact) record. Mirrors /api/profile/phone: requires the
 * caller to be authenticated, and the value is taken from the request body for
 * the current user only. Uses the service role so it works whether or not a
 * profile row exists yet (rows are otherwise created during onboarding).
 */

const BodySchema = z.object({
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid date of birth' }, { status: 400 });
  }

  // Sanity-check the date: a real, past date with a plausible age.
  const dob = new Date(`${parsed.data.date_of_birth}T00:00:00Z`);
  const ageYears = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(dob.getTime()) || ageYears < 0 || ageYears > 120) {
    return NextResponse.json({ error: 'Date of birth looks invalid' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin.from('student_profiles').upsert(
    {
      user_id: user.id,
      date_of_birth: parsed.data.date_of_birth,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
