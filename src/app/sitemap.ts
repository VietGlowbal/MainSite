import type { MetadataRoute } from 'next';
import { getUniversityQueries } from '@/features/universities/api';
import { listGeoGuides } from '@/lib/geo-content';
import { SITE_URL } from '@/lib/site-url';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;
  const staticRoutes: MetadataRoute.Sitemap = [
    '',
    '/news',
    '/universities',
    '/advisors',
    '/apply',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: route === '' ? 1 : 0.7,
  }));

  const guides = await listGeoGuides();
  const guideRoutes: MetadataRoute.Sitemap = guides.map((guide) => ({
    url: `${baseUrl}/news/${guide.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: guide.status === 'published' ? 0.8 : 0.6,
  }));

  /*
   * The 97 university detail pages (Figma 375:10629). They are keyed on the
   * numeric id because `universities` has no slug column — when slugs land,
   * these URLs change and the sitemap has to change with them.
   *
   * A failure here must not take the whole sitemap down: a missing section is
   * recoverable, a 500 on /sitemap.xml is not.
   */
  const universityRoutes: MetadataRoute.Sitemap = [];
  try {
    /*
     * Paged, not one big request. `list()` clamps pageSize to
     * UNIVERSITY_PAGE_SIZE_MAX (60) and does NOT report that it clamped, so
     * asking for 200 silently returns 60 — a sitemap missing 37 of 97 pages
     * with nothing anywhere to say so.
     *
     * Two round trips at today's row count. `listAllForLegacyExplorer` would do
     * it in one, but it is deprecated with "do not add callers" on it.
     */
    const queries = getUniversityQueries();
    for (let page = 1; ; page += 1) {
      const { items, hasMore } = await queries.list({ page, pageSize: 60 });
      for (const university of items) {
        universityRoutes.push({
          url: `${baseUrl}/universities/${university.id}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.6,
        });
      }
      // `hasMore` is the loop's only exit — guard on an empty page too, so a
      // repository that ever gets `hasMore` wrong cannot spin forever.
      if (!hasMore || items.length === 0) break;
    }
  } catch (error) {
    console.error('[sitemap] university routes failed:', error);
  }

  return [...staticRoutes, ...guideRoutes, ...universityRoutes];
}
