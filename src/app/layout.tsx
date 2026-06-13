import type { Metadata } from 'next';
import ReactDOM from 'react-dom';
import { Geist_Mono, Outfit } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { NavReveal } from '@/components/nav-reveal';
import { LanguageProvider } from '@/lib/i18n';
import { DomTranslator } from '@/lib/dom-translate';
import './globals.css';

const outfit = Outfit({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

// The mono font is only used on a few admin/error screens, so don't pay the
// preload cost on every page — it still loads on demand when actually used.
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
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
  // Warm up connections to the CDNs that serve LCP imagery, so image-heavy
  // routes don't pay full DNS + TLS latency on first paint. React hoists
  // these hints into <head>.
  ReactDOM.preconnect('https://upload.wikimedia.org', { crossOrigin: 'anonymous' });
  ReactDOM.preconnect('https://images.unsplash.com', { crossOrigin: 'anonymous' });
  ReactDOM.prefetchDNS('https://lh3.googleusercontent.com');

  return (
    <html
      lang="en"
      className={`${outfit.variable} ${geistMono.variable} h-full overflow-x-hidden bg-white antialiased`}
    >
      <body className="min-h-full overflow-x-hidden bg-white text-slate-800 glowbal-site-shell">
        <LanguageProvider>
          <NavReveal />
          <main className="glowbal-main-content">{children}</main>
          {/* Whole-page translation for any text not covered by the static
              dictionary or t()/AutoTranslate. Only calls /api/translate when
              Vietnamese is active; English stays the zero-cost default. */}
          <DomTranslator />
        </LanguageProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
