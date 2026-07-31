/**
 * marketing — data access (server-only).
 *
 * `marketing` was ui/-only until now (see eslint.config.mjs's FEATURES
 * comment): its one page, "/", inlines its admin-client waitlist insert
 * directly and is tracked in ADMIN_CLIENT_DEBT — a list that may shrink but
 * must never grow. The pre-launch "/coming-soon" gate (LAUNCH_PLAN.md) needs
 * the same waitlist insert, so rather than adding a second frozen-debt entry,
 * it gets a real repository function here instead — the one place this
 * feature is allowed to reach the database directly.
 */
import { createAdminClient } from '@/server/db/admin';

type WaitlistSignupInput = {
  email: string;
  firstName: string;
  notes: string;
  phone: string;
  /** ISO `YYYY-MM-DD`, or empty when not supplied. */
  dateOfBirth: string;
};

type WaitlistSignupResult =
  | { outcome: 'inserted' }
  | { outcome: 'updated' }
  | { outcome: 'table-missing' }
  | { outcome: 'error' };

/** Insert-or-update a row in `waitlist_signups`. */
export async function recordWaitlistSignup({
  email,
  firstName,
  notes,
  phone,
  dateOfBirth,
}: WaitlistSignupInput): Promise<WaitlistSignupResult> {
  const supabase = createAdminClient();

  const fields = {
    first_name: firstName || null,
    notes: notes || null,
    phone: phone || null,
    date_of_birth: dateOfBirth || null,
  };

  const { error: insertError } = await supabase
    .from('waitlist_signups')
    .insert({ email, ...fields, source: 'website_waitlist' });

  if (!insertError) return { outcome: 'inserted' };

  if (insertError.code === '23505') {
    await supabase.from('waitlist_signups').update(fields).eq('email', email);
    return { outcome: 'updated' };
  }

  if (insertError.code === '42P01') return { outcome: 'table-missing' };

  console.error('[recordWaitlistSignup]', insertError);
  return { outcome: 'error' };
}
