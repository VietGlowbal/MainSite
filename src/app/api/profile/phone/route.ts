import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/profile/phone
 *
 * Persists a freshly phone-verified number onto the user's student_profiles
 * row and records (implicit) marketing consent. The OTP itself is verified
 * client-side against Supabase native phone auth; this endpoint trusts only
 * the server-confirmed state on auth.users — it requires the caller to be
 * authenticated AND to have a confirmed phone that matches the submitted
 * number, so a number can never be stored as "verified" without Supabase
 * having actually confirmed the SMS code.
 */

const BodySchema = z.object({
  // E.164-ish: leading +, 8–15 digits. Supabase normalises to digits only,
  // so we compare on digits below rather than exact string.
  phone: z.string().min(8).max(20),
});

const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');

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
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
  }

  // Trust the server, not the client: the phone must be confirmed on the auth
  // user and match what was submitted.
  if (!user.phone_confirmed_at || digits(user.phone) !== digits(parsed.data.phone)) {
    return NextResponse.json(
      { error: 'Phone number is not verified on this account' },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  // Use the service role so this works whether or not a profile row exists yet
  // (rows are otherwise created during onboarding). Keyed on user_id (unique).
  const admin = createAdminClient();
  const { error } = await admin
    .from('student_profiles')
    .upsert(
      {
        user_id: user.id,
        phone: parsed.data.phone,
        phone_verified: true,
        phone_verified_at: now,
        // Implicit consent: providing + verifying the number opts the user in.
        marketing_consent: true,
        marketing_consent_at: now,
        marketing_consent_source: 'signup_phone_implicit',
        updated_at: now,
      },
      { onConflict: 'user_id' },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
