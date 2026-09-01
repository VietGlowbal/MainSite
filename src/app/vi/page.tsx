import type { Metadata } from 'next';
import { MarketingHome } from '../page';
import { SITE_URL } from '@/lib/site-url';
import { buildViLocaleAlternates } from '@/lib/seo/alternates';
import { homeCopy } from '@/lib/i18n/locale';

export const metadata: Metadata = {
  title: homeCopy.vi.metadataTitle,
  description: homeCopy.vi.metadataDescription,
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
    title: homeCopy.vi.metadataTitle,
    description: homeCopy.vi.metadataDescription,
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
    title: homeCopy.vi.metadataTitle,
    description: homeCopy.vi.metadataDescription,
    images: ['/glowbal-logo.png'],
  },
};

export const revalidate = 43200;

export default async function VietnameseHome() {
  return <MarketingHome locale="vi" />;
}
