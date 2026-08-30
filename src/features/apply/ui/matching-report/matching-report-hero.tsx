'use client';

import { useT } from '@/lib/i18n';
import { MATCH_SCORE_DISCLAIMER } from '../../domain';

type HeroProps = {
  universityName: string;
  courseName: string;
  universityFitScore: number | null;
  universityFitLabel?: string;
  universityTrend?: string | null;
  programmeFitScore: number | null;
  programmeFitLabel?: string;
  programmeTrend?: string | null;
  criticalGapTitle?: string | null;
  criticalGapDescription?: string | null;
};

export function MatchingReportHero({
  universityName,
  courseName,
  universityFitScore,
  universityFitLabel,
  universityTrend = '↑ 4% vs last run',
  programmeFitScore,
  programmeFitLabel,
  programmeTrend = '↑ 3% vs last run',
  criticalGapTitle,
  criticalGapDescription,
}: HeroProps) {
  const t = useT();

  const uScore = universityFitScore !== null ? Math.round(universityFitScore) : null;
  const pScore = programmeFitScore !== null ? Math.round(programmeFitScore) : null;

  const defaultGapTitle = criticalGapTitle || t('Research Exposure');
  const defaultGapDesc = criticalGapDescription || t('Main area to strengthen for this profile.');

  return (
    <div className="flex flex-col gap-gb-xl rounded-gb-2xl border border-line bg-surface p-gb-2xl shadow-xs transition-all duration-200">
      <div className="grid grid-cols-1 gap-gb-xl lg:grid-cols-12 lg:items-center">
        {/* Left: Graphic + Title + Description */}
        <div className="flex flex-col gap-gb-lg sm:flex-row sm:items-start lg:col-span-6 xl:col-span-7">
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
            <p className="text-gb-xs italic text-fg-muted">
              {t(MATCH_SCORE_DISCLAIMER)}
            </p>
          </div>
        </div>

        {/* Right: 3 Key Metric Blocks */}
        <div className="grid grid-cols-1 gap-gb-md sm:grid-cols-3 lg:col-span-6 xl:col-span-5">
          {/* 1. University Fit */}
          <div className="flex flex-col justify-between rounded-gb-xl border border-line/60 bg-surface-subtle/50 p-gb-lg">
            <div className="flex flex-col gap-gb-2xs">
              <span className="text-gb-xs font-medium text-fg-muted">{t('University Fit')}</span>
              <div className="flex items-baseline gap-gb-xs">
                <span className="font-display text-gb-display-xs font-bold text-brand">
                  {uScore !== null ? `${uScore}%` : t('N/A')}
                </span>
              </div>
              <span className="text-gb-xs font-semibold text-brand">
                {t(universityFitLabel || 'Strong Fit')}
              </span>
            </div>
            {universityTrend ? (
              <div className="mt-gb-sm flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <span>{universityTrend}</span>
              </div>
            ) : null}
          </div>

          {/* 2. Programme Fit */}
          <div className="flex flex-col justify-between rounded-gb-xl border border-line/60 bg-surface-subtle/50 p-gb-lg">
            <div className="flex flex-col gap-gb-2xs">
              <span className="text-gb-xs font-medium text-fg-muted">{t('Programme Fit')}</span>
              <div className="flex items-baseline gap-gb-xs">
                <span className="font-display text-gb-display-xs font-bold text-brand">
                  {pScore !== null ? `${pScore}%` : t('N/A')}
                </span>
              </div>
              <span className="text-gb-xs font-semibold text-brand">
                {t(programmeFitLabel || 'Strong Fit')}
              </span>
            </div>
            {programmeTrend ? (
              <div className="mt-gb-sm flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <span>{programmeTrend}</span>
              </div>
            ) : null}
          </div>

          {/* 3. Critical Gap */}
          <div className="flex flex-col justify-between rounded-gb-xl border border-line/60 bg-surface-subtle/50 p-gb-lg">
            <div className="flex flex-col gap-gb-2xs">
              <div className="flex items-center justify-between">
                <span className="text-gb-xs font-medium text-fg-muted">{t('Critical Gap')}</span>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-brand">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <span className="truncate text-gb-sm font-bold text-brand" title={defaultGapTitle}>
                {defaultGapTitle}
              </span>
            </div>
            <p className="mt-gb-xs text-[11px] leading-tight text-fg-tertiary">
              {defaultGapDesc}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
