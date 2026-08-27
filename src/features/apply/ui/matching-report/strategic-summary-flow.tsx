'use client';

import { useT } from '@/lib/i18n';
import { Button } from '@/shared/ui';
import type { GapEntry, MatchingReportPageData, MatchSummary } from '../../domain';

function FlowConnector() {
  return (
    <div className="hidden shrink-0 items-center justify-center text-rose-300 lg:flex" aria-hidden="true">
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
      </svg>
    </div>
  );
}

export function StrategicSummaryFlow({
  data,
  summary,
  gaps,
}: {
  data: MatchingReportPageData;
  summary: MatchSummary;
  gaps: GapEntry[];
}) {
  const t = useT();
  const firstCritical = gaps.find((gap) => gap.tier === 'critical');
  const firstCompetitive = gaps.find((gap) => gap.tier === 'competitive');

  // Strength narrative
  const strengthText = summary.alignment !== 'Not assessed'
    ? t('{level} alignment overall based on verified profile competencies.', { level: t(summary.alignment) })
    : t('Profile shows documented foundational experience for this course.');

  // Opportunity narrative
  const opportunityText = summary.blockingRequirements.length > 0
    ? t('Resolve pending eligibility verification to unlock submission confidence.')
    : firstCritical
      ? t('Target key growth in {dimension} to maximize competitiveness.', { dimension: t(firstCritical.dimension) })
      : firstCompetitive
        ? t('Refine {dimension} to strengthen application distinction.', { dimension: t(firstCompetitive.dimension) })
        : t('Strengthen your narrative alignment with university priorities.');

  return (
    <div className="flex flex-col gap-gb-md lg:flex-row lg:items-stretch">
      {/* 1. Biggest Strength */}
      <div className="flex flex-1 flex-col justify-between rounded-gb-2xl border border-line bg-surface p-gb-xl shadow-xs">
        <div className="flex flex-col gap-gb-sm">
          <span className="w-fit rounded-full bg-emerald-50 px-2.5 py-0.5 text-gb-xxs font-bold uppercase tracking-wider text-emerald-700">
            1. {t('Biggest Strength')}
          </span>
          <h4 className="font-display text-gb-sm font-semibold text-fg">
            {t('Core Profile Alignment')}
          </h4>
          <p className="text-gb-xs leading-relaxed text-fg-secondary">
            {strengthText}
          </p>
        </div>
        <div className="mt-gb-md border-t border-line/60 pt-gb-sm">
          <span className="text-[11px] font-medium text-emerald-600">
            ✓ {t('Positive foundation')}
          </span>
        </div>
      </div>

      <FlowConnector />

      {/* 2. Biggest Opportunity */}
      <div className="flex flex-1 flex-col justify-between rounded-gb-2xl border border-line bg-surface p-gb-xl shadow-xs">
        <div className="flex flex-col gap-gb-sm">
          <span className="w-fit rounded-full bg-amber-50 px-2.5 py-0.5 text-gb-xxs font-bold uppercase tracking-wider text-amber-700">
            2. {t('Biggest Opportunity')}
          </span>
          <h4 className="font-display text-gb-sm font-semibold text-fg">
            {t('Strategic Focus Area')}
          </h4>
          <p className="text-gb-xs leading-relaxed text-fg-secondary">
            {opportunityText}
          </p>
        </div>
        <div className="mt-gb-md border-t border-line/60 pt-gb-sm">
          <span className="text-[11px] font-medium text-amber-600">
            ⚡ {t('High-impact enhancement')}
          </span>
        </div>
      </div>

      <FlowConnector />

      {/* 3. Next Best Action (Integrated CTA) */}
      <div className="flex flex-1 flex-col justify-between rounded-gb-2xl border border-rose-200 bg-gradient-to-br from-rose-50/50 via-white to-white p-gb-xl shadow-xs">
        <div className="flex flex-col gap-gb-sm">
          <span className="w-fit rounded-full bg-brand/10 px-2.5 py-0.5 text-gb-xxs font-bold uppercase tracking-wider text-brand">
            3. {t('Next Best Action')}
          </span>
          <h4 className="font-display text-gb-sm font-semibold text-fg">
            {t('Execute Strategic Roadmap')}
          </h4>
          <p className="text-gb-xs leading-relaxed text-fg-secondary">
            {t('Convert these insights into prioritized application tasks with step-by-step guidance.')}
          </p>
        </div>

        <div className="mt-gb-md flex flex-col gap-gb-xs border-t border-rose-200/60 pt-gb-sm">
          <Button href={`/ai-strategy/${data.id}/strategy-report`} size="sm" className="w-full justify-center">
            {t('Open my Strategy Report')}
          </Button>
          <Button href={`/ai-strategy/${data.id}/planner`} variant="secondary" size="sm" className="w-full justify-center">
            {t('Go to my Planner')}
          </Button>
        </div>
      </div>
    </div>
  );
}
