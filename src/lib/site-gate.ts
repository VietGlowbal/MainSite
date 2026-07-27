import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Pre-launch site lock — see LAUNCH_PLAN.md.
 *
 * Walls the whole site behind one shared team password until launch, while
 * leaving real Supabase auth (login/signup/admin) completely untouched
 * underneath it. Two independent layers on purpose: this answers "is the site
 * even visible yet", not "who is this user" — `src/proxy.ts` checks this
 * first and only reaches the existing auth/onboarding gates once it passes.
 *
 * `src/proxy.ts` runs in the Node.js runtime by default in this Next version
 * (Proxy no longer defaults to Edge — see the file-convention doc), so plain
 * `node:crypto` works here and in the Server Action that sets the cookie.
 *
 * The cookie holds sha256(SITE_GATE_SECRET + SITE_GATE_PASSWORD), never the
 * password itself, so rotating either env var instantly invalidates every
 * browser that was previously let in — no session store to clear.
 */

export const SITE_GATE_COOKIE = 'gb_site_gate';

/** Off unless explicitly turned on. Never set this in normal local dev. */
export function isSiteLockEnabled(): boolean {
  return process.env.SITE_LOCK_ENABLED === '1';
}

/**
 * The value a valid gate cookie must hold. Returns null when unconfigured so
 * every caller fails closed (nobody unlocks) rather than open.
 */
export function computeGateToken(): string | null {
  const secret = process.env.SITE_GATE_SECRET;
  const password = process.env.SITE_GATE_PASSWORD;
  if (!secret || !password) return null;
  return createHash('sha256').update(`${secret}:${password}`).digest('hex');
}

/** Does an incoming request's cookie value match the current gate token? */
export function verifyGateCookie(cookieValue: string | undefined): boolean {
  const expected = computeGateToken();
  if (!expected || !cookieValue) return false;

  // Fixed-length hex digests, so a length check before timingSafeEqual is
  // both correct and required — it throws on mismatched buffer lengths.
  const actual = Buffer.from(cookieValue);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}

/**
 * Does the submitted password match SITE_GATE_PASSWORD? Plain comparison is
 * fine here: this gate keeps an unfinished redesign off public view, it is
 * not the security boundary around anyone's account or data — that is still
 * entirely Supabase auth + RLS underneath it.
 */
export function checkGatePassword(candidate: string): boolean {
  const password = process.env.SITE_GATE_PASSWORD;
  return Boolean(password) && candidate === password;
}
