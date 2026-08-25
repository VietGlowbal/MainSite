import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site-url';
import { buildLocaleAlternates } from '@/lib/seo/alternates';
import { listGeoGuides, listGeoTopics } from '@/lib/geo-content';
import { NewsClient } from './news-client';

export const metadata: Metadata = {
  title: 'Study Abroad Guides, Insights & News | GlowBal',
  description:
    'Read actionable guides on study abroad costs, scholarship application strategies, visa requirements, and student success stories.',
  keywords: [
    'study abroad guides',
    'scholarship application tips',
    'international student costs',
    'study in uk',
    'study in us',
    'kinh nghiệm du học',
  ],
  alternates: buildLocaleAlternates('/news'),
  openGraph: {
    title: 'Study Abroad Guides, Insights & News | GlowBal',
    description:
      'Read actionable guides on study abroad costs, scholarship application strategies, visa requirements, and student success stories.',
    url: `${SITE_URL}/news`,
  },
};

// Re-render at most every 5 minutes; admin edits trigger on-demand
// revalidation (see /api/admin/news) so changes appear within seconds.
export const revalidate = 300;

export default async function NewsPage() {
  const [allGuides, topics] = await Promise.all([listGeoGuides(), listGeoTopics()]);

  return <NewsClient allGuides={allGuides} topics={topics} />;
}
