import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/profile/phone
 *
 * Stores the phone number collected at sign-up onto the user's
 * student_profiles row and records (implicit) marketing consent. The number is
 * captured, not verified. Requires the caller to be authenticated; the number
 * is taken from the request body for the current user only.
 */

const BodySchema = z.object({
  // E.164-ish: leading +, 8–15 digits. Kept lenient — this is collected, not
  // validated against a carrier.
  phone: z.string().min(8).max(20),
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
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
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
        // Implicit consent: providing the number opts the user in.
        marketing_consent: true,
        marketing_consent_at: now,
        marketing_consent_source: 'signup',
        updated_at: now,
      },
      { onConflict: 'user_id' },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
