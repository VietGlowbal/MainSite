/**
 * Attributes for the Supabase session cookies (`sb-<ref>-auth-token*`).
 *
 * Passed as `cookieOptions` to all three clients — `src/proxy.ts`,
 * `src/server/db/server.ts` and `src/lib/supabase/client.ts`. They must agree:
 * every one of them rewrites the cookie on token refresh, so a client left on
 * the library defaults would strip `Secure` again on the next refresh.
 *
 * WHY `Secure`. `@supabase/ssr` sets no `Secure` attribute by default, so the
 * cookie was eligible to travel over plain http. HSTS and the http → https 308
 * already keep the browser off http in practice; this makes the cookie refuse
 * it too, including on a first visit before HSTS is cached.
 *
 * ⚠️ DO NOT "HARDEN" THESE TWO FURTHER — both were proposed in a security review
 * (2026-09-14) and both break sign-in:
 *
 * - `sameSite: 'strict'` withholds the cookie on any navigation that arrives
 *   from another site. Google sign-in returns through `supabase.co` to
 *   `/auth/callback`, so the PKCE code-verifier cookie is missing and
 *   `exchangeCodeForSession` fails. Links from Gmail and the Stripe/VNPay
 *   returns would land signed-out. `lax` already withholds it on cross-site
 *   POST, fetch and iframes, which is what CSRF needs.
 * - `httpOnly: true` hides the session from `createBrowserClient`, which reads
 *   and writes it through `document.cookie`. Every browser-side query would go
 *   out anonymous and RLS would return nothing, and JS cannot overwrite an
 *   HttpOnly cookie, so refreshed tokens would be dropped. Getting there means
 *   moving all browser-side Supabase calls to the server first.
 *
 * No `name`: supplying one renames the cookie and signs every user out.
 * No `maxAge`: the library pins it to 400 days regardless, and clearing a
 * browser cookie early would not revoke the refresh token anyway — session
 * lifetime is a Supabase Auth setting, not a cookie attribute.
 */
export interface SupabaseAuthCookieOptions {
  path: '/';
  sameSite: 'lax';
  secure: boolean;
}

/**
 * `secure` is passed in rather than read from the environment so this stays
 * testable — the same shape as `consentCookieAssignment`.
 */
export function supabaseAuthCookieOptions(secure: boolean): SupabaseAuthCookieOptions {
  return { path: '/', sameSite: 'lax', secure };
}

/**
 * What the clients use. Off in development: Safari will not store a `Secure`
 * cookie on http://localhost (Chromium and Firefox will).
 */
export const SUPABASE_AUTH_COOKIE_OPTIONS = supabaseAuthCookieOptions(
  process.env.NODE_ENV === 'production',
);
