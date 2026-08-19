import type { Metadata } from 'next';
import ReactDOM from 'react-dom';
import { Bricolage_Grotesque, Geist_Mono, Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { NavReveal } from '@/components/nav-reveal';
import { NavigationSessionProvider } from '@/components/navigation-session';
import { RouteLoading } from '@/components/route-loading';
import { LanguageProvider } from '@/lib/i18n';
import { DomTranslator } from '@/lib/dom-translate';
import { StrategyHelpButton } from '@/features/marketing/strategy-help';
import { GlobalLoadingOverlay } from '@/shared/ui/loading-overlay';
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
  icons: {
    // Static pink globe supplied by the GLOWBAL brand team.
    icon: [{ url: '/favicon.png', type: 'image/png', sizes: '64x64' }],
    /*
     * The Apple touch icon stays the designed gradient mark in
     * src/app/apple-icon.tsx. It renders at 180px on a home screen, where a
     * frame lifted from a 32px favicon would look like exactly that.
     */
  },
  verification: {
    google: 'OSoUXS4-MCwjQrwvxe2PPmdR3NlzeR120fIvgmn3qm8',
  },
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

  // The globe loader's poster frame (11KB). It is what fills the card in the
  // moment before the video decodes, and the card is by definition shown when
  // the network is already busy — so fetch it while nothing else is competing.
  // The clip itself is deliberately NOT preloaded: 69KB on every page load, to
  // save a few hundred milliseconds on a screen the poster already covers.
  ReactDOM.preload('/loading-globe-poster.jpg', { as: 'image', fetchPriority: 'low' });

  return (
    /*
     * ⚠️ `overflow-x-clip`, NOT `overflow-x-hidden`, on both html and body.
     *
     * They do the same job here — stop a wide legacy page scrolling sideways —
     * but `hidden` computes the other axis to `auto`, which makes the element a
     * scroll container. That put a scroll container (body) between every page
     * and the one that actually scrolls, and `position: sticky` resolves against
     * its nearest scrolling ancestor: body, which never scrolls. So NOTHING on
     * the site could stick. `getComputedStyle` still reported `position: sticky`
     * and the element still scrolled straight off the top, which is why this
     * survived — /universities/[id]'s sidebar had shipped `lg:sticky` since
     * 2026-07-28 and had never once stuck.
     *
     * `clip` does not create a scroll container, so sticky works, and it clips
     * horizontal overflow at least as firmly as `hidden` did — it also removes
     * the programmatic sideways scroll `hidden` still allowed.
     *
     * `flow-root` on the body is the other half and is NOT cosmetic. `hidden`
     * established a block formatting context as a side effect of being a scroll
     * container; `clip` does not, so the first and last child margins started
     * collapsing through the body and every page lost height at both ends — it
     * showed up as the kitchen-sink snapshot coming back 115px shorter.
     * `display: flow-root` restores exactly that block formatting context
     * without restoring the scroll container, so margins behave as before and
     * sticky still works.
     */
    <html
      lang="en"
      className={`${inter.variable} ${bricolage.variable} ${geistMono.variable} h-full overflow-x-clip antialiased`}
    >
      {/* No `bg-white` here: `body {}` now lives in @layer base (globals.css),
          so a utility would out-rank it and flip the page background from
          #F5F6FF to white. The background belongs to the base layer. */}
      <body className="min-h-full flow-root overflow-x-clip text-slate-800 glowbal-site-shell">
        <NavigationSessionProvider>
          <LanguageProvider>
            <NavReveal />
          {/* Puts the globe loader up during client-side navigation. Renders
              nothing itself — it only drives the loading store. */}
            <RouteLoading />
            <main className="glowbal-main-content">{children}</main>
          {/* The floating "?" — opens the product walkthrough over whatever
              page the student is on, at the step matching that page. Mounted
              here so it is genuinely everywhere: universities, scholarships,
              My Portal, the subject picker and every Strategy screen. It
              suppresses itself on the routes that are not the student journey
              (auth, admin, coordinator, onboarding, dev) and on /ai-strategy
              exactly, which IS the walkthrough — its child routes keep it. */}
            <StrategyHelpButton />
          {/* Inside LanguageProvider: the loader's rotating line is bilingual.
              Mounted once here so every page gets it — see loading-overlay.tsx
              for why callers do not need a provider of their own. */}
            <GlobalLoadingOverlay />
          {/* Whole-page translation for any text not covered by the static
              dictionary or t()/AutoTranslate. Only calls /api/translate when
              Vietnamese is active; English stays the zero-cost default. */}
            <DomTranslator />
          </LanguageProvider>
        </NavigationSessionProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
