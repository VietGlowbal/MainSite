import type { MetadataRoute } from 'next';
import { getUniversityQueries } from '@/features/universities/api';
import { listGeoGuides } from '@/lib/geo-content';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://glowbal.co';
  const staticRoutes: MetadataRoute.Sitemap = [
    '',
    '/guides',
    '/universities',
    '/mentors',
    '/apply',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: route === '' ? 1 : 0.7,
  }));

  const guides = await listGeoGuides();
  const guideRoutes: MetadataRoute.Sitemap = guides.map((guide) => ({
    url: `${baseUrl}/guides/${guide.slug}`,
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
  let universityRoutes: MetadataRoute.Sitemap = [];
  try {
    const { items } = await getUniversityQueries().list({ page: 1, pageSize: 200 });
    universityRoutes = items.map((university) => ({
      url: `${baseUrl}/universities/${university.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    }));
  } catch (error) {
    console.error('[sitemap] university routes failed:', error);
  }

  return [...staticRoutes, ...guideRoutes, ...universityRoutes];
}
