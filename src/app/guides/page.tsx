import { listGeoGuides, listGeoTopics } from '@/lib/geo-content';
import { GuidesClient } from './guides-client';

export const metadata = {
  title: 'Glowbal Guides - Study-abroad guides & insights',
  description: 'Expert insights, real student stories, and practical guides to help you plan, apply and succeed.',
};

export default function GuidesIndexPage() {
  const allGuides = listGeoGuides();
  const topics = listGeoTopics();

  return <GuidesClient allGuides={allGuides} topics={topics} />;
}
