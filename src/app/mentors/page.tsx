import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { getApprovedMentors } from '@/lib/mentors';
import { MentorsClient } from './mentors-client';

/**
 * /mentors — "Tìm cố vấn", Figma 154:8345. The legacy /achievers route still
 * works (see redirect in src/app/achievers/page.tsx) so existing links and
 * deep-shared URLs continue to land users in the right place.
 *
 * The availability index the previous browse component shipped is gone with it:
 * 154:8345 draws no date filter, so nothing consumed it. The slot data is still
 * read per mentor on /mentors/[id], which is where booking happens.
 */

export const metadata: Metadata = {
  title: 'Find an advisor | GlowBal',
  description:
    'Talk to a student who has already been admitted where you are applying.',
};

export const revalidate = 300;

const getCachedApprovedMentors = unstable_cache(
  getApprovedMentors,
  ['approved-mentors'],
  { revalidate: 300 },
);

export default async function MentorsBrowsePage() {
  const mentors = await getCachedApprovedMentors({});

  return <MentorsClient mentors={mentors} />;
}
