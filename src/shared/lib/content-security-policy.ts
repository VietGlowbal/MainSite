/**
 * The Content Security Policy, built once per page request by `src/proxy.ts`.
 *
 * WHY PER REQUEST. Next's App Router inlines its hydration payload as
 * `<script>` tags. Without `'unsafe-inline'` those only run if they carry a
 * nonce, and a nonce is only worth anything if it is fresh for every response.
 * Next reads the nonce back off the request's `Content-Security-Policy` header
 * while rendering and stamps it on its own scripts — that is why the proxy puts
 * the policy on the forwarded request as well as on the response.
 *
 * This costs no caching: the root layout reads `headers()`, so every page was
 * already rendered per request (`private, no-store`, `X-Vercel-Cache: MISS` on
 * `/`, `/universities`, `/news` and others, measured 2026-09-14).
 *
 * TWO HEADERS, ON PURPOSE (2026-09-14):
 *
 * - ENFORCED — what stops injected script (`script-src`, `object-src`,
 *   `base-uri`), plus two directives that cannot break a page:
 *   `frame-ancestors` (the same rule X-Frame-Options already enforces) and
 *   `upgrade-insecure-requests` (browsers ignore it in a report-only policy,
 *   so it only ever takes effect here). The script rules are the XSS control;
 *   they are what makes a stolen `document.cookie` hard to reach
 *   (docs/known-issues.md §0k).
 * - REPORT-ONLY — the origin allowlists (`img-src`, `connect-src`, `frame-src`,
 *   `style-src`, `form-action` …). They have never been checked against real
 *   traffic: the old report-only header had no reporting endpoint, so it
 *   collected nothing. Enforcing a wrong image or Supabase origin breaks a page
 *   for everyone; promote them only after the browser console, or a reporting
 *   endpoint, has shown them clean.
 *
 * ⚠️ DO NOT add a static `Content-Security-Policy` in next.config.ts. Browsers
 * enforce every CSP header they receive, so a second one without the nonce
 * blocks all of Next's inline scripts and the site stops hydrating.
 */

/** Request header the root layout reads the nonce from. */
export const NONCE_HEADER = 'x-nonce';

/** 128 bits from the platform CSPRNG, base64. Works in Node and the edge. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export interface ContentSecurityPolicy {
  nonce: string;
  enforced: string;
  reportOnly: string;
}

/**
 * The allowlists, observed but not enforced. Origins are not guesses:
 * `connect-src` covers Supabase REST/Auth/Realtime (wss), Vercel's analytics
 * beacon and GA4; `img-src` mirrors `images.remotePatterns` in next.config.ts;
 * `frame-src` exists for the document preview drawer, which previews stored
 * PDFs in an `<iframe>` (features/apply/ui/document-preview-drawer.tsx). Fonts
 * are self-hosted by `next/font/google` at build time.
 *
 * `style-src` keeps `'unsafe-inline'` even once enforced: a nonce cannot cover
 * `style="…"` attributes, which React renders throughout the app, and injected
 * CSS cannot run code.
 */
const REPORT_ONLY_DIRECTIVES = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://upload.wikimedia.org https://commons.wikimedia.org https://en.wikipedia.org https://lh3.googleusercontent.com https://images.unsplash.com https://source.unsplash.com https://wp.technologyreview.com https://www.google.com https://drive.google.com https://unicons.vn https://vinuni.edu.vn https://lapslie.com https://www.googletagmanager.com https://*.google-analytics.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in https://vitals.vercel-insights.com https://va.vercel-scripts.com https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com",
  "frame-src 'self' blob: https://*.supabase.co",
  "form-action 'self'",
];

export function buildContentSecurityPolicy({
  nonce,
  isDev,
}: {
  nonce: string;
  isDev: boolean;
}): ContentSecurityPolicy {
  const scriptSrc = [
    'script-src',
    `'nonce-${nonce}'`,
    // Scripts a trusted script loads — Next's chunk loader, gtag.js, Vercel
    // Analytics — are trusted in turn, so no host list has to be kept in step.
    "'strict-dynamic'",
    // Only for Safari 10–15.3, which honours nonces but not 'strict-dynamic':
    // it lets those browsers still load Next's same-origin chunks. Browsers
    // that understand 'strict-dynamic' ignore it.
    //
    // Deliberately NO `'unsafe-inline'` or `https:` fallback, the usual advice
    // for pre-nonce browsers. Every browser that can run this ES2022 bundle
    // supports nonces, so the fallback would protect no one — and it reads as
    // "unsafe-inline is active" to a reviewer or scanner (2026-09-14).
    "'self'",
    // React uses eval for dev-only error overlays. Production needs none: the
    // one eval in the client bundle is asn1.js's `vm.runInThisContext`, which
    // is wrapped in try/catch with a plain-function fallback.
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(' ');

  const scriptDirectives = [scriptSrc, "object-src 'none'", "base-uri 'self'"];

  return {
    nonce,
    enforced: [...scriptDirectives, "frame-ancestors 'self'", 'upgrade-insecure-requests'].join('; '),
    // Repeats the script directives so the report-only policy does not fall
    // back to `default-src 'self'` for scripts and report every one of them.
    // `upgrade-insecure-requests` is NOT repeated: browsers ignore it in
    // report-only and log a warning saying so.
    reportOnly: [...scriptDirectives, ...REPORT_ONLY_DIRECTIVES].join('; '),
  };
}
