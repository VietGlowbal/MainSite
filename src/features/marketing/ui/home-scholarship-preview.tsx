'use client';

import { useId, useMemo, useState } from 'react';
import { ICONS, KitIcon, SearchMark, controlClasses } from '@/shared/ui';
import { getLocaleText, type Locale } from '@/lib/i18n/locale';
import type { ScholarshipTeaser } from './home-scholarship-pillars';

/**
 * The Scholarship Library preview that opens under the partner orbit when
 * "Find scholarships" is pressed (owner's flow, 2026-09-20).
 *
 * ─── WHY THE CARDS ARE BUTTONS AND NOT LINKS ────────────────────────────────
 *
 * The owner's rule for this section is that a card must NOT open the
 * scholarship — it sends the visitor to the consultation form at the foot of
 * Home instead. A `<Link>` styled to do that would be a lie to every assistive
 * technology and to anyone who middle-clicks, hovers to read the status bar, or
 * copies the address: all of them would be told this goes to a scholarship
 * page. So each card is a real `<button>`, and its own label says where it
 * actually goes ("Register to view details"). A visitor is never surprised by
 * where they land, which is the point the rule is protecting.
 *
 * This is deliberately NOT the same thing as the dead controls this codebase
 * has removed elsewhere (the /auth remember-me, the voucher field): those
 * promised something no backend could deliver. This one does exactly what it
 * says, and the thing it says is the owner's funnel.
 *
 * ─── THE SEARCH AND FILTERS ARE REAL ────────────────────────────────────────
 *
 * They filter the entries actually on screen rather than miming a search box.
 * A control that looks like search and ignores what you type teaches the
 * visitor the product is a mock-up, which is the opposite of what a preview is
 * for. The set is small and already in memory, so this is a client-side filter
 * over `entries` — no request, and no pretence that it is the whole library.
 * The count line says how many of the full catalogue are behind it, so the
 * preview never implies these are all the scholarships there are.
 */

export type HomeScholarshipPreviewProps = {
  readonly entries: readonly ScholarshipTeaser[];
  /** Size of the full published catalogue, for the "showing N of M" line. */
  readonly total: number;
  readonly locale: Locale;
  /** Where the cards and the notice send the visitor — the Home contact form. */
  readonly onRequestConsultation: () => void;
};

/** Funding-type chips, derived from the entries so a chip is never empty. */
function fundingFacets(entries: readonly ScholarshipTeaser[]): readonly string[] {
  const seen = new Map<string, number>();
  for (const entry of entries) {
    for (const type of entry.fundingTypes ?? []) {
      const key = type.trim().toLowerCase().replaceAll('_', '-');
      if (key) seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key]) => key);
}

function chipLabel(value: string): string {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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
        const types = (entry.fundingTypes ?? []).map((type) =>
          type.trim().toLowerCase().replaceAll('_', '-'),
        );
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
    <div className="mt-gb-6xl rounded-gb-xl bg-surface p-gb-2xl text-fg md:p-gb-4xl">
      <div className="flex flex-col gap-gb-2xl lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="font-display text-gb-display-xs font-semibold">
            {getLocaleText(locale, 'Scholarship Library')}
          </h3>
          <p className="mt-gb-xs text-gb-sm text-fg-secondary">
            {getLocaleText(locale, 'A preview of what you can search inside GlowBal.')}
          </p>
        </div>

        <div className="flex w-full items-center gap-gb-md lg:w-[360px]">
          <label htmlFor={searchId} className="sr-only">
            {getLocaleText(locale, 'Search scholarships')}
          </label>
          <div className="relative w-full">
            <span className="pointer-events-none absolute left-gb-lg top-1/2 -translate-y-1/2 text-fg-tertiary">
              <SearchMark frame={20} />
            </span>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={getLocaleText(locale, 'Search by name, university or country')}
              className={controlClasses(false, 'pl-gb-6xl')}
            />
          </div>
        </div>
      </div>

      {facets.length > 0 ? (
        <div className="mt-gb-2xl flex flex-wrap items-center gap-gb-md">
          <button
            type="button"
            onClick={() => setActiveFunding(null)}
            aria-pressed={activeFunding === null}
            className={`rounded-gb-full border px-gb-xl py-gb-md text-gb-sm font-semibold transition-colors ${
              activeFunding === null
                ? 'border-brand bg-brand text-on-brand'
                : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover'
            }`}
          >
            {getLocaleText(locale, 'All')}
          </button>
          {facets.map((facet) => (
            <button
              key={facet}
              type="button"
              onClick={() => setActiveFunding(activeFunding === facet ? null : facet)}
              aria-pressed={activeFunding === facet}
              className={`rounded-gb-full border px-gb-xl py-gb-md text-gb-sm font-semibold transition-colors ${
                activeFunding === facet
                  ? 'border-brand bg-brand text-on-brand'
                  : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover'
              }`}
            >
              {getLocaleText(locale, chipLabel(facet))}
            </button>
          ))}
        </div>
      ) : null}

      {/* Says plainly that this is a sample of a bigger catalogue, so the six
          cards below are never mistaken for the whole library. */}
      <p className="mt-gb-2xl text-gb-sm text-fg-tertiary">
        {getLocaleText(locale, 'Showing {shown} of {total} published scholarships', {
          shown: visible.length,
          total: new Intl.NumberFormat('en-US').format(total),
        })}
      </p>

      <ul className="mt-gb-xl grid gap-gb-xl md:grid-cols-2 lg:grid-cols-3">
        {visible.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={onRequestConsultation}
              className="flex h-full w-full flex-col items-start gap-gb-lg rounded-gb-lg border border-line bg-surface p-gb-xl text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span className="text-gb-xs font-semibold uppercase tracking-wide text-fg-tertiary">
                {entry.organization}
              </span>
              <span className="font-semibold text-fg">{entry.title}</span>
              {entry.value ? (
                <span className="rounded-gb-md bg-brand-subtle px-gb-lg py-gb-md text-gb-sm font-semibold text-brand">
                  {entry.value}
                </span>
              ) : null}
              {entry.deadline ? (
                <span className="inline-flex items-center gap-gb-xs text-gb-sm text-fg-secondary">
                  <KitIcon art={ICONS.calendar} frame={16} />
                  {entry.deadline}
                </span>
              ) : null}
              {/* The card's own promise. See this file's header for why the
                  label names the form rather than the scholarship. */}
              <span className="mt-auto pt-gb-md text-gb-sm font-semibold text-fg-brand">
                {getLocaleText(locale, 'Register to view details')} →
              </span>
            </button>
          </li>
        ))}
      </ul>

      {visible.length === 0 ? (
        <p className="mt-gb-xl rounded-gb-lg border border-line bg-surface-subtle p-gb-2xl text-center text-gb-sm text-fg-secondary">
          {getLocaleText(locale, 'No scholarship in this preview matches that search — the full library has many more.')}
        </p>
      ) : null}

      {/* The notice the owner asked for: say what unlocks the library, and put
          the way to do it directly under it. */}
      <div className="mt-gb-2xl flex flex-col gap-gb-lg rounded-gb-lg border border-brand/20 bg-brand-subtle p-gb-2xl md:flex-row md:items-center md:justify-between">
        <p className="text-gb-sm font-medium text-fg md:text-gb-md">
          {getLocaleText(locale, 'Leave your details and a GlowBal advisor will send the scholarships that fit your profile.')}
        </p>
        <button
          type="button"
          onClick={onRequestConsultation}
          className="shrink-0 rounded-gb-md bg-brand px-gb-btn-xl py-gb-lg text-gb-md font-semibold text-on-brand shadow-gb-xs-skeuomorphic transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {getLocaleText(locale, 'Register for Free Consultation')}
        </button>
      </div>
    </div>
  );
}
