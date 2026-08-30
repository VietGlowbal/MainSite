'use client';

import { useT } from '@/lib/i18n';
import { V3ReferenceList, type V3EvidenceItem, type V3TargetSource } from './v3-report-details';

export type TakeawayItem = {
  title: string;
  body: string;
  evidenceIds?: string[];
  targetSourceRefs?: string[];
  metricIds?: string[];
};

export type EvidenceSnapshotItem = {
  id: string;
  label: string;
  score: number | null;
};

type KeyTakeawaysGridProps = {
  strongestFit: TakeawayItem;
  competitiveAdvantage: TakeawayItem;
  criticalGap: TakeawayItem;
  strategicDirection: TakeawayItem;
  evidenceSnapshot: EvidenceSnapshotItem[];
  evidenceIndex?: V3EvidenceItem[] | undefined;
  targetSourceIndex?: V3TargetSource[] | undefined;
  metricLabels?: Record<string, string> | undefined;
};

function cleanTitle(badgeName: string, title?: string): string | null {
  if (!title) return null;
  const trimmed = title.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === badgeName.toLowerCase() || trimmed.toLowerCase() === `${badgeName.toLowerCase()}:`) {
    return null;
  }
  return trimmed;
}

export function KeyTakeawaysGrid({
  strongestFit,
  competitiveAdvantage,
  criticalGap,
  strategicDirection,
  evidenceSnapshot,
  evidenceIndex,
  targetSourceIndex,
  metricLabels,
}: KeyTakeawaysGridProps) {
  const t = useT();

  const title1 = cleanTitle(t('Strongest Fit'), strongestFit.title);
  const title2 = cleanTitle(t('Competitive Advantage'), competitiveAdvantage.title);
  const title3 = cleanTitle(t('Critical Gap'), criticalGap.title);
  const title4 = cleanTitle(t('Strategic Direction'), strategicDirection.title);

  return (
    <div className="grid grid-cols-1 items-start gap-gb-md lg:grid-cols-12">
      {/* Left (8 Cols): 2x2 Strategy Grid with spacious breathing room */}
      <div className="grid grid-cols-1 gap-gb-md sm:grid-cols-2 lg:col-span-8 min-w-0">
        {/* 1. Strongest Fit */}
        <div className="flex flex-col justify-between rounded-gb-2xl border border-line bg-surface p-gb-lg shadow-xs transition-all hover:border-line-strong">
          <div className="flex flex-col gap-gb-xs">
            <div className="flex items-center gap-gb-xs">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-50 text-brand">
                <svg className="h-4 w-4 fill-brand" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <span className="text-gb-xs font-bold text-brand">{t('Strongest Fit')}</span>
            </div>

            {title1 ? (
              <h4 className="mt-gb-2xs text-gb-sm font-semibold text-fg">{title1}</h4>
            ) : null}
            <p className="mt-gb-2xs text-gb-xs leading-relaxed text-fg-secondary break-words">
              {strongestFit.body}
            </p>
            <V3ReferenceList
              evidenceIds={strongestFit.evidenceIds}
              targetSourceRefs={strongestFit.targetSourceRefs}
              metricIds={strongestFit.metricIds}
              metricLabels={metricLabels}
              evidenceIndex={evidenceIndex}
              targetSourceIndex={targetSourceIndex}
            />
          </div>
        </div>

        {/* 2. Competitive Advantage */}
        <div className="flex flex-col justify-between rounded-gb-2xl border border-line bg-surface p-gb-lg shadow-xs transition-all hover:border-line-strong">
          <div className="flex flex-col gap-gb-xs">
            <div className="flex items-center gap-gb-xs">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-50 text-brand">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
              </div>
              <span className="text-gb-xs font-bold text-brand">{t('Competitive Advantage')}</span>
            </div>

            {title2 ? (
              <h4 className="mt-gb-2xs text-gb-sm font-semibold text-fg">{title2}</h4>
            ) : null}
            <p className="mt-gb-2xs text-gb-xs leading-relaxed text-fg-secondary break-words">
              {competitiveAdvantage.body}
            </p>
            <V3ReferenceList
              evidenceIds={competitiveAdvantage.evidenceIds}
              targetSourceRefs={competitiveAdvantage.targetSourceRefs}
              metricIds={competitiveAdvantage.metricIds}
              metricLabels={metricLabels}
              evidenceIndex={evidenceIndex}
              targetSourceIndex={targetSourceIndex}
            />
          </div>
        </div>

        {/* 3. Critical Gap */}
        <div className="flex flex-col justify-between rounded-gb-2xl border border-line bg-surface p-gb-lg shadow-xs transition-all hover:border-line-strong">
          <div className="flex flex-col gap-gb-xs">
            <div className="flex items-center gap-gb-xs">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-50 text-brand">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <span className="text-gb-xs font-bold text-brand">{t('Critical Gap')}</span>
            </div>

            {title3 ? (
              <h4 className="mt-gb-2xs text-gb-sm font-semibold text-fg">{title3}</h4>
            ) : null}
            <p className="mt-gb-2xs text-gb-xs leading-relaxed text-fg-secondary break-words">
              {criticalGap.body}
            </p>
            <V3ReferenceList
              evidenceIds={criticalGap.evidenceIds}
              targetSourceRefs={criticalGap.targetSourceRefs}
              metricIds={criticalGap.metricIds}
              metricLabels={metricLabels}
              evidenceIndex={evidenceIndex}
              targetSourceIndex={targetSourceIndex}
            />
          </div>
        </div>

        {/* 4. Strategic Direction */}
        <div className="flex flex-col justify-between rounded-gb-2xl border border-line bg-surface p-gb-lg shadow-xs transition-all hover:border-line-strong">
          <div className="flex flex-col gap-gb-xs">
            <div className="flex items-center gap-gb-xs">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-50 text-brand">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-gb-xs font-bold text-brand">{t('Strategic Direction')}</span>
            </div>

            {title4 ? (
              <h4 className="mt-gb-2xs text-gb-sm font-semibold text-fg">{title4}</h4>
            ) : null}
            <p className="mt-gb-2xs text-gb-xs leading-relaxed text-fg-secondary break-words">
              {strategicDirection.body}
            </p>
            <V3ReferenceList
              evidenceIds={strategicDirection.evidenceIds}
              targetSourceRefs={strategicDirection.targetSourceRefs}
              metricIds={strategicDirection.metricIds}
              metricLabels={metricLabels}
              evidenceIndex={evidenceIndex}
              targetSourceIndex={targetSourceIndex}
            />
          </div>
        </div>
      </div>

      {/* Right (4 Cols): Evidence Snapshot Card */}
      <div className="flex h-fit flex-col justify-between rounded-gb-2xl border border-line bg-surface p-gb-xl shadow-gb-xs lg:col-span-4 min-w-0">
        <div className="flex flex-col gap-gb-xs">
          <div className="flex items-center justify-between">
            <h4 className="text-gb-sm font-bold text-fg">{t('Evidence Snapshot')}</h4>
            <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold uppercase text-fg-muted">
              {t('Summary')}
            </span>
          </div>
          <p className="text-gb-xs text-fg-muted">{t('Key Dimension Highlights')}</p>

          <div className="mt-gb-md flex flex-col gap-gb-md">
            {evidenceSnapshot.map((item) => {
              const val = item.score !== null ? Math.max(0, Math.min(100, Math.round(item.score))) : null;
              return (
                <div key={item.id} className="flex flex-col gap-gb-2xs">
                  <div className="flex items-center justify-between text-gb-xs">
                    <span className="truncate pr-2 font-medium text-fg-secondary">{t(item.label)}</span>
                    <span className="shrink-0 font-bold text-fg">
                      {val !== null ? `${val}%` : t('N/A')}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                    {val !== null && val > 0 ? (
                      <div
                        className="h-full rounded-full bg-brand transition-all duration-500"
                        style={{ width: `${val}%` }}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-gb-lg border-t border-line/60 pt-gb-sm text-[11px] text-fg-tertiary">
          <p>{t('Dimensional scores reflect evidence verified in your profile.')}</p>
        </div>
      </div>
    </div>
  );
}
