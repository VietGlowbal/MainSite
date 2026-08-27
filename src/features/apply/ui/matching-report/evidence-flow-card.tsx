'use client';

import { useT } from '@/lib/i18n';
import { Badge } from '@/shared/ui';
import type { DimensionKey, FitRow } from '../../domain';

const DIMENSION_ICONS: Record<DimensionKey, React.ReactNode> = {
  academicCompetitiveness: (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ),
  personaAlignment: (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  careerDirection: (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  ),
  financialFeasibility: (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  applicationReadiness: (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
};

export function EvidenceFlowCard({ row }: { row: FitRow }) {
  const t = useT();

  return (
    <div className="flex flex-col gap-gb-lg rounded-gb-2xl border border-line bg-surface p-gb-xl shadow-xs transition-all hover:border-line-strong">
      {/* Header: Icon, Dimension Name, Interpretation & Score */}
      <div className="flex flex-wrap items-center justify-between gap-gb-md border-b border-line/60 pb-gb-md">
        <div className="flex items-center gap-gb-md">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-gb-xl bg-rose-50 text-brand">
            {DIMENSION_ICONS[row.key]}
          </div>
          <div>
            <h4 className="font-display text-gb-lg font-bold text-fg">
              {t(row.label)}
            </h4>
            <p className="text-gb-sm text-fg-tertiary">
              {t(row.meaning)}
            </p>
          </div>
        </div>

        <div>
          {row.assessed ? (
            <span className="font-display text-gb-display-xs font-bold text-brand">
              {row.percent}%
            </span>
          ) : (
            <Badge variant="neutral-chip">{t('Not assessed')}</Badge>
          )}
        </div>
      </div>

      {/* Editorial Content Grid */}
      <div className="grid grid-cols-1 gap-gb-xl pt-gb-xs md:grid-cols-[1.3fr_1fr]">
        {/* Left Column: Assessment and Supporting Evidence */}
        <div className="flex flex-col gap-gb-md">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-fg-muted">
              {t('Evaluation & Assessment')}
            </span>
            <p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-secondary">
              {row.summary || t('No specific assessment recorded for this dimension.')}
            </p>
          </div>

          {row.strengths.length > 0 ? (
            <div className="mt-gb-xs flex flex-col gap-gb-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-fg-muted">
                {t('Documented Evidence')}
              </span>
              <ul className="flex flex-col gap-2 pt-1">
                {row.strengths.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-gb-sm text-fg-secondary">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                      ✓
                    </span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Right Column: Admissions Takeaway */}
        <div className="flex flex-col justify-between rounded-gb-xl border border-line/60 bg-surface-muted/50 p-gb-lg">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand">
              {t('Admissions Reader Takeaway')}
            </span>
            <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-secondary">
              {row.gaps.length > 0
                ? t('Focus area: {gap}', { gap: row.gaps[0] ?? '' })
                : row.limitation
                  ? row.limitation
                  : row.assessed && (row.percent ?? 0) >= 70
                    ? t('Strong positive signal that reinforces applicant distinction.')
                    : t('Meets baseline expectations for this cohort.')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
