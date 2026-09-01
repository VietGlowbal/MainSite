import type { Metadata } from 'next';
import UniversitiesPage from '../../universities/page';
import type { UniversityRawSearchParams } from '@/features/universities/directory-query';
import { SITE_URL } from '@/lib/site-url';
import { buildViLocaleAlternates } from '@/lib/seo/alternates';

export const metadata: Metadata = {
  title: 'Khám Phá Các Trường Đại Học Hàng Đầu Thế Giới | GlowBal',
  description:
    'Tìm kiếm và so sánh hơn 100 trường đại học hàng đầu tại Anh, Mỹ, Úc, Singapore, Châu Âu. Lọc theo địa điểm, học phí, cơ hội học bổng và điều kiện tuyển sinh.',
  keywords: [
    'danh sách trường đại học du học',
    'các trường đại học hàng đầu',
    'du học anh',
    'du học mỹ',
    'du học úc',
    'xếp hạng đại học',
  ],
  alternates: buildViLocaleAlternates('/universities'),
  openGraph: {
    title: 'Khám Phá Các Trường Đại Học Hàng Đầu Thế Giới | GlowBal',
    description:
      'Tìm kiếm và so sánh hơn 100 trường đại học hàng đầu tại Anh, Mỹ, Úc, Singapore, Châu Âu. Lọc theo địa điểm, học phí, cơ hội học bổng và điều kiện tuyển sinh.',
    url: `${SITE_URL}/vi/universities`,
    locale: 'vi_VN',
    alternateLocale: ['en_US'],
  },
};

export const revalidate = 43200;

export default async function VietnameseUniversitiesPage({ searchParams }: { searchParams: Promise<UniversityRawSearchParams> }) {
  return <UniversitiesPage searchParams={searchParams} locale="vi" />;
}
