/**
 * Password rules — pure, synchronous, no I/O.
 *
 * These exist because Supabase's "leaked password protection" (Auth → Policies)
 * is OFF on this project and cannot be turned on by the whole team: it is an
 * organisation-owner setting and we are members, not owners. See
 * `docs/known-issues.md §0i`. Until an owner flips it, the equivalent control
 * lives here and in `../api/pwned-passwords`.
 *
 * Deliberately NO composition rules (no "must contain an uppercase and a
 * symbol"). NIST SP 800-63B withdrew that advice: composition rules push people
 * toward predictable mutations — `Password1!` satisfies every box and is one of
 * the most-breached strings in existence — while length and a breach-corpus
 * check are what actually correlate with resistance to guessing. So: a floor on
 * length, a ceiling to bound hashing work, and the breach check next door.
 */
import type { AuthErrorCode, AuthErrorVars } from './errors';

/**
 * 8 is the NIST SP 800-63B minimum for a user-chosen secret. The previous floor
 * was 6, which is Supabase's default and permits `123456` — the single most
 * common breached password. Raising it only affects NEW passwords; existing
 * accounts authenticate against the stored hash and are unaffected, because
 * nothing here runs on the sign-in path.
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Unchanged from the original Zod schema. A ceiling matters: the value is
 * hashed (bcrypt by Supabase, SHA-1 here for the k-anonymity prefix) and an
 * unbounded input is free CPU for whoever sends it.
 */
export const PASSWORD_MAX_LENGTH = 200;

/**
 * Carries the numbers it complains about as `vars` rather than baking them into
 * a sentence, so the message stays translatable when the limits change. See
 * `./errors`.
 */
export interface PasswordProblem {
  code: Extract<
    AuthErrorCode,
    'password_blank' | 'password_too_short' | 'password_too_long'
  >;
  vars?: AuthErrorVars;
}

/**
 * Returns the first rule the password breaks, or null when it passes.
 *
 * The password is NOT trimmed. Leading and trailing spaces are legitimate
 * characters in a passphrase, and silently stripping them would mean the string
 * we store differs from the one the user typed — they would then fail to sign
 * in with the exact password they chose.
 */
export function validatePassword(password: string): PasswordProblem | null {
  if (password.trim().length === 0) return { code: 'password_blank' };
  // Count UTF-16 code units, matching what the max exists to bound. Using
  // [...password].length here would disagree with the ceiling Supabase applies.
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { code: 'password_too_short', vars: { min: PASSWORD_MIN_LENGTH } };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { code: 'password_too_long', vars: { max: PASSWORD_MAX_LENGTH } };
  }
  return null;
}

/**
 * The extra rules that apply when a signed-in user changes their own password,
 * on top of the ones every new password must satisfy.
 */
export interface PasswordChangeProblem {
  code: Extract<
    AuthErrorCode,
    | 'password_blank'
    | 'password_too_short'
    | 'password_too_long'
    | 'current_password_required'
    | 'password_unchanged'
  >;
  vars?: AuthErrorVars;
}

/**
 * Checks a change-password submission without touching the network.
 *
 * Order is chosen for usefulness, not for cheapness — all three checks are
 * free. Strength runs before the equality check so someone who types `abc`
 * into both boxes is told the real problem (too short) rather than being sent
 * to find a *different* three-character password.
 *
 * WHY "must be different" IS A RULE AND NOT A COURTESY. This form is what a
 * user reaches after "I think someone has my password". Accepting the same
 * string would let the flow report success while changing nothing, which is the
 * one outcome that leaves them worse off than not trying: they now believe they
 * have rotated a password that is still compromised. The comparison is exact —
 * no trimming, no case folding — because those are different passwords to
 * Supabase, so calling them the same here would be a lie.
 *
 * Note this runs on the server with both plaintexts in hand. That is unavoidable
 * for the equality check; the alternative (hash and compare) buys nothing when
 * the current password is already being sent for verification.
 */
export function validatePasswordChange(
  currentPassword: string,
  newPassword: string,
): PasswordChangeProblem | null {
  if (currentPassword.length === 0) return { code: 'current_password_required' };
  const problem = validatePassword(newPassword);
  if (problem) return problem;
  if (newPassword === currentPassword) return { code: 'password_unchanged' };
  return null;
}

/**
 * Whether this account can sign in with a password at all.
 *
 * A student who only ever used "Continue with Google" has no password hash, so
 * asking them for their current one is unanswerable. The security page branches
 * on this to offer "set a password by email" instead.
 *
 * `email` is the provider name Supabase gives the password identity — the same
 * one whether the account was created by sign-up or by later linking.
 *
 * ABSENT IDENTITIES MEAN "ASSUME A PASSWORD", not "assume none". The list is
 * only missing when we failed to read the user properly, and defaulting to the
 * Google branch there would tell an ordinary password user that their account
 * has no password — sending them to their inbox for a link they do not need.
 * Defaulting the other way costs a wrong-password error at worst.
 */
export function hasPasswordIdentity(
  identities: readonly { provider: string }[] | null | undefined,
): boolean {
  if (!identities || identities.length === 0) return true;
  return identities.some((identity) => identity.provider === 'email');
}

/**
 * Splits an uppercase SHA-1 hex digest into the k-anonymity prefix and suffix.
 *
 * Only the 5-character prefix is ever sent to Have I Been Pwned; the API answers
 * with every breached suffix sharing it (~500-1000 of them), and the comparison
 * happens locally. The service therefore cannot learn the password, and cannot
 * even narrow it to one candidate.
 */
export function splitHashForRange(sha1Hex: string): { prefix: string; suffix: string } {
  const upper = sha1Hex.toUpperCase();
  return { prefix: upper.slice(0, 5), suffix: upper.slice(5) };
}

/**
 * Parses a `/range/{prefix}` response body and returns how many breaches the
 * suffix appears in — 0 when absent.
 *
 * Body is `SUFFIX:COUNT` per line, CRLF-separated. Two details that are easy to
 * get wrong and are the reason this is a separately tested pure function:
 *
 *   * A count of 0 is PADDING, not a hit. We request `Add-Padding: true`, which
 *     makes HIBP inject synthetic zero-count entries so the response size stops
 *     leaking whether the real prefix had few or many matches. Treating a
 *     padded row as a breach would reject valid passwords at random.
 *   * The suffix must match case-insensitively; HIBP returns uppercase, but
 *     that is a documented convention rather than a guarantee.
 */
export function countBreaches(body: string, suffix: string): number {
  const target = suffix.toUpperCase();
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    if (line.slice(0, sep).toUpperCase() !== target) continue;
    const count = Number.parseInt(line.slice(sep + 1), 10);
    return Number.isFinite(count) && count > 0 ? count : 0;
  }
  return 0;
}
