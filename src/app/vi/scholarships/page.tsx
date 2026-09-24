import type { Metadata } from 'next';
import ScholarshipsPage from '../../scholarships/page';
import { SITE_URL } from '@/lib/site-url';
import { buildViLocaleAlternates } from '@/lib/seo/alternates';

export const metadata: Metadata = {
  title: 'Tìm Kiếm Học Bổng Du Học & Hỗ Trợ Tài Chính | GlowBal',
  description:
    'Khám phá hàng trăm cơ hội học bổng du học quốc tế, học bổng chính phủ và hỗ trợ tài chính từ các trường đại học hàng đầu dành riêng cho sinh viên Việt Nam.',
  keywords: [
    'học bổng du học',
    'săn học bổng',
    'học bổng toàn phần',
    'học bổng anh',
    'học bổng mỹ',
    'học bổng úc',
    'hỗ trợ tài chính du học',
  ],
  alternates: buildViLocaleAlternates('/scholarships'),
  openGraph: {
    title: 'Tìm Kiếm Học Bổng Du Học & Hỗ Trợ Tài Chính | GlowBal',
    description:
      'Khám phá hàng trăm cơ hội học bổng du học quốc tế, học bổng chính phủ và hỗ trợ tài chính từ các trường đại học hàng đầu dành riêng cho sinh viên Việt Nam.',
    url: `${SITE_URL}/vi/scholarships`,
    locale: 'vi_VN',
    alternateLocale: ['en_US'],
  },
};

export const revalidate = 43200;

export default async function VietnameseScholarshipsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ScholarshipsPage searchParams={searchParams} locale="vi" />;
}
