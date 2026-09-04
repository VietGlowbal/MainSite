/**
 * Auth error contract — shared by the API routes and the client that renders
 * them. Pure: no I/O, no React.
 *
 * WHY A CODE AND NOT JUST A STRING. The routes used to answer with an English
 * sentence and the form printed it verbatim, so the error was the one part of
 * the UI that never followed the language switch. Translating the sentence
 * directly would half-work: `t()` keys on the English source, so a *fixed*
 * sentence can be translated, but `Password must be at least 8 characters.`
 * bakes the number in — change `PASSWORD_MIN_LENGTH` and every catalog key
 * silently misses and falls back to English.
 *
 * So the wire carries a stable `code` plus `vars`, and the message template
 * keeps `{min}` as a placeholder. The template doubles as the i18n key, and
 * `t()` interpolates in whichever language is active. The routes ALSO send a
 * pre-interpolated English `error` string, so a non-browser caller (curl, a
 * test, a log line) still reads something meaningful.
 */

export type AuthErrorCode =
  | 'invalid_json'
  | 'invalid_input'
  | 'contact_fields'
  | 'password_blank'
  | 'password_too_short'
  | 'password_too_long'
  | 'password_breached'
  | 'email_exists'
  | 'signup_failed'
  | 'reset_link_invalid'
  | 'reset_failed'
  | 'rate_limited';

/**
 * English source text, and simultaneously the i18n catalog key. `{name}`
 * placeholders are filled by `t(template, vars)` on the client and by
 * `formatAuthError` on the server.
 *
 * Keep these in sync with `src/lib/i18n-auth.ts` — a missing entry there is not
 * an error, it just renders English.
 */
export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  invalid_json: 'We could not read that request. Please try again.',
  invalid_input: 'Please enter a valid email and password.',
  contact_fields: 'Please check the fields below.',
  password_blank: 'Please enter a password.',
  password_too_short: 'Password must be at least {min} characters.',
  password_too_long: 'Password must be {max} characters or fewer.',
  password_breached:
    'This password has appeared in a known data breach. Please choose a different password.',
  email_exists: 'An account with this email already exists. Try signing in instead.',
  signup_failed: 'Could not create your account. Please try again.',
  reset_link_invalid:
    'This reset link is invalid or has expired. Please request a new one.',
  reset_failed: 'Could not update your password. Please try again.',
  rate_limited: 'Too many attempts. Please wait a moment and try again.',
};

export type AuthErrorVars = Record<string, string | number>;

/** Fills `{name}` placeholders. Mirrors the interpolation `t()` performs. */
export function formatAuthError(code: AuthErrorCode, vars?: AuthErrorVars): string {
  const template = AUTH_ERROR_MESSAGES[code];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

/** The JSON body every auth route returns on failure. */
export interface AuthErrorBody {
  /** Pre-interpolated English, for non-browser callers and logs. */
  error: string;
  code: AuthErrorCode;
  vars?: AuthErrorVars;
}

export function authErrorBody(code: AuthErrorCode, vars?: AuthErrorVars): AuthErrorBody {
  return vars
    ? { error: formatAuthError(code, vars), code, vars }
    : { error: formatAuthError(code), code };
}

/**
 * Narrows an unknown JSON body to a code we know how to translate.
 *
 * `hasOwnProperty`, not `in`: `in` walks the prototype chain, so a response
 * carrying `code: "toString"` or `"constructor"` would pass, and the lookup
 * would then hand a Function to the renderer instead of a message. The input
 * here is a parsed JSON body, so those keys are attacker-reachable.
 */
export function isAuthErrorCode(value: unknown): value is AuthErrorCode {
  return typeof value === 'string' && Object.hasOwn(AUTH_ERROR_MESSAGES, value);
}

/**
 * What the form holds in state — a CODE, not a rendered sentence.
 *
 * This is the part that makes the language switcher work on errors. If the
 * component stored the translated string, the text would freeze in whichever
 * language was active when the request failed and stay wrong until the next
 * submit. Storing the code and translating during render means switching
 * language re-renders the message like any other label.
 *
 * `{ text }` is the escape hatch for messages we did not author — Supabase's
 * own sign-in errors, mostly. Those still pass through `t()`, which translates
 * them if the catalog happens to carry the English string and otherwise renders
 * English unchanged.
 */
export type AuthErrorState = { code: AuthErrorCode; vars?: AuthErrorVars } | { text: string };

/** Reads a failed route response into state. Never throws on odd shapes. */
export function authErrorFromResponse(body: unknown, fallbackText: string): AuthErrorState {
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>;
    if (isAuthErrorCode(record.code)) {
      const vars = record.vars;
      return typeof vars === 'object' && vars !== null
        ? { code: record.code, vars: vars as AuthErrorVars }
        : { code: record.code };
    }
    // Pre-contract responses, and any route not yet migrated, still carry a
    // plain English `error`. Keep rendering those rather than a blank box.
    if (typeof record.error === 'string' && record.error.length > 0) {
      return { text: record.error };
    }
  }
  return { text: fallbackText };
}

/** Renders state in the active language. `t` is injected to keep this pure. */
export function authErrorText(
  state: AuthErrorState,
  t: (en: string, vars?: AuthErrorVars) => string,
): string {
  return 'code' in state ? t(AUTH_ERROR_MESSAGES[state.code], state.vars) : t(state.text);
}
