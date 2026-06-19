import type { MetadataRoute } from 'next';
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

  return [...staticRoutes, ...guideRoutes];
}
