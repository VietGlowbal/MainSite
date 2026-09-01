import { Button, Container, ICONS, KitIcon } from '@/shared/ui';
import { TID, testId } from '@/shared/lib/testids';
import { getLocaleText, localizePath, type Locale } from '@/lib/i18n/locale';
import {
  HomeScholarshipPillars,
  type ScholarshipTeaser,
} from './home-scholarship-pillars';

export type { ScholarshipTeaser } from './home-scholarship-pillars';

/**
 * A light editorial break between the Home metrics and the inverse pain-point
 * band. The heading stays on one line when the viewport can support it, while
 * the interactive scholarship rail sits below it as a separate reading layer.
 */
export function HomeScholarships({
  entries = [],
  total = 0,
  seeMoreHref = '/scholarships',
  locale = 'en',
}: {
  entries?: readonly ScholarshipTeaser[];
  total?: number;
  seeMoreHref?: string;
  locale?: Locale;
}) {
  const formattedTotal = new Intl.NumberFormat('en-US').format(total);

  return (
    <section
      {...testId(TID.homeScholarships)}
      className="relative overflow-hidden border-t border-line bg-surface py-gb-8xl text-fg md:py-gb-9xl"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[8%] -top-[35%] size-[440px] rounded-gb-full bg-brand-subtle opacity-70 blur-3xl"
      />

      <Container className="relative">
        <header>
          <div className="flex flex-col gap-gb-2xl border-b border-line pb-gb-4xl sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex w-fit items-center gap-gb-lg rounded-gb-full border border-brand bg-brand px-gb-xl py-gb-lg text-gb-md font-semibold text-on-brand shadow-gb-xs-skeuomorphic">
              <KitIcon art={ICONS.gift01} frame={20} />
              {getLocaleText(locale, 'Scholarship spotlight')}
            </span>

            {total > 0 ? (
              <div
                className="flex w-fit items-center gap-gb-xl rounded-gb-2xl border border-brand/20 bg-brand-subtle px-gb-2xl py-gb-lg shadow-gb-xs"
                aria-label={`${formattedTotal} published scholarships ready to explore`}
              >
                <span
                  data-no-auto-translate
                  className="font-display text-gb-display-md font-semibold tabular-nums tracking-gb-display-tight text-brand"
                >
                  {formattedTotal}
                </span>
                <span className="border-l border-brand/20 pl-gb-xl leading-tight">
                  <span className="block text-gb-sm font-semibold text-fg">
                    {getLocaleText(locale, 'published scholarships')}
                  </span>
                  <span className="mt-gb-xs block text-gb-sm font-semibold text-brand">
                    {getLocaleText(locale, 'ready to explore')}
                  </span>
                </span>
              </div>
            ) : null}
          </div>

          <h2 className="mt-gb-4xl font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg lg:whitespace-nowrap lg:text-gb-display-md">
            {getLocaleText(locale, 'A world of funding, brought into focus.')}
          </h2>

          <div className="mt-gb-2xl flex flex-col gap-gb-2xl md:flex-row md:items-end md:justify-between">
            <p className="max-w-gb-width-lg text-gb-lg leading-relaxed text-fg-secondary">
              {getLocaleText(locale, 'Start with a few standout opportunities, then explore the library to find the scholarships that fit your goals, destination and story.')}
            </p>
            <Button href={localizePath(seeMoreHref, locale)} size="xl" variant="primary" className="shrink-0">
              {getLocaleText(locale, 'Explore all scholarships')}
              <KitIcon art={ICONS.arrowRight} frame={20} />
            </Button>
          </div>
        </header>

        {entries.length > 0 ? (
          <HomeScholarshipPillars entries={entries} locale={locale} />
        ) : (
          <div className="mt-gb-5xl flex min-h-[260px] items-center justify-center rounded-gb-2xl border border-line bg-surface-subtle p-gb-5xl text-center">
            <div className="max-w-gb-width-sm">
              <h3 className="font-display text-gb-display-xs font-semibold text-fg">
                {getLocaleText(locale, 'Find scholarships that fit your goals')}
              </h3>
              <p className="mt-gb-lg text-gb-md text-fg-secondary">
                {getLocaleText(locale, 'Create a free profile to save opportunities and build a focused application plan.')}
              </p>
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}
