import type { Metadata } from 'next';
import MentorDetailPage from '../../../mentors/[id]/page';
import { getPublicMentorById } from '@/lib/mentors';
import { SITE_URL } from '@/lib/site-url';
import { buildViLocaleAlternates } from '@/lib/seo/alternates';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const mentor = await getPublicMentorById((await params).id);
  if (!mentor) return { title: 'Không tìm thấy cố vấn | GlowBal' };

  const where = mentor.university?.name ? ` tại ${mentor.university.name}` : '';
  const description = mentor.bio?.slice(0, 155) ?? undefined;
  const canonicalUrl = `${SITE_URL}/vi/advisors/${mentor.id}`;
  const title = `${mentor.display_name} — Cố vấn ngành ${mentor.subject}${where} | GlowBal`;

  return {
    title,
    ...(description ? { description } : {}),
    alternates: buildViLocaleAlternates(`/advisors/${mentor.id}`),
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      locale: 'vi_VN',
      alternateLocale: ['en_US'],
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

export default async function VietnameseMentorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <MentorDetailPage params={params} locale="vi" />;
}
