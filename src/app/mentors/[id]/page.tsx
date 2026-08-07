import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getPublicMentorById,
  getPublicMentorReviews,
  getPublicMentorSlots,
} from '@/lib/mentors';
import { createClient } from '@/lib/supabase/server';
import { MentorDetail } from './mentor-detail';

/**
 * /mentors/[id] — Figma 375:21633 "Detail cố vấn" (1440x1823).
 *
 * Replaces the legacy `src/components/mentorship/MentorProfile.tsx`, which this
 * route rendered inside the app chrome. Two things were wrong with that page
 * beyond its styling, and both are fixed by the reads this file now uses — see
 * the long note on `getPublicMentorById` in src/lib/mentors.ts:
 *
 *   - it 404'd for every signed-out visitor, because all three tables grant
 *     SELECT only `to authenticated` and RLS returning nothing is not an error;
 *   - it passed a `select('*')` row into a `'use client'` component, putting
 *     `legal_name`, `date_of_birth`, `stripe_account_id` and the four
 *     verification-document storage keys in the page payload.
 *
 * NOT statically revalidated. The booking calendar is the substance of the page
 * and open slots change whenever a session is bought, so a 12h cache like
 * /universities/[id] would show times that are already sold.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const mentor = await getPublicMentorById((await params).id);
  if (!mentor) return { title: 'Advisor not found | GlowBal' };

  const where = mentor.university?.name ? ` at ${mentor.university.name}` : '';
  // `bio` is the mentor's own words and the only prose on the row, so it is
  // trimmed rather than reworded.
  const description = mentor.bio?.slice(0, 155) ?? undefined;

  return {
    title: `${mentor.display_name} — ${mentor.subject}${where} | GlowBal`,
    ...(description ? { description } : {}),
  };
}

export default async function MentorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const mentor = await getPublicMentorById(id);
  if (!mentor) notFound();

  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    slots,
    { reviews, count },
  ] = await Promise.all([
    supabase.auth.getUser(),
    getPublicMentorSlots(id),
    getPublicMentorReviews(id),
  ]);

  const userName =
    (user?.user_metadata?.full_name as string | undefined) || user?.email?.split('@')[0] || null;

  return (
    <MentorDetail
      mentor={mentor}
      slots={slots}
      reviews={reviews}
      reviewCount={count}
      isSignedIn={!!user}
      userName={userName}
      userAvatarUrl={(user?.user_metadata?.avatar_url as string | undefined) ?? null}
    />
  );
}
