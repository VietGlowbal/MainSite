/**
 * The visitor's analytics choice, in a form the server can read.
 *
 * WHY A COOKIE WHEN CONSENT ALREADY LIVES IN localStorage. `ConsentBoundary`
 * stores the full record in localStorage, which is enough for everything that
 * decides in the browser (mounting GA, gating `emit` in `lib/analytics/ga.ts`).
 * It is not enough for a decision taken on the server: `/c/<code>` sets the
 * `gb_visitor` cookie during a redirect, in a request handler that can see
 * cookies and nothing else. Mirroring the one field that matters into a cookie
 * is what lets that route honour "Reject non-essential" at all.
 *
 * THIS COOKIE ITSELF NEEDS NO CONSENT. Under ePrivacy a store used solely to
 * record the user's own privacy choice is strictly necessary — refusing to
 * remember a refusal would mean asking again on every page. It holds a policy
 * version and one bit; no identifier, nothing that can single a person out.
 *
 * Deliberately NOT the JSON record from localStorage: a cookie travels on every
 * request, so it stays a short opaque string, and it is never the source of
 * truth — `parseStoredConsent` still owns that. Format is
 * `<policy-version>.<0|1>`, e.g. `2026-09-08.1`. A value written under an older
 * policy version reads as no-consent, exactly as the localStorage record does.
 *
 * ROOM FOR A SECOND CATEGORY. Google Ads will need its own bit, so the format
 * is defined as `<policy-version>.<analytics>[.<further flags>]` and the reader
 * below matches on position rather than on the whole string. A cookie this
 * version writes therefore stays readable by a version that appends a flag, and
 * a flag a future version writes is ignored rather than fatal here. The one
 * constraint that buys: a policy version must never contain a `.`, because the
 * separator is what makes the segments addressable.
 */

/** Name of the mirror cookie. Read server-side; written by the client. */
export const CONSENT_COOKIE = 'gb_consent';

/**
 * Bump when the wording or the scope of what is collected changes: every
 * visitor is then asked again, because both readers reject an older version.
 * Adding an advertising category is such a change. Must not contain a `.` —
 * see the format note above.
 */
export const CONSENT_POLICY_VERSION = '2026-09-08';

/** A year, matching the other first-party cookies the site sets. */
export const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** `2026-09-08.1` when analytics was accepted, `2026-09-08.0` when refused. */
export function serialiseConsentCookie(analytics: boolean): string {
  return `${CONSENT_POLICY_VERSION}.${analytics ? '1' : '0'}`;
}

/**
 * Did this visitor accept non-essential analytics?
 *
 * Fails closed on everything else — absent, malformed, or written under a
 * superseded policy version all mean "no", so a caller can treat a `false` as
 * "do not store anything on this device" without a second check.
 */
export function analyticsConsentedFromCookie(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const [version, analytics] = raw.split('.');
  return version === CONSENT_POLICY_VERSION && analytics === '1';
}

/**
 * The `document.cookie` assignment for a choice.
 *
 * `SameSite=Lax` so it still arrives on the top-level navigation into
 * `/c/<code>` from an ambassador's link, which is the one request that has to
 * read it. `secure` is passed in rather than sniffed so this stays testable and
 * free of browser globals.
 */
export function consentCookieAssignment(analytics: boolean, secure: boolean): string {
  const parts = [
    `${CONSENT_COOKIE}=${serialiseConsentCookie(analytics)}`,
    'Path=/',
    `Max-Age=${CONSENT_COOKIE_MAX_AGE}`,
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
