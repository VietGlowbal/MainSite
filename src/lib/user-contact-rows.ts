/**
 * Flatten auth users + student profiles into the contact-export rows that go to
 * the Google Sheet.
 *
 * The column list and the coalesce order are lifted from
 * `scripts/export-user-contacts.sql`, which is the reviewed definition of this
 * export. Both must stay in step: the SQL is what someone runs by hand in the
 * Supabase editor, this is what the cron writes every 15 minutes, and they are
 * meant to produce the same table.
 *
 * ⚠️ The coalesce is load-bearing, not defensive padding. Phone and date of
 * birth live in TWO places — `student_profiles`, and the auth metadata written
 * at sign-up — because `src/app/auth/callback/route.ts` only copies metadata
 * into the profile on first login and only when the profile field is still
 * empty. Measured 2026-08-17: 16 phones on student_profiles against 63 on auth
 * metadata. Reading the profile column alone loses three quarters of them.
 *
 * ⚠️ 176 of 409 users have NO profile row at all, so `profile` being undefined
 * is the normal case, not an error case.
 *
 * Pure. No I/O.
 */

export const CONTACT_SHEET_COLUMNS = [
  'user_id',
  'full_name',
  'date_of_birth',
  'phone',
  'email',
  'self_reported_age',
  'country',
  'location',
  'nationality',
  'study_level',
  'onboarding_completed',
  'plus_status',
  'marketing_consent',
  'phone_verified',
  'email_verified',
  'signed_up_at',
  'last_sign_in_at',
] as const;

export type AuthUserLike = {
  id: string;
  email?: string | undefined;
  phone?: string | undefined;
  created_at?: string | undefined;
  last_sign_in_at?: string | null | undefined;
  email_confirmed_at?: string | null | undefined;
  user_metadata?: Record<string, unknown> | undefined;
};

export type ProfileLike = {
  user_id: string;
  phone?: string | null;
  date_of_birth?: string | null;
  age?: number | null;
  country?: string | null;
  location?: string | null;
  nationality?: string | null;
  study_level?: string | null;
  onboarding_completed?: boolean | null;
  plus_status?: string | boolean | null;
  marketing_consent?: boolean | null;
  phone_verified?: boolean | null;
};

/** Trimmed string, or '' — the sheet shows a blank cell rather than "null". */
function text(value: unknown): string {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : '';
}

/** First non-blank of several candidates. */
function firstOf(...values: unknown[]): string {
  for (const value of values) {
    const found = text(value);
    if (found !== '') return found;
  }
  return '';
}

function bool(value: unknown): string {
  if (value === true) return 'TRUE';
  if (value === false) return 'FALSE';
  return '';
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function buildContactRow(user: AuthUserLike, profile: ProfileLike | undefined): string[] {
  const meta = user.user_metadata ?? {};
  const metaDob = text(meta.date_of_birth);

  return [
    user.id,
    // Google spells it `name`, our own sign-up form spells it `full_name`.
    firstOf(meta.full_name, meta.name),
    firstOf(profile?.date_of_birth, ISO_DATE.test(metaDob) ? metaDob : ''),
    // auth.users.phone is only populated by SMS auth (unused here) — kept as a
    // harmless last resort rather than a real source.
    firstOf(profile?.phone, meta.phone, user.phone),
    firstOf(user.email, meta.email),
    profile?.age == null ? '' : String(profile.age),
    text(profile?.country),
    text(profile?.location),
    text(profile?.nationality),
    text(profile?.study_level),
    bool(profile?.onboarding_completed),
    typeof profile?.plus_status === 'boolean' ? bool(profile.plus_status) : text(profile?.plus_status),
    bool(profile?.marketing_consent),
    bool(profile?.phone_verified),
    bool(Boolean(user.email_confirmed_at)),
    text(user.created_at),
    text(user.last_sign_in_at),
  ];
}

/**
 * Header row followed by one row per user, newest sign-up first — the order the
 * exported CSV uses, and the one that puts today's students at the top of the
 * sheet where anyone checking on them will look.
 */
export function buildContactSheet(
  users: AuthUserLike[],
  profiles: ProfileLike[],
): string[][] {
  const byUser = new Map(profiles.map((p) => [p.user_id, p]));
  const sorted = [...users].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

  return [
    [...CONTACT_SHEET_COLUMNS],
    ...sorted.map((user) => buildContactRow(user, byUser.get(user.id))),
  ];
}
