import { listGeoGuides, listGeoTopics } from '@/lib/geo-content';
import { GuidesClient } from './guides-client';

export const metadata = {
  title: 'Glowbal Guides - Study-abroad guides & insights',
  description: 'Expert insights, real student stories, and practical guides to help you plan, apply and succeed.',
};

export const revalidate = 300;

export default async function GuidesIndexPage() {
  const [allGuides, topics] = await Promise.all([listGeoGuides(), listGeoTopics()]);

  return <GuidesClient allGuides={allGuides} topics={topics} />;
}
