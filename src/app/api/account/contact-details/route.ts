import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizePhone, validateContactDetails } from '@/features/auth/domain';

/**
 * POST /api/account/contact-details
 *
 * Backs the /auth/complete-profile gate: the one place a student can supply the
 * name / phone / date of birth that Google never asked them for.
 *
 * Writes phone and date of birth to `student_profiles` and the name to auth
 * metadata, because there is no `student_profiles.full_name` column — the name
 * has always lived on the auth user, and that is what the nav and the
 * transactional emails read.
 *
 * The values are NOT routed through auth metadata on their way to the profile
 * table, the way the sign-up form's are. That path only copies a value across
 * on first login and only when the column is still empty
 * (`src/app/auth/callback/route.ts`), which is how 63 phone numbers in metadata
 * became 16 in the profile table. This writes where the data is read from.
 */

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'You need to be signed in.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const input = {
    full_name: typeof raw.full_name === 'string' ? raw.full_name : '',
    phone: typeof raw.phone === 'string' ? raw.phone : '',
    date_of_birth: typeof raw.date_of_birth === 'string' ? raw.date_of_birth : '',
  };

  const errors = validateContactDetails(input);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'Please check the fields below.', errors }, { status: 400 });
  }

  const phone = normalizePhone(input.phone);
  if (phone == null) {
    // Unreachable — validateContactDetails rejects anything normalize refuses.
    return NextResponse.json({ error: 'Please check the fields below.' }, { status: 400 });
  }

  const name = input.full_name.trim();
  const now = new Date().toISOString();
  const admin = createAdminClient();

  const { error: profileError } = await admin.from('student_profiles').upsert(
    {
      user_id: user.id,
      phone,
      date_of_birth: input.date_of_birth.trim(),
      updated_at: now,
      // Consent is recorded only when the student ticked the box. The sign-up
      // route sets marketing_consent: true unconditionally; this does not
      // inherit that, because a number collected behind a mandatory gate is not
      // a number anyone opted in with.
      ...(raw.marketing_consent === true
        ? {
            marketing_consent: true,
            marketing_consent_at: now,
            marketing_consent_source: 'complete-profile',
          }
        : {}),
    },
    { onConflict: 'user_id' },
  );

  if (profileError) {
    console.error('[account/contact-details] profile upsert failed', profileError);
    return NextResponse.json({ error: 'Could not save your details. Please try again.' }, { status: 500 });
  }

  const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, full_name: name, phone, date_of_birth: input.date_of_birth.trim() },
  });

  if (metaError) {
    // The gate reads the profile table, which is already written — a stale name
    // on the auth user is not worth sending the student back through the form.
    console.error('[account/contact-details] metadata update failed', metaError);
  }

  return NextResponse.json({ ok: true });
}
