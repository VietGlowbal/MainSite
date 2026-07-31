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
 * `canonicalOrigin` in src/app/auth/callback/route.ts.
 */

const FALLBACK_ORIGIN = 'https://glowbal-education.com';

function resolveSiteUrl(): string {
  let value = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
  if (!value) return FALLBACK_ORIGIN;
  // Accept a bare hostname in the env var, the way canonicalOrigin() does —
  // "glowbal-education.com" and "localhost:3000" are both things people set.
  if (!/^https?:\/\//i.test(value)) {
    value = `${value.startsWith('localhost') ? 'http' : 'https'}://${value}`;
  }
  return value;
}

export const SITE_URL = resolveSiteUrl();
