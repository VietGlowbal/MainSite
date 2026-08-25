import type { MetadataRoute } from 'next';
import { getUniversityQueries } from '@/features/universities/api';
import { listGeoGuides } from '@/lib/geo-content';
import { SITE_URL } from '@/lib/site-url';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  // 1. Static public marketing pages (both EN canonical and VI localized equivalents with reciprocal alternates)
  const staticPathConfigs = [
    { path: '', priority: 1.0, changeFrequency: 'daily' as const },
    { path: '/about', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/how-it-works', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/news', priority: 0.8, changeFrequency: 'daily' as const },
    { path: '/universities', priority: 0.8, changeFrequency: 'weekly' as const },
    { path: '/advisors', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/scholarships', priority: 0.8, changeFrequency: 'weekly' as const },
  ];

  const staticRoutes: MetadataRoute.Sitemap = [];
  for (const { path, priority, changeFrequency } of staticPathConfigs) {
    const enUrl = `${baseUrl}${path}`;
    const viUrl = `${baseUrl}/vi${path}`;
    const alternates = {
      languages: {
        en: enUrl,
        vi: viUrl,
      },
    };

    staticRoutes.push({
      url: enUrl,
      priority,
      changeFrequency,
      alternates,
    });
    staticRoutes.push({
      url: viUrl,
      priority,
      changeFrequency,
      alternates,
    });
  }

  // 2. Published GEO News articles with honest modified dates
  const guides = await listGeoGuides();
  const guideRoutes: MetadataRoute.Sitemap = [];
  for (const guide of guides) {
    if (guide.status !== 'published') continue;
    const dateStr = guide.updatedAt || guide.publishedAt;
    const lastModified = dateStr ? new Date(dateStr) : undefined;
    const enUrl = `${baseUrl}/news/${guide.slug}`;
    const viUrl = `${baseUrl}/vi/news/${guide.slug}`;
    const alternates = {
      languages: {
        en: enUrl,
        vi: viUrl,
      },
    };

    guideRoutes.push({
      url: enUrl,
      ...(lastModified && !Number.isNaN(lastModified.getTime()) ? { lastModified } : {}),
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates,
    });
    guideRoutes.push({
      url: viUrl,
      ...(lastModified && !Number.isNaN(lastModified.getTime()) ? { lastModified } : {}),
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates,
    });
  }

  /*
   * 3. The university detail pages.
   * Paged request avoiding silent clamping by list() limit.
   */
  const universityRoutes: MetadataRoute.Sitemap = [];
  try {
    const queries = getUniversityQueries();
    for (let page = 1; ; page += 1) {
      const { items, hasMore } = await queries.list({ page, pageSize: 60 });
      for (const university of items) {
        const enUrl = `${baseUrl}/universities/${university.id}`;
        const viUrl = `${baseUrl}/vi/universities/${university.id}`;
        const alternates = {
          languages: {
            en: enUrl,
            vi: viUrl,
          },
        };
        universityRoutes.push({
          url: enUrl,
          changeFrequency: 'weekly',
          priority: 0.6,
          alternates,
        });
        universityRoutes.push({
          url: viUrl,
          changeFrequency: 'weekly',
          priority: 0.6,
          alternates,
        });
      }
      if (!hasMore || items.length === 0) break;
    }
  } catch (error) {
    console.error('[sitemap] university routes failed:', error);
  }

  return [...staticRoutes, ...guideRoutes, ...universityRoutes];
}
