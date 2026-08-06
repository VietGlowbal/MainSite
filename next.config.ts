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
  async redirects() {
    return [
      // Force the canonical custom domain. Anyone landing on the raw
      // *.vercel.app hostname gets a permanent redirect to
      // glowbal-education.com, so the URL bar always reads the brand domain.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'main-site-seven-opal.vercel.app' }],
        destination: 'https://glowbal-education.com/:path*',
        permanent: true,
      },
      /*
       * /guides -> /news, permanently.
       *
       * The two routes rendered the same listGeoGuides() data through two
       * designs; they were merged on 31/07 and /news is the surviving URL.
       * These entries are not tidiness — every article published so far has
       * shipped a /guides/<slug> canonical URL in content/geo/metadata/*.json
       * and in the sitemap, so those addresses are indexed and are what any
       * inbound link points at. A 308 is what carries that ranking over.
       *
       * Order matters: the :slug rule is listed first because Next matches
       * top-down and the bare /guides rule would otherwise be unreachable for
       * nothing — they do not overlap, but keeping the specific one first is
       * the habit that stops the next edit from breaking it.
       */
      { source: '/guides/:slug', destination: '/news/:slug', permanent: true },
      { source: '/guides', destination: '/news', permanent: true },
      /*
       * /my-universities -> /apply, permanently.
       *
       * The saved list and the applications tracker were two halves of one
       * journey on two URLs; Figma 562:15078 draws them as one page and /apply
       * is the surviving address (its /apply/[applicationId] workspace already
       * lives under it). src/proxy.ts sent every fresh sign-in to
       * /my-universities for months, so that URL is in browser histories and
       * bookmarks — a 308 is what carries them over.
       *
       * EXACT SOURCE, deliberately no /:path*. The children did NOT move:
       * /my-universities/program is the subject picker the merged page links
       * to, and /my-universities/[id] + /[id]/writer are the legacy task pages.
       * A wildcard here would redirect all three into a page that cannot serve
       * them.
       */
      { source: '/my-universities', destination: '/apply', permanent: true },
      /*
       * ⚠️ /how-it-works -> /ai-strategy IS GONE (03/08, owner). Both routes are
       * real pages again, and they are not the same page:
       *
       *   /how-it-works  the help page for the product — three stages,
       *                  fourteen steps. Reached from the top nav.
       *   /ai-strategy   stage 3, the Strategy, on its own.
       *
       * The redirect existed because an older /how-it-works taught the
       * pre-01/08 flow ("copy a course URL, paste it on GlowBal Apply") and
       * disagreed with /ai-strategy about how the product worked. Folding them
       * into one page fixed that by deletion; the split re-separates the pages
       * but keeps the fix, because both now render the same content file
       * (features/marketing/domain/strategy-guide.ts) instead of describing the
       * product in their own words. Do not restore this entry — it would take
       * the nav's own destination and 308 it away.
       *
       * ⚠️ It was `permanent: true`, so browsers that followed it have it cached
       * and will keep skipping the new page until the entry expires or the
       * visitor hard-reloads. Pre-launch, so the blast radius is small; if a
       * link looks broken this is the first thing to check.
       */
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
      // Campus photography currently referenced by a curated university row.
      { protocol: 'https', hostname: 'wp.technologyreview.com' },
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
