import type { Metadata } from 'next';
import MentorsBrowsePage from '../../mentors/page';
import { SITE_URL } from '@/lib/site-url';
import { buildViLocaleAlternates } from '@/lib/seo/alternates';

export const metadata: Metadata = {
  title: 'Kết Nối Với Cố Vấn & Cựu Du Học Sinh Xuất Sắc | GlowBal',
  description:
    'Trao đổi 1-1 cùng các cố vấn và cựu sinh viên đã trúng tuyển học bổng tại các đại học hàng đầu thế giới. Nhận tư vấn lộ trình, rà soát hồ sơ CV/bài luận và luyện phỏng vấn.',
  keywords: [
    'cố vấn du học',
    'kết nối mentor du học',
    'săn học bổng',
    'sửa bài luận du học',
    'luyện phỏng vấn học bổng',
  ],
  alternates: buildViLocaleAlternates('/advisors'),
  openGraph: {
    title: 'Kết Nối Với Cố Vấn & Cựu Du Học Sinh Xuất Sắc | GlowBal',
    description:
      'Trao đổi 1-1 cùng các cố vấn và cựu sinh viên đã trúng tuyển học bổng tại các đại học hàng đầu thế giới. Nhận tư vấn lộ trình, rà soát hồ sơ CV/bài luận và luyện phỏng vấn.',
    url: `${SITE_URL}/vi/advisors`,
    locale: 'vi_VN',
    alternateLocale: ['en_US'],
  },
};

export const revalidate = 300;

export default async function VietnameseAdvisorsPage() {
  return <MentorsBrowsePage locale="vi" />;
}
