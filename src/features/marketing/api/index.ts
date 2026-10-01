/**
 * marketing — data access (server-only).
 *
 * `marketing` was ui/-only until now (see eslint.config.mjs's FEATURES
 * comment): its one page, "/", inlines its admin-client waitlist insert
 * directly and is tracked in ADMIN_CLIENT_DEBT — a list that may shrink but
 * must never grow. The pre-launch "/coming-soon" gate needs
 * the same waitlist insert, so rather than adding a second frozen-debt entry,
 * it gets a real repository function here instead — the one place this
 * feature is allowed to reach the database directly.
 */
import { createAdminClient } from '@/server/db/admin';

/** The Home consultation form's answers that have their own columns once
    sql/supabase-waitlist-consultation-fields.sql has run. */
type ConsultationFields = {
  destination: string;
  budget: string | null;
  package: string | null;
};

type WaitlistSignupInput = {
  email: string;
  firstName: string;
  notes: string;
  phone: string;
  /** ISO `YYYY-MM-DD`, or empty when not supplied. */
  dateOfBirth: string;
  /** Where the row came from. Omitted, it is the /coming-soon waitlist. */
  source?: string;
  consultation?: ConsultationFields;
};

type WaitlistSignupResult =
  | { outcome: 'inserted' }
  | { outcome: 'updated' }
  | { outcome: 'table-missing' }
  | { outcome: 'error' };

/** PostgREST's "column is not in the schema cache". */
const UNKNOWN_COLUMN = 'PGRST204';

/** Insert-or-update a row in `waitlist_signups`. */
export async function recordWaitlistSignup({
  email,
  firstName,
  notes,
  phone,
  dateOfBirth,
  source = 'website_waitlist',
  consultation,
}: WaitlistSignupInput): Promise<WaitlistSignupResult> {
  const supabase = createAdminClient();

  const base = {
    first_name: firstName || null,
    notes: notes || null,
    phone: phone || null,
    date_of_birth: dateOfBirth || null,
  };
  const fields =
    consultation === undefined
      ? base
      : {
          ...base,
          destination: consultation.destination || null,
          budget: consultation.budget,
          package: consultation.package,
        };

  /* ⚠️ The consultation columns come from a follow-up migration the owner runs
     by hand, so this code can be live before they exist. PostgREST then rejects
     the WHOLE write with PGRST204 — so each write retries once with only the
     original columns. The same answers are already in `notes`, so deploy order
     can never cost a lead; the warning says what to run. */
  const missingColumns = (code: string | undefined) => code === UNKNOWN_COLUMN && fields !== base;

  let { error: insertError } = await supabase
    .from('waitlist_signups')
    .insert({ email, ...fields, source });

  if (missingColumns(insertError?.code)) {
    console.warn(
      '[recordWaitlistSignup] consultation columns missing — run sql/supabase-waitlist-consultation-fields.sql; answers kept in notes',
    );
    ({ error: insertError } = await supabase
      .from('waitlist_signups')
      .insert({ email, ...base, source }));
  }

  if (!insertError) return { outcome: 'inserted' };

  if (insertError.code === '23505') {
    const { error: updateError } = await supabase.from('waitlist_signups').update(fields).eq('email', email);
    if (missingColumns(updateError?.code)) {
      await supabase.from('waitlist_signups').update(base).eq('email', email);
    }
    return { outcome: 'updated' };
  }

  if (insertError.code === '42P01') return { outcome: 'table-missing' };

  console.error('[recordWaitlistSignup]', insertError);
  return { outcome: 'error' };
}
