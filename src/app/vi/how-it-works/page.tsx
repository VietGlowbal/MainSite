import type { Metadata } from 'next';
import HowItWorksPage from '../../how-it-works/page';
import { SITE_URL } from '@/lib/site-url';
import { buildViLocaleAlternates } from '@/lib/seo/alternates';

export const metadata: Metadata = {
  title: 'Cách GlowBal Hoạt Động — Lộ Trình Hướng Nghiệp & Du Học Cùng AI | GlowBal',
  description:
    'Khám phá quy trình 3 giai đoạn 14 bước từ tìm trường, săn học bổng, chuẩn bị hồ sơ CV/Personal Statement đến xây dựng chiến lược ứng tuyển toàn diện cùng GlowBal.',
  alternates: buildViLocaleAlternates('/how-it-works'),
  openGraph: {
    title: 'Cách GlowBal Hoạt Động — Lộ Trình Hướng Nghiệp & Du Học Cùng AI | GlowBal',
    description:
      'Khám phá quy trình 3 giai đoạn 14 bước từ tìm trường, săn học bổng, chuẩn bị hồ sơ CV/Personal Statement đến xây dựng chiến lược ứng tuyển toàn diện cùng GlowBal.',
    url: `${SITE_URL}/vi/how-it-works`,
    locale: 'vi_VN',
    alternateLocale: ['en_US'],
  },
};

export default HowItWorksPage;
