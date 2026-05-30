import type { Metadata } from 'next';
import { Geist_Mono, Outfit } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { NavReveal } from '@/components/nav-reveal';
import './globals.css';

const outfit = Outfit({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'GLOWBAL',
  description: 'Student-first global course and university guidance platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${geistMono.variable} h-full overflow-x-hidden bg-white antialiased`}
    >
      <body className="min-h-full overflow-x-hidden bg-white text-slate-800 glowbal-site-shell">
        <NavReveal />
        <main className="glowbal-main-content">{children}</main>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
