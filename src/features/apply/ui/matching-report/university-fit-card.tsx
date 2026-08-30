'use client';

import { useT } from '@/lib/i18n';
import { getScoreFitBadge } from './matching-report-hero';

export type UniversityDimension = {
  id: string;
  label: string;
  score: number | null;
  status?: string;
};

type UniversityFitCardProps = {
  score: number | null;
  statusLabel?: string;
  trend?: string | null;
  dimensions: UniversityDimension[];
  insightSummary?: string;
  strongestAlignment?: string;
  primaryOpportunity?: string;
};

export function UniversityFitCard({
  score,
  statusLabel,
  trend,
  dimensions,
  insightSummary,
  strongestAlignment,
  primaryOpportunity,
}: UniversityFitCardProps) {
  const t = useT();

  const pct = score !== null ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  const isAssessed = score !== null;
  const fitInfo = getScoreFitBadge(score);

  // Donut Gauge geometry
  const size = 160;
  const stroke = 12;
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const centre = size / 2;
  const strokeDashoffset = isAssessed ? circumference - (pct / 100) * circumference : circumference;

  const defaultInsight =
    insightSummary ||
    t(
      'You demonstrate a profile with key academic readiness and purposeful intent. Universities in your target tier will evaluate your demonstrated strengths alongside specific programmatic expectations.',
    );

  const defaultStrongest =
    strongestAlignment || t('Academic preparedness and alignment with the learning culture.');

  const defaultOpportunity =
    primaryOpportunity ||
    t('Strengthen research exposure to match the expectations of research-active institutions.');

  return (
    <div className="flex flex-col gap-gb-xl rounded-gb-2xl border border-line bg-surface p-gb-xl sm:p-gb-2xl shadow-xs">
      <div className="grid grid-cols-1 gap-gb-2xl lg:grid-cols-12 lg:items-stretch">
        {/* Column 1: Overall University Fit (Donut Gauge) */}
        <div className="flex flex-col items-center justify-between border-b border-line/60 pb-gb-xl text-center lg:col-span-3 min-w-0 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-gb-xl">
          <div className="flex flex-col items-center gap-gb-2xs">
            <h3 className="text-gb-sm font-bold text-fg">{t('Overall University Fit')}</h3>
          </div>

          <div className="my-auto flex flex-col items-center py-gb-md">
            <div className="relative flex items-center justify-center">
              <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="rotate-[-90deg] transform select-none"
                role="img"
                aria-label={`${t('Overall University Fit')}: ${isAssessed ? `${pct}%` : t('Not assessed')}`}
              >
                {/* Background Ring */}
                <circle
                  cx={centre}
                  cy={centre}
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  className="text-rose-100"
                  strokeWidth={stroke}
                />
                {/* Active Arc */}
                {isAssessed && pct > 0 ? (
                  <circle
                    cx={centre}
                    cy={centre}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    className="text-brand"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{
                      transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                ) : null}
              </svg>

              {/* Center Value */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {isAssessed ? (
                  <>
                    <span className="font-display text-gb-display-md font-bold tracking-tight text-brand">
                      {pct}%
                    </span>
                    <span className="text-gb-xs font-bold text-brand">
                      {t(statusLabel || fitInfo.label)}
                    </span>
                  </>
                ) : (
                  <span className="text-gb-xs font-bold text-fg-muted uppercase">
                    {t('Not assessed')}
                  </span>
                )}
              </div>
            </div>

            {trend ? (
              <div className="mt-gb-md inline-flex items-center gap-1 rounded-full bg-emerald-50 px-gb-md py-gb-2xs text-gb-xs font-semibold text-emerald-700">
                <span>{trend}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Column 2: What Drives Your Fit */}
        <div className="flex flex-col justify-between border-b border-line/60 pb-gb-xl lg:col-span-5 min-w-0 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-gb-xl">
          <div className="flex flex-col gap-gb-2xs">
            <h3 className="text-gb-sm font-bold text-fg">{t('What Drives Your Fit')}</h3>
            <p className="text-gb-xs leading-relaxed text-fg-tertiary">
              {t(
                'Your profile shows evaluation across the key dimensions universities consider when evaluating candidates.',
              )}
            </p>
          </div>

          <div className="mt-gb-md flex flex-col gap-gb-sm">
            {dimensions.map((dim) => {
              const dScore = dim.score !== null ? Math.round(dim.score) : null;
              const isPositive = dScore !== null && dScore >= 60;
              return (
                <div
                  key={dim.id}
                  className="flex items-center justify-between gap-gb-sm rounded-gb-lg p-gb-xs transition-colors hover:bg-surface-subtle/50"
                >
                  <div className="flex items-center gap-gb-sm min-w-0">
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        dScore === null
                          ? 'bg-neutral-200 text-neutral-500'
                          : isPositive
                            ? 'bg-brand text-white'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {isPositive ? (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-[10px] font-bold">!</span>
                      )}
                    </div>
                    <span className="truncate text-gb-sm font-medium text-fg">{t(dim.label)}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    {dScore !== null ? (
                      <span className="text-gb-sm font-bold text-fg">
                        {dScore}{' '}
                        <span className="text-gb-xs font-normal text-fg-muted">/100</span>
                      </span>
                    ) : (
                      <span className="text-gb-xs text-fg-muted">{t('Not assessed')}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 3: Insight Box */}
        <div className="flex flex-col justify-between gap-gb-md lg:col-span-4 min-w-0">
          <div className="flex flex-col gap-gb-sm">
            <div className="flex items-center gap-gb-xs text-brand">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h3 className="text-gb-sm font-bold text-fg">{t('Insight')}</h3>
            </div>
            <p className="text-gb-xs leading-relaxed text-fg-secondary break-words">
              {defaultInsight}
            </p>
          </div>

          <div className="flex flex-col gap-gb-sm border-t border-line/60 pt-gb-md">
            {/* Strongest Alignment */}
            <div className="flex flex-col gap-gb-2xs">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                <svg className="h-3.5 w-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span>{t('Strongest Alignment')}</span>
              </div>
              <p className="text-gb-xs leading-relaxed text-fg-secondary break-words">
                {defaultStrongest}
              </p>
            </div>

            {/* Primary Opportunity */}
            <div className="flex flex-col gap-gb-2xs">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700">
                <svg className="h-3.5 w-3.5 text-amber-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{t('Primary Opportunity')}</span>
              </div>
              <p className="text-gb-xs leading-relaxed text-fg-secondary break-words">
                {defaultOpportunity}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
