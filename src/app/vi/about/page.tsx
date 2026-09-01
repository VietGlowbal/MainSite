import type { Metadata } from 'next';
import AboutPage from '../../about/page';
import { SITE_URL } from '@/lib/site-url';
import { buildViLocaleAlternates } from '@/lib/seo/alternates';

export const metadata: Metadata = {
  title: 'Về GlowBal — Đội ngũ đồng hành du học cùng sinh viên Việt Nam | GlowBal',
  description:
    'Gặp gỡ đội ngũ đứng sau GlowBal — những chuyên gia giáo dục, kỹ sư và cố vấn tận tâm giúp học sinh, sinh viên Việt Nam chinh phục học bổng và du học toàn cầu.',
  alternates: buildViLocaleAlternates('/about'),
  openGraph: {
    title: 'Về GlowBal — Đội ngũ đồng hành du học cùng sinh viên Việt Nam | GlowBal',
    description:
      'Gặp gỡ đội ngũ đứng sau GlowBal — những chuyên gia giáo dục, kỹ sư và cố vấn tận tâm giúp học sinh, sinh viên Việt Nam chinh phục học bổng và du học toàn cầu.',
    url: `${SITE_URL}/vi/about`,
    locale: 'vi_VN',
    alternateLocale: ['en_US'],
  },
};

export const revalidate = 43200;

export default async function VietnameseAboutPage() {
  return <AboutPage locale="vi" />;
}
