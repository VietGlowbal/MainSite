import type { MetadataRoute } from 'next';

/**
 * While the pre-launch site lock is on (LAUNCH_PLAN.md, src/lib/site-gate.ts),
 * every crawler gets told to stay out — a half-redesigned site sitting behind
 * a "coming soon" gate has nothing worth indexing, and letting it in risks a
 * stale/thin page getting ranked before launch. Reverts to the normal
 * allow-everything crawl the moment SITE_LOCK_ENABLED is unset.
 */
export default function robots(): MetadataRoute.Robots {
  const locked = process.env.SITE_LOCK_ENABLED === '1';

  if (locked) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  // Matches the domain sitemap.ts already publishes under.
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://glowbal.co/sitemap.xml',
  };
}
