import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  /**
   * Hide the dev-only route indicator badge.
   *
   * Not cosmetic: `playwright.config.ts` sets `reuseExistingServer: !CI`, so a
   * local E2E run attaches to whatever is already on :3000. If that happens to
   * be `next dev`, every full-page screenshot picks up the badge in the
   * bottom-left corner — and a baseline recorded that way then fails on CI,
   * which always builds production and has no badge. That is exactly how a
   * 38x38 dev artifact ended up committed into the Home baselines.
   *
   * Errors and build failures are still surfaced; only the badge is hidden.
   */
  devIndicators: false,
  turbopack: {
    root: __dirname,
  },
  // Keep the PDF text-extraction lib (bundles its own pdf.js) out of the
  // server bundle so it loads reliably from node_modules at runtime.
  serverExternalPackages: ['unpdf'],
  // Tree-shake large UI libraries so routes only bundle the bits they use
  // instead of importing the whole package barrel.
  experimental: {
    optimizePackageImports: ['framer-motion', 'gsap', '@gsap/react'],
  },
  // Force the canonical custom domain. Anyone landing on the raw
  // *.vercel.app hostname gets a permanent redirect to glowbal-education.com,
  // so the URL bar always reads the brand domain.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'main-site-seven-opal.vercel.app' }],
        destination: 'https://glowbal-education.com/:path*',
        permanent: true,
      },
    ];
  },
  images: {
    /**
     * Next 16 changed the default from "any quality" to `[75]`, and a `quality`
     * prop outside the allowlist is silently coerced to the nearest entry
     * rather than erroring. So `<GlowbalLogo>`'s documented `quality={90}` was
     * being served as q=75 — the exact artefacting that prop exists to avoid.
     * 90 is here for the wordmark (a gradient with thin counters) and the
     * contact photograph; everything else stays on the 75 default.
     * See node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md.
     */
    qualities: [75, 90],
    remotePatterns: [
      // Wikipedia / Wikimedia thumbnails — used for university card cover images
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'commons.wikimedia.org' },
      { protocol: 'https', hostname: 'en.wikipedia.org' },
      // Supabase Storage — uploaded avatars and student documents
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      // OAuth provider avatars (Google profile pictures)
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // Unsplash CDNs — used as a fallback when two universities resolve
      // to the same Wikipedia city image (see seed-university-images.mjs).
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'source.unsplash.com' },
      // Google favicons — used as a no-key logo fallback for universities
      // whose Wikidata logo claims are missing.
      { protocol: 'https', hostname: 'www.google.com' },
      // Google Drive thumbnails — team photos stored as Drive links are
      // rewritten to drive.google.com/thumbnail (see normalizeDriveImageUrl);
      // the endpoint redirects to lh3.googleusercontent.com (already allowed).
      { protocol: 'https', hostname: 'drive.google.com' },
      // VinUni press / partner imagery host — used for VinUniversity logo
      // and campus photography on /universities/vinuni.
      { protocol: 'https', hostname: 'unicons.vn' },
      { protocol: 'https', hostname: 'vinuni.edu.vn' },
      // Profile photos referenced from seeded/imported data.
      { protocol: 'https', hostname: 'lapslie.com' },
    ],
  },
};

export default nextConfig;
