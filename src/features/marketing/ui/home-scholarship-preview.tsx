'use client';

import { useId, useMemo, useState } from 'react';
import { ICONS, KitIcon, SearchMark, controlClasses } from '@/shared/ui';
import { getLocaleText, type Locale } from '@/lib/i18n/locale';
import { fundingTypeLabel, type ScholarshipTeaser } from './home-scholarship-pillars';

/**
 * The Scholarship Library preview that opens under the partner orbit when
 * "Find scholarships" is pressed. Card anatomy per the sales-journey handoff §2:
 * type pill + heart disc, two-line title, organisation, rose-50 value box
 * (value + one detail line), funding chips, one eligibility line, then a rule
 * and deadline · "Register to view details →".
 *
 * ─── WHY THE CARDS ARE BUTTONS AND NOT LINKS ────────────────────────────────
 *
 * The owner's rule for this section is that a card must NOT open the
 * scholarship — it sends the visitor to the consultation form at the foot of
 * Home instead. A `<Link>` styled to do that would lie to every assistive
 * technology and to anyone who middle-clicks or reads the status bar. So each
 * card is a real `<button>`, and its own label says where it actually goes
 * ("Register to view details").
 *
 * The heart is DECORATIVE (aria-hidden, not a control): saving needs an account,
 * and a heart that does nothing when pressed would be a dead control. It is the
 * design's cue that saving exists inside the product.
 *
 * ─── THE SEARCH AND FILTERS ARE REAL ────────────────────────────────────────
 *
 * They filter the entries on screen rather than miming a search box. The chips
 * are derived from those entries, so a chip is never empty — the design's fixed
 * five (All / Merit / Need / Research / Full tuition) would show dead filters
 * whenever today's six records do not carry that type. The count line says how
 * many of the full catalogue are behind the sample.
 */

export type HomeScholarshipPreviewProps = {
  readonly entries: readonly ScholarshipTeaser[];
  /** Size of the full published catalogue, for the "showing N of M" line. */
  readonly total: number;
  readonly locale: Locale;
  /** Where the cards and the notice send the visitor — the Home contact form. */
  readonly onRequestConsultation: () => void;
};

function normalizeFunding(value: string): string {
  return value.trim().toLowerCase().replaceAll('_', '-');
}

/** Funding-type chips, derived from the entries so a chip is never empty. */
function fundingFacets(entries: readonly ScholarshipTeaser[]): readonly string[] {
  const seen = new Map<string, number>();
  for (const entry of entries) {
    for (const type of entry.fundingTypes ?? []) {
      const key = normalizeFunding(type);
      if (key) seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key]) => key);
}

const CHIP_BASE =
  'min-h-[36px] whitespace-nowrap rounded-gb-full border px-gb-xl py-gb-md text-gb-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
const CHIP_ON = 'border-brand bg-brand text-on-brand';
const CHIP_OFF = 'border-line-strong bg-surface text-fg-tertiary hover:bg-surface-hover';

export function HomeScholarshipPreview({
  entries,
  total,
  locale,
  onRequestConsultation,
}: HomeScholarshipPreviewProps) {
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [activeFunding, setActiveFunding] = useState<string | null>(null);

  const facets = useMemo(() => fundingFacets(entries), [entries]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (activeFunding !== null) {
        const types = (entry.fundingTypes ?? []).map(normalizeFunding);
        if (!types.includes(activeFunding)) return false;
      }
      if (needle === '') return true;
      return [entry.title, entry.organization, entry.country, entry.coverage]
        .filter((field): field is string => typeof field === 'string')
        .some((field) => field.toLowerCase().includes(needle));
    });
  }, [entries, query, activeFunding]);

  return (
    /* Light panel inside the black band: the library is a light surface
       everywhere else on the site, and previewing it on black would show the
       visitor a product that does not exist. */
    <div className="mt-gb-6xl rounded-gb-xl bg-surface p-gb-3xl text-fg md:p-gb-4xl">
      <div className="flex flex-wrap items-center justify-between gap-gb-2xl">
        <div>
          <h3 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight">
            {getLocaleText(locale, 'Scholarship Library')}
          </h3>
          <p className="mt-gb-xs text-gb-sm text-fg-tertiary">
            {getLocaleText(locale, 'A preview of what you can search inside GlowBal.')}
          </p>
        </div>

        <div className="relative w-full md:w-[360px]">
          <label htmlFor={searchId} className="sr-only">
            {getLocaleText(locale, 'Search scholarships')}
          </label>
          <span className="pointer-events-none absolute left-gb-input-x top-1/2 -translate-y-1/2 text-fg-muted">
            <SearchMark frame={18} />
          </span>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={getLocaleText(locale, 'Search by name, university or country')}
            className={controlClasses(false, 'pl-[42px]')}
          />
        </div>
      </div>

      {facets.length > 0 ? (
        <div className="mt-gb-2xl flex flex-wrap gap-gb-md">
          <button
            type="button"
            onClick={() => setActiveFunding(null)}
            aria-pressed={activeFunding === null}
            className={`${CHIP_BASE} ${activeFunding === null ? CHIP_ON : CHIP_OFF}`}
          >
            {getLocaleText(locale, 'All')}
          </button>
          {facets.map((facet) => (
            <button
              key={facet}
              type="button"
              onClick={() => setActiveFunding(activeFunding === facet ? null : facet)}
              aria-pressed={activeFunding === facet}
              className={`${CHIP_BASE} ${activeFunding === facet ? CHIP_ON : CHIP_OFF}`}
            >
              {fundingTypeLabel(facet, locale)}
            </button>
          ))}
        </div>
      ) : null}

      {/* Says plainly that this is a sample of a bigger catalogue. */}
      <p className="mt-gb-2xl text-gb-sm text-fg-muted">
        {getLocaleText(locale, 'Showing {shown} of {total} published scholarships', {
          shown: visible.length,
          total: new Intl.NumberFormat('en-US').format(total),
        })}
      </p>

      <ul className="mt-gb-xl grid gap-gb-xl md:grid-cols-2 lg:grid-cols-3">
        {visible.map((entry) => (
          <li key={entry.id} className="min-w-0">
            <button
              type="button"
              onClick={onRequestConsultation}
              className="group flex h-full w-full flex-col gap-gb-lg rounded-gb-xl border border-line bg-surface p-gb-2xl text-left shadow-gb-xs transition duration-200 ease-out hover:-translate-y-gb-xs hover:border-gb-brand-300 hover:shadow-gb-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span className="flex w-full items-center justify-between gap-gb-lg">
                <span className="whitespace-nowrap rounded-gb-full border border-line bg-surface-muted px-gb-lg py-gb-xxs text-gb-xs font-semibold text-fg-secondary">
                  {getLocaleText(locale, entry.kind === 'university' ? 'University-specific' : 'Foundation / provider')}
                </span>
                <span
                  aria-hidden="true"
                  className="flex size-[36px] shrink-0 items-center justify-center rounded-gb-full border border-line text-fg-secondary"
                >
                  <KitIcon art={ICONS.heart} frame={20} />
                </span>
              </span>

              <span className="line-clamp-2 font-display text-gb-lg font-semibold text-fg transition-colors group-hover:text-fg-brand">
                {entry.title}
              </span>
              <span className="-mt-gb-md text-gb-sm text-fg-tertiary">{entry.organization}</span>

              {/* The page maps a teaser as `value` = award amount + `coverage` =
                  what it covers, or — when there is no amount — `value` = the
                  coverage and `coverage` = null. Only a real amount gets the
                  large figure; coverage is always the detail line. */}
              <span className="flex w-full flex-col gap-gb-xs rounded-gb-lg bg-brand-subtle px-gb-xl py-gb-lg">
                {entry.coverage ? (
                  <span className="text-gb-lg font-semibold text-fg-brand">{entry.value}</span>
                ) : null}
                <span className="line-clamp-2 text-gb-sm font-medium text-fg-brand">
                  {entry.coverage ?? entry.value}
                </span>
              </span>

              {entry.fundingTypes?.length ? (
                <span className="flex flex-wrap gap-gb-sm">
                  {entry.fundingTypes.slice(0, 3).map((type) => (
                    <span
                      key={type}
                      className="whitespace-nowrap rounded-gb-full border border-line bg-surface-muted px-gb-md py-gb-xxs text-gb-xs font-medium text-fg-tertiary"
                    >
                      {fundingTypeLabel(type, locale)}
                    </span>
                  ))}
                </span>
              ) : null}

              {entry.eligibility ? (
                <span className="line-clamp-2 text-gb-sm text-fg-tertiary">{entry.eligibility}</span>
              ) : null}

              {/* The card's own promise. See this file's header for why the label
                  names the form rather than the scholarship. */}
              <span className="mt-auto flex w-full items-center justify-between gap-gb-lg border-t border-line pt-gb-lg">
                <span className="inline-flex min-w-0 items-center gap-gb-sm text-gb-xs text-fg-tertiary">
                  {entry.deadline ? (
                    <>
                      <KitIcon art={ICONS.calendar} frame={14} className="shrink-0" />
                      <span className="truncate">{entry.deadline}</span>
                    </>
                  ) : null}
                </span>
                <span className="whitespace-nowrap text-gb-sm font-semibold text-fg-brand">
                  {getLocaleText(locale, 'Register to view details')} →
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {visible.length === 0 ? (
        <p className="mt-gb-xl rounded-gb-lg border border-line bg-surface-muted p-gb-2xl text-center text-gb-sm text-fg-secondary">
          {getLocaleText(locale, 'No scholarship in this preview matches that search — the full library has many more.')}
        </p>
      ) : null}

      {/* The notice the owner asked for: say what unlocks the library, and put
          the way to do it directly under it. */}
      <div className="mt-gb-2xl flex flex-wrap items-center justify-between gap-x-gb-3xl gap-y-gb-lg rounded-gb-lg border border-brand-surface bg-brand-subtle p-gb-2xl">
        <p className="min-w-[260px] flex-1 text-pretty text-gb-md font-medium text-fg">
          {getLocaleText(
            locale,
            'Want the full library and the scholarships that fit you? Register for a free consultation — a GlowBal mentor will send you your shortlist.',
          )}
        </p>
        <button
          type="button"
          onClick={onRequestConsultation}
          className="shrink-0 rounded-gb-md bg-brand px-gb-xl py-gb-input-y text-gb-sm font-semibold text-on-brand shadow-gb-xs-skeuomorphic transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {getLocaleText(locale, 'Register for free consultation')}
        </button>
      </div>
    </div>
  );
}
