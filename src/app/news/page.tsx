import NewsPageClient from '@/components/news/news-page-client';
import { listGeoGuides, listGeoTopics } from '@/lib/geo-content';

export const metadata = {
  title: 'GLOWBAL News & Guides',
  description: 'Study-abroad news, generated guides, trending topics, and scholarship stories from Glowbal.',
};

export default function NewsPage() {
  const guides = listGeoGuides();
  const topics = listGeoTopics();

  return <NewsPageClient guides={guides} topics={topics} />;
}
