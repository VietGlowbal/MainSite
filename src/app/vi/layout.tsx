import type { Metadata } from 'next';

export const metadata: Metadata = {
  openGraph: {
    locale: 'vi_VN',
    alternateLocale: ['en_US'],
  },
};

export default function ViLayout({ children }: { children: React.ReactNode }) {
  return <div lang="vi">{children}</div>;
}
