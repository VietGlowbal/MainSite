import type { Metadata } from 'next';
import UniversityDetailPage from '../../../universities/[id]/page';
import { getUniversityQueries } from '@/features/universities/api';
import type { University } from '@/lib/types';
import { SITE_URL } from '@/lib/site-url';
import { buildViLocaleAlternates } from '@/lib/seo/alternates';

export const revalidate = 43200;

async function loadUniversity(rawId: string): Promise<University | null> {
  const id = Number.parseInt(rawId, 10);
  if (!Number.isFinite(id)) return null;
  const university = await getUniversityQueries().getById(id);
  return (university as University | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const university = await loadUniversity((await params).id);
  if (!university) return { title: 'Không tìm thấy trường đại học | GlowBal' };

  const description =
    university.specific_insight?.slice(0, 155) ??
    `Tìm hiểu thông tin tuyển sinh, học phí, học bổng và các chương trình đào tạo tại ${university.name}.`;
  const title = `${university.name} - Thông Tin Tuyển Sinh & Học Bổng | GlowBal`;

  return {
    title,
    description,
    alternates: buildViLocaleAlternates(`/universities/${university.id}`),
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/vi/universities/${university.id}`,
      locale: 'vi_VN',
      alternateLocale: ['en_US'],
      images: university.image_url
        ? [{ url: university.image_url, alt: university.name }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: university.image_url ? [university.image_url] : undefined,
    },
  };
}

export default async function VietnameseUniversityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <UniversityDetailPage params={params} locale="vi" />;
}
