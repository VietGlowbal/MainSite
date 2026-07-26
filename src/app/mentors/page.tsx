import type { Metadata } from 'next';
import { getApprovedMentors } from '@/lib/mentors';
import { createClient } from '@/lib/supabase/server';
import { MentorsClient } from './mentors-client';

type Props = {
  searchParams: Promise<{ university?: string; country?: string; date?: string }>;
};

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
  title: 'Find a mentor | GlowBal',
  description:
    'Talk to a student who has already been admitted where you are applying.',
};

export default async function MentorsBrowsePage({ searchParams }: Props) {
  const params = await searchParams;
  const initialUniversityId = params.university ? Number(params.university) : undefined;

  const supabase = await createClient();
  const [mentors, { data: authData }] = await Promise.all([
    getApprovedMentors({
      university_id: initialUniversityId,
      country: params.country,
      available_from: params.date,
    }),
    supabase.auth.getUser(),
  ]);

  const user = authData?.user ?? null;
  const userName = user
    ? (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || null
    : null;
  const userAvatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? null;

  return (
    <MentorsClient
      mentors={mentors}
      initialUniversityId={initialUniversityId}
      userName={userName}
      userAvatarUrl={userAvatarUrl}
    />
  );
}
