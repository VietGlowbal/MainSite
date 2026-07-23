import type { Metadata } from 'next';
import ReactDOM from 'react-dom';
import { Bricolage_Grotesque, Geist_Mono, Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { NavReveal } from '@/components/nav-reveal';
import { LanguageProvider } from '@/lib/i18n';
import { DomTranslator } from '@/lib/dom-translate';
import './globals.css';

// Body face, per the Figma variable "Font family/font-family-body".
// The 'vietnamese' subset matters: the app is bilingual EN/VI and the previous
// font only loaded 'latin', so accented Vietnamese fell back to Arial.
const inter = Inter({
  variable: '--font-gb-sans',
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
});

// Display face, per "Font family/font-family-display". Used for display-xs
// through display-xl headings, which carry letter-spacing -2 in the design.
const bricolage = Bricolage_Grotesque({
  variable: '--font-gb-display',
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
});

// The mono font is only used on a few admin/error screens, so don't pay the
// preload cost on every page — it still loads on demand when actually used.
const geistMono = Geist_Mono({
  variable: '--font-gb-mono',
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
      className={`${inter.variable} ${bricolage.variable} ${geistMono.variable} h-full overflow-x-hidden antialiased`}
    >
      {/* No `bg-white` here: `body {}` now lives in @layer base (globals.css),
          so a utility would out-rank it and flip the page background from
          #F5F6FF to white. The background belongs to the base layer. */}
      <body className="min-h-full overflow-x-hidden text-slate-800 glowbal-site-shell">
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
