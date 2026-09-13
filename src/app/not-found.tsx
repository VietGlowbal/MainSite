import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { SiteNavigation } from '@/components/site-navigation';
import { getLocalizedFooter } from '@/features/marketing/navigation';
import { translations } from '@/lib/i18n-catalog';
import { localizePath, type Locale } from '@/lib/i18n/locale';
import { Button } from '@/shared/ui/button';
import { Footer } from '@/shared/ui/footer';

export const metadata: Metadata = {
  title: 'Page not found',
};

/*
 * The 404 page, on the same chrome as every rebuilt page: SiteNavigation on
 * top, the shared Footer below, design-system tokens in between.
 *
 * ⚠️ WHY THIS PAGE IS NOT IN `OWN_CHROME_ROUTES`. That list is keyed on
 * pathname, and a 404 has no pathname of its own — it renders at whatever URL
 * was mistyped, which may or may not already suppress the app chrome
 * (`/universities/999999` does, `/foo` does not). So this page always ships
 * its own header, and the duplicate is hidden by the
 * `body:has(.glowbal-main-content [data-testid='nav-header'])` rule in
 * globals.css. Both headers arrive in the same small HTML response, so the
 * rule applies before first paint rather than shifting the page.
 *
 * ⚠️ WHY THE COPY IS LOOKED UP HERE, NOT WITH `getLocaleText`. An unmatched
 * `/vi/...` URL renders this root not-found *outside* `src/app/vi/layout.tsx`,
 * which is where the catalog gets primed — so `getLocaleText('vi', …)` would
 * return English. The locale header set by `src/proxy.ts` is still present.
 */
function translate(locale: Locale, source: string): string {
  return locale === 'vi' ? translations[source] ?? source : source;
}

export default async function NotFound() {
  const locale: Locale = (await headers()).get('x-glowbal-locale') === 'vi' ? 'vi' : 'en';
  const t = (source: string) => translate(locale, source);
  const footer = getLocalizedFooter(locale);

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header flex min-h-screen flex-col bg-surface-muted">
      <SiteNavigation tone="light" locale={locale} />

      <section className="flex flex-1 items-center justify-center px-gb-xl py-gb-7xl md:px-gb-4xl md:py-gb-9xl">
        <div className="w-full max-w-gb-width-sm rounded-gb-xl border border-line bg-surface px-gb-3xl py-gb-5xl text-center shadow-gb-xs md:px-gb-5xl">
          <span className="mx-auto mb-gb-xl flex size-gb-7xl items-center justify-center rounded-gb-full bg-brand-subtle text-fg-brand">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </span>

          <p className="text-gb-sm font-semibold text-fg-brand">404</p>
          <h1 className="mt-gb-md font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
            {t('Lost in space')}
          </h1>
          <p className="mt-gb-lg text-gb-md text-fg-tertiary">
            {t('The page you’re looking for doesn’t exist. It may have been moved or never existed.')}
          </p>

          <div className="mt-gb-4xl flex flex-col-reverse gap-gb-lg sm:flex-row sm:justify-center">
            <Button href={localizePath('/universities', locale)} variant="secondary" size="lg">
              {t('Browse universities')}
            </Button>
            <Button href={localizePath('/', locale)} variant="primary" size="lg">
              {t('Back home')}
            </Button>
          </div>
        </div>
      </section>

      <Footer
        logo={<GlowbalLogo height={28} />}
        tagline={footer.tagline}
        columns={footer.columns}
        social={footer.social}
        copyright={footer.copyright}
        ratings={footer.ratings}
      />
    </div>
  );
}
