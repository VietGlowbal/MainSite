/**
 * The canonical public origin of the site, with no trailing slash.
 *
 * ONE source, because there were three. Before 31/07 the codebase named the
 * site under three different hostnames, none of which agreed:
 *
 *   - `https://glowbal.co`  — sitemap.ts, robots.ts, and the Article/Breadcrumb
 *     JSON-LD on every news article
 *   - `https://glowbal.com` — the unsubscribe link in the two newsletter emails
 *   - `https://glowbal-education.com` — the real domain, which next.config.ts
 *     already 308s the raw *.vercel.app hostname onto
 *
 * The owner confirmed on 31/07 that **glowbal-education.com is the only real
 * domain** and glowbal.co does not exist. That made the first two live bugs,
 * not cosmetic drift: a canonical URL and a `BreadcrumbList` pointing at a
 * hostname that does not resolve tells search engines the article lives
 * somewhere unreachable, and the unsubscribe link in a sent email was a dead
 * address — which is a compliance problem, not just a broken link.
 *
 * `NEXT_PUBLIC_SITE_URL` still wins where it is set, so preview deploys and
 * local runs describe themselves accurately. The literal below is the fallback
 * for the places that have no request to read an origin from — `sitemap.ts`,
 * `robots.ts` and `generateMetadata`, all of which run without one.
 *
 * ⚠️ Anything that DOES have a request (an auth callback, a Stripe return URL)
 * should keep preferring the request origin over this constant; see
 * `resolveRequestOrigin` below.
 */

const FALLBACK_ORIGIN = 'https://glowbal-education.com';

function resolveSiteUrl(): string {
  let value = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
  if (!value) return FALLBACK_ORIGIN;
  // Accept a bare hostname in the env var, the way resolveRequestOrigin() does —
  // "glowbal-education.com" and "localhost:3000" are both things people set.
  if (!/^https?:\/\//i.test(value)) {
    value = `${value.startsWith('localhost') ? 'http' : 'https'}://${value}`;
  }
  return value;
}

export const SITE_URL = resolveSiteUrl();

/**
 * The origin to redirect a specific request back to — an auth callback, an
 * email-confirmation link. Unlike `SITE_URL` above, this prefers the
 * request's own origin over `NEXT_PUBLIC_SITE_URL`, except on the actual
 * production deploy.
 *
 * `NEXT_PUBLIC_SITE_URL` is one shared env var across every Vercel
 * environment in this project, so using it unconditionally canonicalises
 * EVERY environment onto the production custom domain — including preview
 * builds, where it silently bounces a tester's sign-in (OAuth, magic link,
 * email confirmation) off the preview they started on and onto the live
 * site, making any authenticated flow untestable on a preview deploy. That
 * was the bug behind `canonicalOrigin` in `auth/callback/route.ts` and the
 * near-identical `siteOrigin` in `api/auth/signup/route.ts` — both now call
 * this instead of keeping their own copy.
 *
 * `VERCEL_ENV` is set automatically by Vercel to 'production' | 'preview' |
 * 'development'; it is unset off Vercel (local `next start`, another host),
 * where "NEXT_PUBLIC_SITE_URL if set, else the request origin" is still the
 * right behaviour — same as before this function existed.
 */
export function resolveRequestOrigin(requestOrigin: string): string {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv && vercelEnv !== 'production') return requestOrigin;

  let value = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
  if (value && !/^https?:\/\//i.test(value)) {
    value = `${value.startsWith('localhost') ? 'http' : 'https'}://${value}`;
  }
  return value || requestOrigin;
}
