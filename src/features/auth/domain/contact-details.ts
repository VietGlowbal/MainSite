/**
 * "Has this student given us the contact details every GlowBal account needs?"
 *
 * Name, phone and date of birth are required of every account — but only the
 * email/password form can ask for them at sign-up. Google's consent screen
 * returns a name, an email and a picture, and no OAuth provider will render our
 * fields. That asymmetry is the whole reason this file exists: of 409 accounts,
 * the 333 that arrived through Google had a name and *zero* phone numbers and
 * *zero* dates of birth between them.
 *
 * So the data cannot be collected at sign-up for most users. It is collected
 * after authentication instead, at /auth/complete-profile, and `src/proxy.ts`
 * holds a student there until `contactDetailsComplete` returns true.
 *
 * ⚠️ Missing means blank, NOT null. The sign-up route defaults absent fields to
 * `''` before writing them (`data: { phone: input.phone ?? '' }`), so the column
 * is full of empty strings that a NULL check reads as present: 19 rows have a
 * non-null phone, only 16 have a phone. Everything here goes through `hasText`.
 *
 * Note the predicate checks phone and date of birth but not name — every one of
 * the 409 existing accounts has a name, from Google or from the sign-up form, so
 * gating on it would only add a way to trap someone with no way to be missing
 * it. The completion form still collects and requires it, which is what keeps
 * that true for new accounts.
 *
 * Pure. No I/O.
 */

/** Present and not just whitespace. The only "is it filled in" test to use. */
export function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/** The two columns the gate reads, as they come back from PostgREST. */
export type ContactDetailsRow = {
  phone?: string | null;
  date_of_birth?: string | null;
};

export function contactDetailsComplete(row: ContactDetailsRow | null | undefined): boolean {
  if (row == null) return false;
  return hasText(row.phone) && hasText(row.date_of_birth);
}

/* ── Validation ──────────────────────────────────────────────────────────── */

export const NAME_MAX = 160;

/** Youngest and oldest plausible applicant. Anything outside is a typo. */
export const MIN_AGE = 10;
export const MAX_AGE = 100;

export type ContactDetailsInput = {
  full_name: string;
  phone: string;
  date_of_birth: string;
};

export type ContactDetailsErrors = Partial<Record<keyof ContactDetailsInput, string>>;

/**
 * Normalise a phone number to E.164-ish digits for storage.
 *
 * GlowBal's students are overwhelmingly Vietnamese and type their number the
 * local way — `0912 345 678`. Stored verbatim that leading 0 makes the number
 * undiallable from outside VN and unmatchable against the same person's number
 * written `+84912345678`, so a national-format VN number is promoted to +84.
 * A number that already carries any `+` prefix is left on its own country code.
 *
 * Returns null when the input cannot be a phone number at all.
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const hadPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits === '') return null;

  // Vietnamese national format: 0 + 9 digits (mobile) or 0 + 8-10 (landline).
  if (!hadPlus && digits.startsWith('0') && digits.length >= 9 && digits.length <= 11) {
    return `+84${digits.slice(1)}`;
  }

  // E.164 allows 15 digits at most; below 8 nothing real is dialable.
  if (digits.length < 8 || digits.length > 15) return null;

  return `+${digits}`;
}

/**
 * Does this `YYYY-MM-DD` string name a day that actually exists?
 *
 * `Date.parse` is not this check. It NORMALISES impossible dates rather than
 * rejecting them — `Date.parse('2002-02-30')` succeeds and silently means
 * 2 March. A submission straight to the API (no browser date picker in the way)
 * therefore passed validation and reached Postgres, which is stricter than
 * JavaScript and rejects the original string against a `date` column: a 500 on
 * /api/account/contact-details, and on the signup route an auth account created
 * carrying a date of birth nothing can read.
 *
 * So the parsed components must round-trip back to the ones submitted.
 */
export function isRealCalendarDate(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;

  const [, year, month, day] = match as unknown as [string, string, string, string];
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const date = new Date(Date.UTC(y, m - 1, d));

  return (
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
  );
}

/**
 * Sanitise a `?next=` destination down to a same-origin path.
 *
 * `raw.startsWith('/')` is NOT sufficient on its own: `//attacker.example` and
 * `/\attacker.example` both begin with a slash and are read as PROTOCOL-RELATIVE
 * URLs by `window.location.assign` and by `redirect()`, which sends the student
 * off GlowBal entirely. A crafted /auth/complete-profile link would then be an
 * open redirect wearing a trusted origin.
 *
 * `/auth` is excluded separately so the destination can never bounce back into
 * the gate that produced it.
 */
export function safeInternalPath(raw: string | null | undefined, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  if (!raw.startsWith('/')) return fallback;
  // Second character decides protocol-relative; browsers treat `\` as `/` here.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  if (raw === '/auth' || raw.startsWith('/auth/') || raw.startsWith('/auth?')) return fallback;
  return raw;
}

/** Age in whole years on `today`, from an ISO `YYYY-MM-DD` date. */
export function ageOn(isoDate: string, today: Date): number {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  let age = today.getUTCFullYear() - y;
  const monthDelta = today.getUTCMonth() + 1 - m;
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < d)) age -= 1;
  return age;
}

/**
 * Validate the completion form's three fields.
 *
 * Shared by the client form and the API route deliberately — the route cannot
 * trust the browser, and duplicating the rules is how the two drift apart and
 * start disagreeing about the same number.
 */
export function validateContactDetails(
  input: ContactDetailsInput,
  now: Date = new Date(),
): ContactDetailsErrors {
  const errors: ContactDetailsErrors = {};

  const name = input.full_name.trim();
  if (name === '') errors.full_name = 'Please enter your name.';
  else if (name.length > NAME_MAX) errors.full_name = `Please keep your name under ${NAME_MAX} characters.`;

  if (input.phone.trim() === '') {
    errors.phone = 'Please enter your phone number.';
  } else if (normalizePhone(input.phone) == null) {
    errors.phone = "That doesn't look like a phone number. Include your country code, e.g. +84.";
  }

  const dob = input.date_of_birth.trim();
  if (dob === '') {
    errors.date_of_birth = 'Please enter your date of birth.';
  } else if (!isRealCalendarDate(dob)) {
    errors.date_of_birth = 'Please enter a valid date.';
  } else {
    const age = ageOn(dob, now);
    if (age < 0) errors.date_of_birth = 'Date of birth cannot be in the future.';
    else if (age < MIN_AGE) errors.date_of_birth = `You must be at least ${MIN_AGE} to use GlowBal.`;
    else if (age > MAX_AGE) errors.date_of_birth = 'Please check the year — that date looks like a typo.';
  }

  return errors;
}
