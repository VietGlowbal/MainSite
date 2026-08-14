'use client';

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { ICONS, KitIcon } from '@/shared/ui';

export type ScholarshipTeaser = {
  id: number;
  title: string;
  href: string;
  organization: string;
  scholarshipLogoUrl?: string | null;
  scholarshipLogoTone?: 'light' | 'dark' | null;
  universityLogoUrl?: string | null;
  value: string;
  valueLabel?: string | null;
  coverage?: string | null;
  ranking?: string | null;
  deadline?: string | null;
  fundingTypes?: readonly string[] | null;
  country?: string | null;
};

function readableFundingType(values?: readonly string[] | null): string {
  if (!values?.length) return 'Funding support';
  return values
    .slice(0, 2)
    .map((value) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()))
    .join(' + ');
}

function ScholarshipLogo({
  scholarshipSrc,
  universitySrc,
  scholarshipTone,
  scholarshipName,
  universityName,
}: {
  scholarshipSrc?: string | null | undefined;
  universitySrc?: string | null | undefined;
  scholarshipTone?: 'light' | 'dark' | null | undefined;
  scholarshipName: string;
  universityName: string;
}) {
  const [failedSources, setFailedSources] = useState<readonly string[]>([]);
  const selectedSrc = [scholarshipSrc, universitySrc].find(
    (source): source is string => Boolean(source) && !failedSources.includes(source as string),
  );
  const usesScholarshipMark = Boolean(selectedSrc && selectedSrc === scholarshipSrc);
  const alt = usesScholarshipMark ? `${scholarshipName} logo` : `${universityName} logo`;

  return (
    <div
      className={`flex h-[76px] shrink-0 items-center justify-center overflow-hidden rounded-gb-xl border border-line p-gb-lg shadow-gb-sm ${
        usesScholarshipMark ? 'w-[142px]' : 'w-[76px]'
      } ${usesScholarshipMark && scholarshipTone === 'dark' ? 'bg-surface-inverse-strong' : 'bg-surface'}`}
    >
      {selectedSrc ? (
        /* Scholarship marks are tried first, then the linked university crest.
           A plain image supports the verified source hosts without widening
           Next's global remote-image allowlist. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={selectedSrc}
          alt={alt}
          loading="lazy"
          onError={() => setFailedSources((current) => [...current, selectedSrc])}
          className="size-full object-contain"
        />
      ) : (
        <span
          aria-label={`${scholarshipName} scholarship mark`}
          className="flex size-full items-center justify-center rounded-gb-lg bg-brand-subtle text-brand"
        >
          <KitIcon art={ICONS.gift01} frame={30} />
        </span>
      )}
    </div>
  );
}

export function HomeScholarshipPillars({ entries }: { entries: readonly ScholarshipTeaser[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToIndex = useCallback((index: number) => {
    const rail = railRef.current;
    const card = cardRefs.current[index];
    if (!rail || !card || typeof rail.scrollTo !== 'function') return;
    const left = card.offsetLeft - Math.max(0, (rail.clientWidth - card.clientWidth) / 2);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    rail.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, []);

  const showIndex = useCallback((index: number) => {
    const normalized = (index + entries.length) % entries.length;
    setActiveIndex(normalized);
    scrollToIndex(normalized);
  }, [entries.length, scrollToIndex]);

  if (entries.length === 0) return null;

  return (
    <div
      className="mt-gb-6xl min-w-0"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured scholarships"
    >
      <div className="mb-gb-2xl flex justify-end">
        {entries.length > 1 ? (
          <div className="flex shrink-0 items-center gap-gb-md">
            <button
              type="button"
              onClick={() => showIndex(activeIndex - 1)}
              aria-label="Previous scholarship"
              className="flex size-gb-5xl items-center justify-center rounded-gb-full border border-line bg-surface text-fg-secondary shadow-gb-xs transition-[border-color,color,transform] hover:-translate-y-gb-xs hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transform-none"
            >
              <KitIcon art={ICONS.arrowLeft} frame={18} />
            </button>
            <button
              type="button"
              onClick={() => showIndex(activeIndex + 1)}
              aria-label="Next scholarship"
              className="flex size-gb-5xl items-center justify-center rounded-gb-full border border-line bg-surface text-fg-secondary shadow-gb-xs transition-[border-color,color,transform] hover:-translate-y-gb-xs hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transform-none"
            >
              <KitIcon art={ICONS.arrowRight} frame={18} />
            </button>
          </div>
        ) : null}
      </div>

      <div
        aria-live="polite"
        data-no-auto-translate
        className="sr-only"
      >
        Scholarship {activeIndex + 1} of {entries.length}: {entries[activeIndex]?.title}
      </div>

      <div
        ref={railRef}
        className="-mx-gb-xl grid snap-x snap-mandatory grid-flow-col auto-cols-[min(86vw,380px)] gap-gb-2xl overflow-x-auto px-gb-xl pb-gb-4xl pt-gb-md [scrollbar-width:none] md:-mx-gb-4xl md:auto-cols-[min(62vw,390px)] md:px-gb-4xl lg:mx-0 lg:auto-cols-[calc((100%_-_48px)/3)] lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {entries.map((entry, index) => {
          const active = index === activeIndex;
          return (
            <article
              key={entry.id}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              aria-current={active ? 'true' : undefined}
              onMouseEnter={() => setActiveIndex(index)}
              className={`group relative flex min-h-[490px] snap-start flex-col overflow-hidden rounded-gb-2xl border bg-surface text-fg transition-[border-color,box-shadow,transform] duration-300 motion-reduce:transition-none ${
                active
                  ? '-translate-y-gb-xs border-brand shadow-gb-lg motion-reduce:transform-none'
                  : 'border-line shadow-gb-md hover:-translate-y-gb-xs hover:border-brand hover:shadow-gb-lg motion-reduce:transform-none'
              }`}
            >
              <div aria-hidden="true" className="h-gb-md w-full bg-brand" />

              <div className="flex items-start justify-between gap-gb-xl px-gb-3xl pt-gb-3xl">
                <ScholarshipLogo
                  scholarshipSrc={entry.scholarshipLogoUrl}
                  universitySrc={entry.universityLogoUrl}
                  scholarshipTone={entry.scholarshipLogoTone}
                  scholarshipName={entry.title}
                  universityName={entry.organization}
                />
                <span
                  data-no-auto-translate
                  className="shrink-0 rounded-gb-full bg-brand-subtle px-gb-lg py-gb-md text-gb-xs font-semibold uppercase tracking-[0.08em] text-brand"
                >
                  {entry.ranking || 'Featured'}
                </span>
              </div>

              <div className="flex flex-1 flex-col px-gb-3xl pb-gb-3xl pt-gb-3xl">
                <h3
                  data-no-auto-translate
                  className="line-clamp-2 min-h-[3.5rem] font-display text-gb-2xl font-semibold leading-tight text-fg"
                >
                  {entry.title}
                </h3>
                <p data-no-auto-translate className="mt-gb-md line-clamp-1 text-gb-sm font-semibold text-fg-secondary">
                  {entry.organization}
                </p>

                <div className="mt-gb-2xl rounded-gb-xl border border-brand-subtle bg-brand-subtle p-gb-2xl">
                  <p className="text-gb-xs font-semibold uppercase tracking-[0.1em] text-brand">
                    {entry.valueLabel || 'Scholarship value'}
                  </p>
                  <p
                    data-no-auto-translate
                    className="mt-gb-md line-clamp-2 min-h-[2.75rem] font-display text-gb-xl font-semibold leading-snug text-brand"
                  >
                    {entry.value}
                  </p>
                  {entry.coverage ? (
                    <p data-no-auto-translate className="mt-gb-md line-clamp-1 text-gb-xs font-medium text-fg-secondary">
                      {entry.coverage}
                    </p>
                  ) : null}
                </div>

                <dl className="mt-gb-2xl grid grid-cols-2 gap-x-gb-xl gap-y-gb-xl border-y border-line py-gb-2xl">
                  <div className="min-w-0">
                    <dt className="flex items-center gap-gb-md text-gb-xs font-semibold uppercase tracking-[0.08em] text-fg-muted">
                      <KitIcon art={ICONS.graduationCap} frame={16} />
                      Funding type
                    </dt>
                    <dd data-no-auto-translate className="mt-gb-md truncate text-gb-sm font-semibold text-fg-secondary">
                      {readableFundingType(entry.fundingTypes)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="flex items-center gap-gb-md text-gb-xs font-semibold uppercase tracking-[0.08em] text-fg-muted">
                      <KitIcon art={ICONS.clock} frame={16} />
                      Application window
                    </dt>
                    <dd data-no-auto-translate className="mt-gb-md truncate text-gb-sm font-semibold text-fg-secondary">
                      {entry.deadline || 'Check current dates'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-auto flex items-center gap-gb-xl pt-gb-2xl">
                  <div className="flex min-w-0 items-center gap-gb-md text-gb-sm text-fg-secondary">
                    <span className="shrink-0 text-brand">
                      <KitIcon art={ICONS.markerPin02} frame={16} />
                    </span>
                    <span data-no-auto-translate className="truncate font-semibold">
                      {entry.country || 'Global opportunity'}
                    </span>
                  </div>
                </div>

                <Link
                  href={entry.href}
                  aria-label={`View ${entry.title}`}
                  className="mt-gb-2xl flex min-h-gb-6xl items-center justify-between rounded-gb-lg bg-fg px-gb-xl text-gb-sm font-semibold text-fg-on-inverse transition-colors hover:bg-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  View scholarship
                  <KitIcon art={ICONS.arrowUpRight} frame={18} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
