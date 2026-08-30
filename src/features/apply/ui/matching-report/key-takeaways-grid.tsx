'use client';

import { useT } from '@/lib/i18n';

export type TakeawayItem = {
  title: string;
  body: string;
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
};

export function KeyTakeawaysGrid({
  strongestFit,
  competitiveAdvantage,
  criticalGap,
  strategicDirection,
  evidenceSnapshot,
}: KeyTakeawaysGridProps) {
  const t = useT();

  return (
    <div className="grid grid-cols-1 gap-gb-md sm:grid-cols-2 lg:grid-cols-5">
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

          <h4 className="mt-gb-2xs text-gb-sm font-semibold text-fg">
            {strongestFit.title}
          </h4>
          <p className="text-gb-xs leading-relaxed text-fg-secondary">
            {strongestFit.body}
          </p>
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

          <h4 className="mt-gb-2xs text-gb-sm font-semibold text-fg">
            {competitiveAdvantage.title}
          </h4>
          <p className="text-gb-xs leading-relaxed text-fg-secondary">
            {competitiveAdvantage.body}
          </p>
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

          <h4 className="mt-gb-2xs text-gb-sm font-semibold text-fg">
            {criticalGap.title}
          </h4>
          <p className="text-gb-xs leading-relaxed text-fg-secondary">
            {criticalGap.body}
          </p>
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

          <h4 className="mt-gb-2xs text-gb-sm font-semibold text-fg">
            {strategicDirection.title}
          </h4>
          <p className="text-gb-xs leading-relaxed text-fg-secondary">
            {strategicDirection.body}
          </p>
        </div>
      </div>

      {/* 5. Evidence Snapshot */}
      <div className="flex flex-col justify-between rounded-gb-2xl border border-line bg-surface p-gb-lg shadow-xs transition-all hover:border-line-strong">
        <div className="flex flex-col gap-gb-xs">
          <h4 className="text-gb-sm font-bold text-fg">{t('Evidence Snapshot')}</h4>
          <p className="text-[11px] text-fg-muted">{t('Key Dimension Highlights')}</p>

          <div className="mt-gb-xs flex flex-col gap-gb-xs">
            {evidenceSnapshot.map((item) => {
              const val = item.score !== null ? Math.max(0, Math.min(100, Math.round(item.score))) : null;
              return (
                <div key={item.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="truncate pr-1 font-medium text-fg-secondary">{t(item.label)}</span>
                    <span className="shrink-0 font-bold text-fg">
                      {val !== null ? `${val}%` : t('N/A')}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                    {val !== null && val > 0 ? (
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${val}%` }}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
