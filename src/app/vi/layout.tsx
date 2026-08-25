import type { Metadata } from 'next';
import { LanguageProvider } from '@/lib/i18n';

export const metadata: Metadata = {
  openGraph: {
    locale: 'vi_VN',
    alternateLocale: ['en_US'],
  },
};

export default function ViLayout({ children }: { children: React.ReactNode }) {
  return <LanguageProvider defaultLang="vi">{children}</LanguageProvider>;
}
