import NewsPageClient from '@/components/news/news-page-client';
import { listGeoGuides, listGeoTopics } from '@/lib/geo-content';

export const metadata = {
  title: 'GLOWBAL News & Guides',
  description: 'Study-abroad news, generated guides, trending topics, and scholarship stories from Glowbal.',
};

// Re-render at most every 5 minutes; admin edits trigger on-demand
// revalidation (see /api/admin/news) so changes appear within seconds.
export const revalidate = 300;

export default async function NewsPage() {
  const [guides, topics] = await Promise.all([listGeoGuides(), listGeoTopics()]);

  return <NewsPageClient guides={guides} topics={topics} />;
}
