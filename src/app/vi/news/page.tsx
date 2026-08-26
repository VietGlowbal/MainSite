import type { Metadata } from 'next';
import NewsPage from '../../news/page';
import { SITE_URL } from '@/lib/site-url';
import { buildViLocaleAlternates } from '@/lib/seo/alternates';

export const metadata: Metadata = {
  title: 'Cẩm Nang, Tin Tức & Kinh Nghiệm Du Học Học Bổng | GlowBal',
  description:
    'Đọc các cẩm nang hướng dẫn chi tiết về chi phí du học, chiến lược săn học bổng, thủ tục visa và kinh nghiệm ứng tuyển thành công dành cho sinh viên Việt Nam.',
  keywords: [
    'cẩm nang du học',
    'săn học bổng',
    'kinh nghiệm du học',
    'chi phí du học',
    'học bổng anh',
    'học bổng mỹ',
  ],
  alternates: buildViLocaleAlternates('/news'),
  openGraph: {
    title: 'Cẩm Nang, Tin Tức & Kinh Nghiệm Du Học Học Bổng | GlowBal',
    description:
      'Đọc các cẩm nang hướng dẫn chi tiết về chi phí du học, chiến lược săn học bổng, thủ tục visa và kinh nghiệm ứng tuyển thành công dành cho sinh viên Việt Nam.',
    url: `${SITE_URL}/vi/news`,
    locale: 'vi_VN',
    alternateLocale: ['en_US'],
  },
};

export const revalidate = 300;

export default NewsPage;
