import type { Metadata } from 'next';
import Home from '../page';
import { SITE_URL } from '@/lib/site-url';
import { buildViLocaleAlternates } from '@/lib/seo/alternates';

export const metadata: Metadata = {
  title: 'GlowBal | Tìm Kiếm Trường Đại Học, Học Bổng & Chiến Lược Du Học',
  description:
    'Nền tảng hướng nghiệp và du học toàn cầu chuẩn cá nhân hóa. Khám phá 100+ đại học thế giới, săn học bổng và xây dựng chiến lược ứng tuyển bằng AI cùng cố vấn thực tế.',
  keywords: [
    'học bổng du học',
    'du học',
    'học bổng toàn phần',
    'chiến lược săn học bổng',
    'tìm trường đại học du học',
    'GlowBal du học',
  ],
  alternates: buildViLocaleAlternates('/'),
  openGraph: {
    title: 'GlowBal | Tìm Kiếm Trường Đại Học, Học Bổng & Chiến Lược Du Học',
    description:
      'Nền tảng hướng nghiệp và du học toàn cầu chuẩn cá nhân hóa. Khám phá 100+ đại học thế giới, săn học bổng và xây dựng chiến lược ứng tuyển bằng AI cùng cố vấn thực tế.',
    url: `${SITE_URL}/vi`,
    siteName: 'GlowBal',
    locale: 'vi_VN',
    alternateLocale: ['en_US'],
    images: [
      {
        url: '/glowbal-logo.png',
        width: 1200,
        height: 630,
        alt: 'GlowBal - Tìm Kiếm Trường Đại Học, Học Bổng & Chiến Lược Du Học',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GlowBal | Tìm Kiếm Trường Đại Học, Học Bổng & Chiến Lược Du Học',
    description:
      'Nền tảng hướng nghiệp và du học toàn cầu chuẩn cá nhân hóa. Khám phá 100+ đại học thế giới, săn học bổng và xây dựng chiến lược ứng tuyển bằng AI cùng cố vấn thực tế.',
    images: ['/glowbal-logo.png'],
  },
};

export const revalidate = 43200;

export default Home;
