import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-url';

/**
 * While the pre-launch site lock is on (src/lib/site-gate.ts),
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

  // Same constant sitemap.ts publishes under — the two must agree or crawlers
  // are pointed at a sitemap on a different host than the pages it lists.
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
