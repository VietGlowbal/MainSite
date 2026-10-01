import { Button } from '@/shared/ui';
import { getLocaleText, homeCopy, type Locale } from '@/lib/i18n/locale';
import { globeCountryName, type GlobeCountry } from '../domain/home-globe';
import { HeroGlobe } from './hero-globe';
import { highlightPhrases } from './home-highlight';

/**
 * The headline's highlighted words, per locale. The owner chose "ultimate
 * solution" (2026-09-29); Vietnamese has no word-for-word match, so its
 * equivalent is the whole noun phrase "Giải pháp công nghệ toàn diện".
 */
const TITLE_HIGHLIGHT: Readonly<Record<Locale, string>> = {
  en: 'ultimate solution',
  vi: 'Giải pháp công nghệ toàn diện',
};

/**
 * Headline sizes that keep it to TWO lines (owner, 2026-09-29: "càng ít dòng
 * càng tốt … có thể giảm size"). Measured in Bricolage 600 at -2% tracking:
 *   EN "The ultimate solution for"      678px at 60px — fits the ~720px column
 *                                        at 1440, 588px at 52px in 704 at 768.
 *   EN "for scholarship hunters"        333px at 32px — fits 358px at 390.
 *   VI "Giải pháp công nghệ toàn diện"  684px at 49px, so VI runs ~18% smaller.
 * Vietnamese still takes three lines on a phone: its first phrase alone is
 * 447px at 32px. `text-balance` then evens the lines out.
 */
const TITLE_SIZE: Readonly<Record<Locale, string>> = {
  en: 'text-[clamp(28px,8.2vw,52px)] lg:text-[clamp(40px,4.1vw,60px)]',
  vi: 'text-[clamp(26px,7.4vw,46px)] lg:text-[clamp(36px,3.4vw,50px)]',
};

/**
 * Home hero — sales-journey handoff §1 (`design_handoff_home_redesign/`).
 *
 * ONE primary action now: "Register for Free Consultation", scrolling to the
 * consultation form (`#contact`), the page's primary conversion. The old
 * "Plan your Global Education" button and the second CTA under the globe are
 * gone — the funnel has one destination, so the hero has one button.
 *
 * Layout per the handoff: desktop is a grid of `copy | globe` with the caption
 * under the globe; below 1100px (Tailwind `lg` is 1024 — close enough to keep to
 * the kit's breakpoints) it is one column of globe, copy, caption. DOM order is
 * copy, globe, caption — the reading order — with `order-*` doing the stacking.
 *
 * `#contact` is a same-page hash, so it resolves on "/" and "/vi" alike; smooth
 * scroll comes from `html { scroll-behavior }` and the section's own
 * `scroll-mt` keeps it clear of the sticky nav.
 */
export function HomeHero({
  locale = 'en',
  countries = [],
}: {
  locale?: Locale;
  /** Countries the globe lights, with their scholarship counts. */
  countries?: readonly GlobeCountry[];
}) {
  const copy = homeCopy[locale];

  return (
    /* The first band of the page's one background ramp (tokens.css,
       `--gb-home-band-*`): black, ending on the showcase's wine-950. The two
       glows sit well inside the band — the lower one used to hang off the
       bottom edge and was cut into a visible line at the seam. */
    <section
      data-surface="dark"
      className="relative isolate overflow-hidden bg-[image:var(--gb-home-band-hero)] py-gb-7xl text-white md:py-gb-9xl"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-[12%] top-[4%] -z-10 size-[640px] rounded-gb-full bg-gb-marketing-wine-800/70 blur-[140px]" />
      <div aria-hidden="true" className="pointer-events-none absolute left-[6%] top-[28%] -z-10 size-[420px] rounded-gb-full bg-brand/15 blur-[140px]" />
      {/* The copy column takes ~62% at `lg` so the headline fits on two lines;
          the globe gives up the width (496px → at most 460px). */}
      <div className="mx-auto grid w-full max-w-gb-desktop items-center gap-x-gb-6xl gap-y-gb-6xl px-gb-xl md:px-gb-4xl lg:min-h-[640px] lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.62fr)]">
      <div className="order-2 flex min-w-0 flex-col gap-gb-5xl lg:order-none lg:col-start-1 lg:row-span-2 lg:row-start-1">
        {/* No eyebrow line above the headline — owner, 2026-09-29: fewer
            text elements. The H1 leads the hero directly. */}
        <div className="flex flex-col gap-gb-xl">
          <h1
            className={`text-balance font-display font-semibold leading-[1.04] tracking-gb-display-tight text-white ${TITLE_SIZE[locale]}`}
          >
            {highlightPhrases(copy.title, [TITLE_HIGHLIGHT[locale]], 'dark')}
          </h1>
          <p className="text-pretty text-gb-md leading-[26px] text-white/72 md:text-gb-lg md:leading-[28px]">
            {copy.description}
          </p>
        </div>

        <div className="flex flex-col items-start gap-gb-lg">
          <Button href="#contact" size="xl" variant="primary-on-dark" className="whitespace-nowrap">
            {getLocaleText(locale, 'Register for Free Consultation')}
          </Button>
        </div>
      </div>

      <div className="order-1 flex justify-center lg:order-none lg:col-start-2 lg:row-start-1">
        <HeroGlobe
          countries={countries}
          locale={locale}
          className="w-[300px] max-w-full md:w-[400px] lg:w-full lg:max-w-[460px]"
        />
      </div>

      <div className="order-3 flex flex-col items-start gap-gb-lg lg:order-none lg:col-start-2 lg:row-start-2 lg:items-center lg:text-center">
        <p className="max-w-[460px] text-balance text-gb-md font-medium text-white/75">
          {highlightPhrases(
            getLocaleText(
              locale,
              'A collection of insights from 3,000+ scholarships and 700+ universities worldwide.',
            ),
            [getLocaleText(locale, '3,000+ scholarships'), getLocaleText(locale, '700+ universities')],
            'dark',
          )}
        </p>
        {countries.length > 0 ? (
          <>
            <span className="inline-flex items-center gap-gb-md text-gb-xs text-gb-neutral-400">
              <span
                aria-hidden="true"
                className="size-gb-md shrink-0 rounded-gb-full bg-gb-brand-500 shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-gb-brand-500)_20%,transparent)]"
              />
              {getLocaleText(locale, 'Countries with GlowBal scholarship data · drag to spin')}
            </span>
            {/* The globe is aria-hidden decoration; this is what it shows, as text. */}
            <p className="sr-only">
              {getLocaleText(locale, 'GlowBal has scholarship data for:')}{' '}
              {countries
                .map((country) =>
                  getLocaleText(locale, '{country} ({count} scholarships)', {
                    country: globeCountryName(country.name, locale === 'vi'),
                    count: country.count,
                  }),
                )
                .join(', ')}
            </p>
          </>
        ) : null}
      </div>
      </div>
    </section>
  );
}
