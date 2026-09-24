import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getPublicMentorById,
  getPublicMentorReviews,
  getPublicMentorSlots,
} from '@/lib/mentors';
import { getServerIdentity } from '@/server/auth/server-identity';
import { SITE_URL } from '@/lib/site-url';
import { buildAdvisorJsonLd, serializeJsonLd } from '@/lib/seo/json-ld';
import { buildLocaleAlternates } from '@/lib/seo/alternates';
import { MentorDetail } from './mentor-detail';
import type { Locale } from '@/lib/i18n/locale';

/**
 * /mentors/[id] — Figma 375:21633 "Detail cố vấn" (1440x1823).
 * Canonical public URL is /advisors/[id].
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
  const canonicalUrl = `${SITE_URL}/advisors/${mentor.id}`;
  const title = `${mentor.display_name} — ${mentor.subject}${where} | GlowBal`;

  return {
    title,
    ...(description ? { description } : {}),
    alternates: buildLocaleAlternates(`/advisors/${mentor.id}`),
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      images: mentor.avatar_url ? [{ url: mentor.avatar_url, alt: mentor.display_name }] : undefined,
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: mentor.avatar_url ? [mentor.avatar_url] : undefined,
    },
  };
}

export default async function MentorDetailPage({
  params,
  locale = 'en',
}: {
  params: Promise<{ id: string }>;
  locale?: Locale;
}) {
  const { id } = await params;

  const mentor = await getPublicMentorById(id);
  if (!mentor) notFound();

  const [{ identity: user }, slots, { reviews, count }] = await Promise.all([
    getServerIdentity(),
    getPublicMentorSlots(id),
    getPublicMentorReviews(id),
  ]);

  const userName = user?.name ?? null;

  const jsonLd = buildAdvisorJsonLd({
    name: mentor.display_name,
    url: `${SITE_URL}/advisors/${mentor.id}`,
    subject: mentor.subject,
    universityName: mentor.university?.name ?? null,
    bio: mentor.bio,
    imageUrl: mentor.avatar_url,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <MentorDetail
        mentor={mentor}
        slots={slots}
        reviews={reviews}
        reviewCount={count}
        isSignedIn={!!user}
        userName={userName}
        userAvatarUrl={user?.avatarUrl ?? null}
        locale={locale}
      />
    </>
  );
}
