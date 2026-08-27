'use client';

import { useT } from '@/lib/i18n';
import { CheckItem, CheckList } from '@/shared/ui';
import type { FitRow, MatchSummary } from '../../domain';

export function AdmissionsPerspectiveCanvas({
  summary,
  rows,
  strengths,
  unchecked,
  limitations,
}: {
  summary: MatchSummary;
  rows: FitRow[];
  strengths: string[];
  unchecked: FitRow[];
  limitations: string[];
}) {
  const t = useT();

  const strongest = rows
    .filter((row) => row.assessed)
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))[0];

  return (
    <div className="relative rounded-gb-2xl border border-line bg-surface shadow-xs overflow-hidden">
      {/* Central Admissions Emblem (Desktop decoration) */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:flex h-12 w-12 items-center justify-center rounded-full border border-rose-200 bg-white/95 text-brand shadow-sm"
        aria-hidden="true"
      >
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>

      {/* 2 × 2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-line">
        {/* Top-Left: First Impression */}
        <div className="flex flex-col gap-gb-md p-gb-xl bg-gradient-to-br from-rose-50/30 to-transparent">
          <div className="flex items-center gap-gb-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-brand text-gb-xs font-bold">
              1
            </span>
            <h3 className="font-display text-gb-md font-semibold text-fg">
              {t('First Impression')}
            </h3>
          </div>
          <p className="text-gb-sm leading-relaxed text-fg-secondary">
            {t(summary.meaning)}
          </p>
          {strongest ? (
            <p className="text-gb-xs leading-relaxed text-fg-tertiary">
              {t('Your strongest dimension here is {dimension}.', {
                dimension: t(strongest.label),
              })}
            </p>
          ) : null}
        </div>

        {/* Top-Right: What Strengthens Your Application */}
        <div className="flex flex-col gap-gb-md p-gb-xl bg-gradient-to-bl from-rose-50/30 to-transparent">
          <div className="flex items-center gap-gb-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-brand text-gb-xs font-bold">
              2
            </span>
            <h3 className="font-display text-gb-md font-semibold text-fg">
              {t('What Strengthens Your Application')}
            </h3>
          </div>
          {strengths.length > 0 ? (
            <CheckList>
              {strengths.slice(0, 4).map((strength) => (
                <CheckItem key={strength}>{strength}</CheckItem>
              ))}
            </CheckList>
          ) : (
            <p className="text-gb-sm text-fg-muted">
              {t('No evidence-backed strengths were recorded for this programme yet.')}
            </p>
          )}
        </div>

        {/* Bottom-Left: Questions We Still Have / Unchecked Facts */}
        <div className="flex flex-col gap-gb-md p-gb-xl border-t border-line">
          <div className="flex items-center gap-gb-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-fg-muted text-gb-xs font-bold">
              3
            </span>
            <h3 className="font-display text-gb-md font-semibold text-fg">
              {t('Questions We Still Have')}
            </h3>
          </div>
          <p className="text-gb-xs text-fg-muted">
            {t('Information gaps in published or verified sources that may need clarification:')}
          </p>
          {unchecked.length > 0 ? (
            <ul className="flex flex-col gap-gb-xs text-gb-xs text-fg-secondary">
              {unchecked.map((row) => (
                <li key={row.key} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                  {t(row.label)}
                </li>
              ))}
            </ul>
          ) : null}
          {limitations.length > 0 ? (
            <ul className="list-disc space-y-gb-2xs pl-gb-md text-gb-xs text-fg-tertiary">
              {limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Bottom-Right: What We'd Like to See */}
        <div className="flex flex-col gap-gb-md p-gb-xl border-t border-line">
          <div className="flex items-center gap-gb-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-brand text-gb-xs font-bold">
              4
            </span>
            <h3 className="font-display text-gb-md font-semibold text-fg">
              {t("What We'd Like to See")}
            </h3>
          </div>
          <p className="text-gb-sm leading-relaxed text-fg-secondary">
            {summary.blockingRequirements.length > 0
              ? t('Focus immediately on validating entry eligibility criteria.')
              : t('Deepen specific evidence in your portfolio and personal statement highlighting your alignment with this curriculum.')}
          </p>
          <p className="text-gb-xs text-fg-tertiary">
            {t('Admissions committees look for coherence between your past work, current skills, and future ambition.')}
          </p>
        </div>
      </div>
    </div>
  );
}
