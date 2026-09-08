import { NextResponse, type NextRequest } from 'next/server';

/**
 * First-party proxy for the university logo fallback.
 *
 *   GET /api/university-logo?domain=ox.ac.uk
 *
 * WHY THIS EXISTS. `wiki-images.ts` falls back to Google's free
 * `s2/favicons` endpoint when a university has no Wikidata logo claim, and the
 * URL it produced was stored in `universities.logo_url` and rendered directly
 * in a plain `<img>`. Every card carrying such a logo therefore made the
 * student's browser call `www.google.com` — a third-party request, with their
 * IP and our Referer, on pages an anonymous visitor sees before answering the
 * cookie banner, and one Google can set a cookie on. Routing it through our own
 * origin means the browser only ever talks to us; the outbound call to Google
 * happens server-side, where it carries the server's IP and no visitor cookie.
 *
 * This is deliberately NOT a general-purpose image proxy: it takes a domain,
 * not a URL, and builds the upstream itself. A `?url=` parameter would be an
 * SSRF surface, and would let any caller use us to launder requests to
 * arbitrary hosts.
 */

export const runtime = 'nodejs';
// Favicons change on the order of a rebrand. Cache hard.
export const revalidate = 86400;

/** Hostname shape: labels of alphanumerics/hyphens, at least one dot. */
const DOMAIN =
  /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Upstream for a validated domain. Google returns a PNG at the asked size. */
export function faviconUpstream(domain: string): string {
  return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`;
}

/** Accepts only what can appear in `logo_url`; rejects paths, ports, IPs, creds. */
export function isProxyableDomain(value: string | null): value is string {
  if (!value) return false;
  const domain = value.trim().toLowerCase();
  if (!DOMAIN.test(domain)) return false;
  // A bare IP literal is never a university domain and is the shape an SSRF
  // attempt takes, so refuse it even though the regex above would allow it.
  return !/^\d+\.\d+\.\d+\.\d+$/.test(domain);
}

export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get('domain');
  if (!isProxyableDomain(domain)) {
    return NextResponse.json({ error: 'invalid_domain' }, { status: 400 });
  }

  try {
    const upstream = await fetch(faviconUpstream(domain.trim().toLowerCase()), {
      // No cookies, no credentials — this must not carry anything of ours.
      cache: 'force-cache',
      signal: AbortSignal.timeout(5_000),
    });

    /*
     * "Google has no favicon for this domain" is not an error, and must not be
     * served as one. The endpoint 301s to t1.gstatic.com, which answers an
     * unknown domain with 404 AND a generic grey-globe PNG in the body — a
     * plain `<img>` renders that body regardless of the status, which is why
     * three universities (ed.ac.uk, u-tokyo.ac.jp, unibocconi.it) show Google's
     * placeholder today rather than a crest. Passing it through would keep
     * showing another company's placeholder inside our card; 404 instead lets
     * the caller's own `onError` fall back to the initials mark it already has.
     *
     * Cached briefly so a missing favicon does not re-ask Google on every
     * render, but far shorter than a hit — a university that adds a favicon
     * should appear within the day, not after a week.
     */
    if (upstream.status === 404) {
      return NextResponse.json(
        { error: 'no_favicon' },
        { status: 404, headers: { 'Cache-Control': 'public, s-maxage=3600' } },
      );
    }

    const contentType = upstream.headers.get('content-type') ?? '';
    if (!upstream.ok || !contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'upstream_failed' }, { status: 502 });
    }

    return new NextResponse(await upstream.arrayBuffer(), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        // Nothing here should ever be interpreted as anything but an image.
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    // A dead favicon must not break a card — the callers already render an
    // initials placeholder when the image fails to load.
    return NextResponse.json({ error: 'upstream_failed' }, { status: 502 });
  }
}
