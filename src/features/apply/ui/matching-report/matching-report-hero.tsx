'use client';

import { useT } from '@/lib/i18n';
import { MATCH_SCORE_DISCLAIMER } from '../../domain';

type HeroProps = {
  universityFitScore: number | null;
  universityFitLabel?: string;
  universityTrend?: string | null;
  programmeFitScore: number | null;
  programmeFitLabel?: string;
  programmeTrend?: string | null;
  criticalGapTitle?: string | null;
  criticalGapDescription?: string | null;
  overallAlignmentScore?: number | null;
  overallSummary?: string | null;
};

export function getScoreFitBadge(score: number | null) {
  if (score === null) {
    return {
      label: 'Not assessed',
      textColor: 'text-fg-muted',
      badgeClass: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    };
  }
  if (score >= 80) {
    return {
      label: 'Strong Fit',
      textColor: 'text-emerald-700',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }
  if (score >= 65) {
    return {
      label: 'Good Fit',
      textColor: 'text-blue-700',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    };
  }
  if (score >= 50) {
    return {
      label: 'Moderate Fit',
      textColor: 'text-amber-700',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }
  return {
    label: 'Limited Fit',
    textColor: 'text-brand',
    badgeClass: 'bg-rose-50 text-brand border-rose-200',
  };
}

export function MatchingReportHero({
  universityFitScore,
  universityFitLabel,
  universityTrend,
  programmeFitScore,
  programmeFitLabel,
  programmeTrend,
  criticalGapTitle,
  criticalGapDescription,
  overallAlignmentScore,
  overallSummary,
}: HeroProps) {
  const t = useT();

  const uScore = universityFitScore !== null ? Math.round(universityFitScore) : null;
  const pScore = programmeFitScore !== null ? Math.round(programmeFitScore) : null;

  const uBadge = getScoreFitBadge(uScore);
  const pBadge = getScoreFitBadge(pScore);

  const rawGapTitle = criticalGapTitle?.trim();
  const isGenericGapTitle = !rawGapTitle || rawGapTitle.toLowerCase() === 'critical gap' || rawGapTitle.toLowerCase() === 'critical gap:';
  const displayGapTitle = isGenericGapTitle ? t('Profile Alignment & Evidence') : rawGapTitle;
  const displayGapDesc = criticalGapDescription || t('Main area to strengthen for this profile.');

  return (
    <div className="flex flex-col gap-gb-lg rounded-gb-2xl border border-line bg-surface p-gb-lg shadow-gb-xs sm:p-gb-xl transition-all duration-200">
      <div className="grid grid-cols-1 gap-gb-lg lg:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)] lg:items-start">
        {/* Left: Graphic + Title + Description */}
        <div className="flex min-w-0 flex-col gap-gb-md sm:flex-row sm:items-start">
          {/* Target / Bullseye SVG Icon */}
          <div className="relative flex shrink-0 items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50/80 sm:h-20 sm:w-20">
              <svg
                viewBox="0 0 80 80"
                className="h-14 w-14 sm:h-16 sm:w-16 select-none"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                {/* Outer Ring */}
                <circle cx="40" cy="40" r="34" stroke="currentColor" className="text-brand/25" strokeWidth="2.5" />
                {/* Middle Ring */}
                <circle cx="40" cy="40" r="23" stroke="currentColor" className="text-brand/50" strokeWidth="3" />
                {/* Inner Ring */}
                <circle cx="40" cy="40" r="12" stroke="currentColor" className="text-brand" strokeWidth="3.5" />
                {/* Center Bullseye */}
                <circle cx="40" cy="40" r="5" fill="currentColor" className="text-brand" />
                {/* Arrow Shaft & Flight */}
                <path
                  d="M14 66L36 44"
                  stroke="currentColor"
                  className="text-brand"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <path
                  d="M10 66L14 70L22 62"
                  stroke="currentColor"
                  className="text-brand"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 66L18 58"
                  stroke="currentColor"
                  className="text-brand"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-gb-xs">
            <h2 className="font-display text-gb-xl font-bold tracking-tight text-brand sm:text-gb-display-xs">
              {t('Applicant–Target Matching')}
            </h2>
            <p className="text-gb-sm leading-relaxed text-fg-secondary">
              {t(
                'This report evaluates how well your profile aligns with the target university and programme based on academic, experiential, and strategic factors.',
              )}
            </p>
            {overallSummary ? (
              <details className="group rounded-gb-lg border border-line/70 bg-surface-subtle/40 px-gb-md py-gb-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-gb-sm text-gb-xs font-semibold text-fg [&::-webkit-details-marker]:hidden">
                  <span>{t('Summary')}</span>
                  <span className="text-brand transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
                </summary>
                <p className="mt-gb-sm border-t border-line/60 pt-gb-sm text-gb-xs leading-relaxed text-fg-secondary">
                  {overallSummary}
                </p>
              </details>
            ) : null}
            {overallAlignmentScore !== undefined ? (
              <p className="text-gb-xs font-semibold text-brand">
                {t('Overall alignment')}: {overallAlignmentScore === null ? t('Not assessed') : `${Math.round(overallAlignmentScore)}%`}
              </p>
            ) : null}
            <p className="text-gb-xs italic text-fg-muted">
              {t(MATCH_SCORE_DISCLAIMER)}
            </p>
          </div>
        </div>

        {/* Right: 3 Key Metric Blocks */}
        <div className="grid grid-cols-1 gap-gb-sm sm:grid-cols-3">
          {/* 1. University Fit */}
          <div className="flex min-h-[132px] flex-col justify-between rounded-gb-xl border border-line/70 bg-surface-subtle/50 p-gb-md transition-all hover:border-line-strong">
            <div className="flex flex-col gap-gb-2xs">
              <span className="text-gb-xs font-semibold text-fg-muted">{t('University Fit')}</span>
              <div className="flex items-baseline gap-gb-xs">
                <span className="font-display text-gb-display-sm font-bold text-brand">
                  {uScore !== null ? `${uScore}%` : t('N/A')}
                </span>
              </div>
              <span className={`w-fit rounded-full border px-2 py-0.5 text-[11px] font-bold ${uBadge.badgeClass}`}>
                {t(universityFitLabel || uBadge.label)}
              </span>
            </div>
            {universityTrend ? (
              <div className="mt-gb-xs flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <span>{universityTrend}</span>
              </div>
            ) : (
              <span className="mt-gb-xs text-[11px] text-fg-muted">{t('Current Evaluation')}</span>
            )}
          </div>

          {/* 2. Programme Fit */}
          <div className="flex min-h-[132px] flex-col justify-between rounded-gb-xl border border-line/70 bg-surface-subtle/50 p-gb-md transition-all hover:border-line-strong">
            <div className="flex flex-col gap-gb-2xs">
              <span className="text-gb-xs font-semibold text-fg-muted">{t('Programme Fit')}</span>
              <div className="flex items-baseline gap-gb-xs">
                <span className="font-display text-gb-display-sm font-bold text-brand">
                  {pScore !== null ? `${pScore}%` : t('N/A')}
                </span>
              </div>
              <span className={`w-fit rounded-full border px-2 py-0.5 text-[11px] font-bold ${pBadge.badgeClass}`}>
                {t(programmeFitLabel || pBadge.label)}
              </span>
            </div>
            {programmeTrend ? (
              <div className="mt-gb-xs flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <span>{programmeTrend}</span>
              </div>
            ) : (
              <span className="mt-gb-xs text-[11px] text-fg-muted">{t('Current Evaluation')}</span>
            )}
          </div>

          {/* 3. Critical Gap */}
          <div className="flex min-h-[132px] flex-col justify-between rounded-gb-xl border border-line/70 bg-surface-subtle/50 p-gb-md transition-all hover:border-line-strong">
            <div className="flex flex-col gap-gb-2xs">
              <div className="flex items-center justify-between">
                <span className="text-gb-xs font-semibold text-fg-muted">{t('Critical Gap')}</span>
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-brand">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <span className="line-clamp-1 text-gb-xs font-bold text-brand" title={displayGapTitle}>
                {displayGapTitle}
              </span>
            </div>
            <p className="mt-gb-xs line-clamp-3 text-[11px] leading-relaxed text-fg-secondary" title={displayGapDesc}>
              {displayGapDesc}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
