'use client';

import { useT } from '@/lib/i18n';

type EvidenceStrengthBannerProps = {
  coverage?: number;
  confidence?: number;
  description?: string;
};

export function EvidenceStrengthBanner({
  coverage = 85,
  confidence = 0.8,
  description,
}: EvidenceStrengthBannerProps) {
  const t = useT();

  // Determine active segments out of 5 based on coverage and confidence
  const scoreCombined = (coverage * 0.5 + (confidence * 100) * 0.5);
  const activeSegments = Math.max(1, Math.min(5, Math.round((scoreCombined / 100) * 5)));

  const defaultDesc =
    description ||
    t(
      'This analysis is based on your academic record, test scores, work experience, extracurricular activities, essays, and alignment with the university and programme priorities.',
    );

  const segmentColors = [
    'bg-rose-100',
    'bg-rose-200',
    'bg-rose-400',
    'bg-rose-600',
    'bg-rose-700',
  ];

  return (
    <div className="flex flex-col justify-between gap-gb-lg rounded-gb-2xl border border-line bg-surface p-gb-xl shadow-xs md:flex-row md:items-center">
      {/* Left: Icon + Content */}
      <div className="flex items-start gap-gb-md min-w-0 max-w-2xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-brand">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>

        <div className="flex flex-col gap-gb-2xs">
          <h3 className="text-gb-sm font-bold text-fg">{t('Evidence Behind the Fit')}</h3>
          <p className="text-gb-xs leading-relaxed text-fg-secondary">
            {defaultDesc}
          </p>
        </div>
      </div>

      {/* Right: Segmented Strength Meter */}
      <div className="flex shrink-0 flex-col gap-gb-2xs md:items-end">
        <span className="text-gb-xs font-semibold text-fg-secondary">
          {t('Evidence Strength')}
        </span>

        {/* 5 Segmented Bars */}
        <div className="flex items-center gap-1.5">
          {segmentColors.map((colorClass, idx) => {
            const isActive = idx < activeSegments;
            return (
              <div
                key={idx}
                className={`h-3 w-7 rounded-xs transition-all ${
                  isActive ? colorClass : 'bg-neutral-100'
                }`}
              />
            );
          })}
        </div>

        <div className="flex w-full items-center justify-between text-[10px] font-semibold uppercase text-fg-muted">
          <span>{t('Moderate')}</span>
          <span>{t('Very Strong')}</span>
        </div>
      </div>
    </div>
  );
}
