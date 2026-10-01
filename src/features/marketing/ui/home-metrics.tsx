import { ICONS, KitIcon } from '@/shared/ui';
import { getLocaleText, type Locale } from '@/lib/i18n/locale';
import { HomeMetricsGrid } from './home-metrics-grid';

/**
 * Standout numbers — sales-journey handoff §4: rose icon disc, title, the
 * quotation, and three counted cards (see home-metrics-grid.tsx).
 *
 * ⚠️ THE GLOWS SIT BEHIND THE CONTENT ON PURPOSE. On the live site at 390px the
 * 360px decorative glow painted over the heading and quote and washed them out,
 * because the heading's wrapper was not positioned and so lost the stacking
 * contest to an absolutely-positioned sibling (design brief, "Found while
 * screenshotting"). The content column is `relative z-10` now; do not drop it.
 */
export function HomeMetrics({ locale = 'en' }: { locale?: Locale }) {
  /* The rose peak of the page's background ramp (tokens.css,
     `--gb-home-band-numbers`): crimson in, full rose through the cards, then
     a fade to blush in the last 240px — the extra bottom margin on the grid
     keeps that fade below the cards. The old cyan glow in the bottom-right
     corner was cut by the section edge into a visible seam; it is gone. */
  return (
    <section
      id="numbers"
      data-surface="dark"
      className="relative scroll-mt-gb-9xl overflow-hidden bg-[image:var(--gb-home-band-numbers)] py-gb-7xl text-white md:py-gb-9xl"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[160px] top-[120px] size-[520px] rounded-gb-full bg-white/12 blur-[80px]"
      />

      <div className="relative z-10 mx-auto w-full max-w-gb-desktop px-gb-xl md:px-gb-4xl">
        <div className="mx-auto flex max-w-gb-width-xl flex-col items-center text-center">
          {/* 56px is the kit component's own size — a 28px icon on a 14px inset. */}
          <span className="flex size-[56px] items-center justify-center rounded-gb-full border border-white/15 bg-white/10 text-white">
            <KitIcon art={ICONS.zapFast} frame={28} />
          </span>
          <h2 className="mt-gb-3xl font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-white md:text-gb-display-md">
            {getLocaleText(locale, 'Numbers say it all')}
          </h2>
          {/* A quotation, marks included. Written as a JS string so the straight
              quotes survive into the DOM exactly and match the dictionary key. */}
          <p className="mt-gb-xl text-balance text-gb-md text-white/75 md:text-gb-lg">
            {getLocaleText(locale, 'Measured momentum behind a clearer scholarship journey.')}
          </p>
        </div>

        <div className="mb-gb-7xl mt-gb-7xl">
          <HomeMetricsGrid locale={locale} />
        </div>
      </div>
    </section>
  );
}
