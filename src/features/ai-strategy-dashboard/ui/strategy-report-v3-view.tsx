'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Badge } from '@/shared/ui';
import { useLanguage } from '@/lib/i18n';
import type {
  ActivityStrategyAnalysis,
  ActivityStrategyClassification,
  ProfileAreaDiagnosis,
  StrategyReportV3,
} from '@/lib/ai/strategy-v3/domain';

type Overrides = Record<string, Record<string, unknown>>;

const FILTERS: Array<'all' | ActivityStrategyClassification> = [
  'all',
  'maintain',
  'develop',
  'consolidate',
  'reposition',
  'deprioritize',
];

function cn(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(' ');
}

function formatIdentifier(value: string): string {
  if (!value) return '';
  return value
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ──────────────────────────────────────────────────────────────────────────
   Crafted SVG Icons
   ────────────────────────────────────────────────────────────────────────── */

function SparklesIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function CheckCircleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function AlertTriangleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function TrendingUpIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function TargetIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function AwardIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
    </svg>
  );
}

function AcademicCapIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M12 14l9-5-9-5-9 5 9 5z" />
      <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14v7" />
    </svg>
  );
}

function BriefcaseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function DocumentCheckIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function CompassIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fillOpacity="0.25" />
    </svg>
  );
}

function FlameIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
    </svg>
  );
}

function LayersIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

function LightBulbIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function ArrowRightIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}

function CalendarIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export function StrategyReportV3View({
  applicationId,
  report,
}: {
  applicationId: string;
  report: StrategyReportV3;
}) {
  const { t } = useLanguage();
  const [overrides, setOverrides] = useState<Overrides>({});
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [overrideError, setOverrideError] = useState(false);
  const saveSequence = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/applications/${applicationId}/report-overrides?kind=strategy_v3`)
      .then((res) => {
        if (!res.ok) throw new Error('Override load failed');
        return res.json();
      })
      .then((body: { overrides?: Overrides }) => {
        if (!cancelled && body.overrides) setOverrides(body.overrides);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const saveOverride = (
    itemKey: string,
    field: 'title' | 'why' | 'suggestedDirection',
    value: string,
  ) => {
    const requestId = ++saveSequence.current;
    const previous = overrides[itemKey]?.[field];
    setOverrideError(false);
    setOverrides((current) => ({
      ...current,
      [itemKey]: { ...current[itemKey], [field]: value },
    }));
    void fetch(`/api/applications/${applicationId}/report-overrides`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'strategy_v3', itemKey, field, value }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Override save failed');
      })
      .catch(() => {
        if (requestId !== saveSequence.current) return;
        setOverrides((current) => {
          const item = { ...(current[itemKey] ?? {}) };
          if (previous === undefined) delete item[field];
          else item[field] = previous;
          return { ...current, [itemKey]: item };
        });
        setOverrideError(true);
      });
  };

  const activities = report.profileDevelopmentStrategy.activityAnalyses.filter(
    (activity) => filter === 'all' || activity.classification === filter,
  );
  const compressedTimeline = report.strategicRoadmap.some((phase) => /compressed execution/i.test(phase.estimatedTimeline));

  return (
    <div className="flex flex-col gap-gb-4xl pb-16" data-no-auto-translate data-report-auto-translate>
      {/* ─── APPLICANT-FACING REPORT HEADER ─────────────────────────────── */}
      <div className="rounded-3xl border border-line bg-surface p-gb-xl shadow-sm sm:p-8">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{t('Your Application Strategy')}</p>
          <h1 className="max-w-4xl font-display text-2xl font-black tracking-tight text-fg sm:text-3xl lg:text-4xl">
            {t('Your Application Strategy')}
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-fg-secondary">
            {t('A focused plan based on your current profile, target programme, and available evidence.')}
          </p>
        </div>

          {/* Anchor Navigation Pills */}
          <div className="mt-3 flex flex-wrap gap-2 border-t border-rose-200/60 pt-4">
            <a
              href="#strategic-overview"
              className="inline-flex items-center gap-1.5 rounded-full border border-line/80 bg-white/90 px-4 py-2 text-xs font-bold text-fg-secondary shadow-2xs backdrop-blur-xs transition-all hover:border-brand hover:bg-rose-50/80 hover:text-brand"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-100 text-[10px] font-bold text-brand">1</span>
              {t('Strategic Overview')}
            </a>
            <a
              href="#profile-development"
              className="inline-flex items-center gap-1.5 rounded-full border border-line/80 bg-white/90 px-4 py-2 text-xs font-bold text-fg-secondary shadow-2xs backdrop-blur-xs transition-all hover:border-brand hover:bg-rose-50/80 hover:text-brand"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-100 text-[10px] font-bold text-brand">2</span>
              {t('Profile Development')}
            </a>
            <a
              href="#narrative-strategy"
              className="inline-flex items-center gap-1.5 rounded-full border border-line/80 bg-white/90 px-4 py-2 text-xs font-bold text-fg-secondary shadow-2xs backdrop-blur-xs transition-all hover:border-brand hover:bg-rose-50/80 hover:text-brand"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-100 text-[10px] font-bold text-brand">3</span>
              {t('Narrative Strategy')}
            </a>
            <a
              href="#strategic-roadmap"
              className="inline-flex items-center gap-1.5 rounded-full border border-line/80 bg-white/90 px-4 py-2 text-xs font-bold text-fg-secondary shadow-2xs backdrop-blur-xs transition-all hover:border-brand hover:bg-rose-50/80 hover:text-brand"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-100 text-[10px] font-bold text-brand">4</span>
              {t('Execution Roadmap')}
            </a>
          </div>
      </div>

      {/* ─── SECTION 1: STRATEGIC OVERVIEW ───────────────────────────────── */}
      <section id="strategic-overview" aria-labelledby="strategy-v3-overview" className="flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-black text-white shadow-xs">
              01
            </span>
            <div>
              <h2 id="strategy-v3-overview" className="font-display text-lg font-bold tracking-tight text-fg sm:text-xl">
                {t('Strategic Overview')}
              </h2>
              <p className="text-xs text-fg-muted">{t('A concise view of your current position and next priorities')}</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex rounded-full bg-surface-subtle px-3 py-1 text-[11px] font-semibold text-fg-muted">
            {t('Step 1 of 4')}
          </span>
        </div>

        <div className="flex flex-col gap-6">
          {overrideError ? (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-fg-error shadow-xs">
              <AlertTriangleIcon className="h-5 w-5 shrink-0" />
              <span>{t('Could not save this edit. Please try again.')}</span>
            </div>
          ) : null}

          <p className="max-w-3xl text-base leading-relaxed text-fg-secondary">
            {report.strategicOverview.currentPosition.summary}
          </p>

          {/* Top 3 Core Positioning Pillar Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <PositionBlock
              type="strength"
              icon={CheckCircleIcon}
              badgeText="CORE ASSET"
              label={t('Profile Strength')}
              value={report.strategicOverview.currentPosition.profileStrength.statement}
            />
            <PositionBlock
              type="challenge"
              icon={AlertTriangleIcon}
              badgeText="CRITICAL BOTTLENECK"
              label={t('Key Challenge')}
              value={report.strategicOverview.currentPosition.keyChallenge.statement}
            />
            <PositionBlock
              type="opportunity"
              icon={TrendingUpIcon}
              badgeText="GROWTH CATALYST"
              label={t('Strategic Opportunity')}
              value={report.strategicOverview.strategicOpportunity.statement}
            />
          </div>

          {report.strategicOverview.currentPosition.unclearArea || report.strategicOverview.currentPosition.differentiatedPotential ? (
            <div className="grid gap-4 border-y border-line/70 py-5 md:grid-cols-2">
              {report.strategicOverview.currentPosition.unclearArea ? (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-fg-muted">{t('What is still unclear')}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
                    {report.strategicOverview.currentPosition.unclearArea.statement}
                  </p>
                </div>
              ) : null}
              {report.strategicOverview.currentPosition.differentiatedPotential ? (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-fg-muted">{t('Potential differentiation')}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
                    {report.strategicOverview.currentPosition.differentiatedPotential.statement}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* 2 Strategic Direction & Outcome Highlights */}
          <div className="grid gap-4 md:grid-cols-2">
            <GoalBlock
              icon={CompassIcon}
              label={t('Strategic Goal')}
              tag="STRATEGIC DIRECTION"
              value={`${report.strategicOverview.strategicGoal.directionOfImprovement} ${report.strategicOverview.strategicGoal.communicationGoal}`}
            />
            <GoalBlock
              icon={AwardIcon}
              label={t('Expected Outcome')}
              tag="TARGET TRANSFORMATION"
              value={report.strategicOverview.expectedOutcome}
            />
          </div>

          {/* Top Three Priorities Section */}
          <div className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-brand border border-rose-200">
                  <TargetIcon className="h-4.5 w-4.5 text-brand" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-fg">{t('Top Three Strategic Priorities')}</h3>
                  <p className="text-xs text-fg-muted">{t('Priorities are ranked by potential impact, relevance to your target, evidence gaps, feasibility, and urgency.')}</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-brand bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                {t('3 Focus Areas')}
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {report.strategicOverview.topPriorities.map((priority) => (
                <PriorityCard
                  key={priority.key}
                  priority={priority}
                  overrides={overrides}
                  onSave={saveOverride}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: PROFILE DEVELOPMENT STRATEGY ────────────────────── */}
      <section id="profile-development" aria-labelledby="strategy-v3-profile" className="flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-black text-white shadow-xs">
              02
            </span>
            <div>
              <h2 id="strategy-v3-profile" className="font-display text-lg font-bold tracking-tight text-fg sm:text-xl">
                {t('Profile Development Strategy')}
              </h2>
              <p className="text-xs text-fg-muted">{t('Dimension diagnostics and specific portfolio interventions')}</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex rounded-full bg-surface-subtle px-3 py-1 text-[11px] font-semibold text-fg-muted">
            {t('Step 2 of 4')}
          </span>
        </div>

        {/* 4 Area Diagnostic Hub (Academic, Experience, Differentiation, Evidence) */}
        <div className="grid gap-4 sm:grid-cols-2">
          {report.profileDevelopmentStrategy.areas.map((area) => (
            <ProfileAreaCard key={area.key} area={area} />
          ))}
        </div>

        {/* Activity-Level Analysis Deep Dive */}
        <div className="flex flex-col gap-6 rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/60 pb-5">
            <div>
              <h3 className="text-base font-bold text-fg">{t('Activity-Level Strategic Evaluation')}</h3>
              <p className="text-xs text-fg-muted">{t('Individual appraisal and recommended posture for each profile entry')}</p>
            </div>

            {/* Segmented Filter Pills */}
            <div className="flex flex-wrap gap-1 rounded-2xl bg-surface-subtle/80 p-1 border border-line/60" role="group" aria-label={t('Filter activity analysis')}>
              {FILTERS.map((value) => {
                const isSelected = filter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setFilter(value)}
                    className={cn(
                      'rounded-xl px-3 py-1.5 text-xs font-bold transition-all',
                      isSelected
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-fg-secondary hover:text-fg hover:bg-surface'
                    )}
                  >
                    {t(value === 'all' ? 'All' : formatIdentifier(value))}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {activities.map((activity) => (
              <ActivityCard key={activity.activityId} activity={activity} report={report} />
            ))}
            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line p-10 text-center">
                <p className="text-sm font-semibold text-fg-muted">{t('No activities match this filter.')}</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ─── SECTION 3: NARRATIVE STRATEGY ──────────────────────────────── */}
      <section id="narrative-strategy" aria-labelledby="strategy-v3-narrative" className="flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-black text-white shadow-xs">
              03
            </span>
            <div>
              <h2 id="strategy-v3-narrative" className="font-display text-lg font-bold tracking-tight text-fg sm:text-xl">
                {t('Narrative Strategy')}
              </h2>
              <p className="text-xs text-fg-muted">{t('Cohesive storytelling arc, thematic hooks, and tension resolutions')}</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex rounded-full bg-surface-subtle px-3 py-1 text-[11px] font-semibold text-fg-muted">
            {t('Step 3 of 4')}
          </span>
        </div>

        <div className="flex flex-col gap-6 rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-xs">
          {/* Core Narrative Direction (5 Stages Timeline Arc) */}
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-fg">{t('Core Narrative Arc Progression')}</h3>
                <p className="text-xs text-fg-muted">{t('5-stage storytelling sequence connecting origin to future vision')}</p>
              </div>
              <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-brand border border-rose-200">
                5 Stages
              </span>
            </div>

            {/* Stepper Timeline Grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 relative">
              {[
                { label: 'Origin & Spark', sublabel: 'Origin / trigger', value: report.narrativeStrategy.coreNarrativeDirection.originTrigger, step: '01' },
                { label: 'Core Motivation', sublabel: 'Recurring motivation', value: report.narrativeStrategy.coreNarrativeDirection.recurringMotivation, step: '02' },
                { label: 'Actions', sublabel: 'Actions taken', value: null, items: report.narrativeStrategy.coreNarrativeDirection.actions, step: '03' },
                { label: 'Capabilities Developed', sublabel: 'Capabilities developed', value: null, items: report.narrativeStrategy.coreNarrativeDirection.capabilitiesDeveloped, step: '04' },
                { label: 'Emerging Direction', sublabel: 'Emerging direction', value: report.narrativeStrategy.coreNarrativeDirection.emergingDirection, step: '05' },
              ].map((stage, idx) => (
                <div
                  key={stage.step}
                  className="group relative flex flex-col justify-between rounded-2xl border border-line/90 bg-surface-subtle/30 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:bg-white hover:shadow-sm"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand font-mono text-[11px] font-black text-white shadow-2xs">
                        {stage.step}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                        STAGE {idx + 1}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-fg">{t(stage.label)}</h4>
                      <span className="text-[10px] text-fg-muted">{t(stage.sublabel)}</span>
                    </div>
                    {stage.items ? (
                      stage.items.length > 0 ? (
                        <ul className="mt-1 flex flex-col gap-1 text-xs leading-relaxed text-fg-secondary">
                          {stage.items.map((item) => <li key={item}>• {item}</li>)}
                        </ul>
                      ) : <p className="mt-1 text-xs leading-relaxed text-fg-secondary">{t('Not established from the available evidence.')}</p>
                    ) : (
                      <p className="mt-1 text-xs leading-relaxed text-fg-secondary">
                        {stage.value || t('Not established from the available evidence.')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Strategic Synthesis Card */}
            {report.narrativeStrategy.coreNarrativeDirection.insight ? (
              <div className="relative overflow-hidden rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50/80 via-white to-rose-50/40 p-4 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-brand">
                    <SparklesIcon className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <h5 className="text-xs font-bold text-brand uppercase tracking-wider">{t('Strategic Story Synthesis')}</h5>
                    <p className="text-xs leading-relaxed text-fg-secondary font-medium">
                      {report.narrativeStrategy.coreNarrativeDirection.insight}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Supporting Themes */}
          {report.narrativeStrategy.supportingThemes.length > 0 ? (
            <div className="flex flex-col gap-3 border-t border-line/60 pt-6">
              <h3 className="text-base font-bold text-fg">{t('Supporting Thematic Pillars')}</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {report.narrativeStrategy.supportingThemes.map((theme) => (
                  <div
                    key={theme.key}
                    className="flex flex-col gap-2 rounded-2xl border border-line/80 bg-white p-4 shadow-2xs hover:border-rose-200 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-rose-50 border border-rose-200/80 px-2.5 py-1 text-xs font-bold text-brand">
                        {theme.title}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-fg-secondary">{theme.significance}</p>
                    <EvidenceRefs ids={theme.evidenceIds} report={report} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Narrative Tension & Strategic Resolution */}
          {report.narrativeStrategy.narrativeTension ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/60 via-white to-amber-50/20 p-5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <AlertTriangleIcon className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-bold text-amber-950">{t('Narrative Tension & Strategic Resolution')}</h4>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-0.5 text-[10px] font-extrabold uppercase text-amber-800 tracking-wider">
                  {report.narrativeStrategy.narrativeTension.type}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2 pt-1">
                <div className="rounded-xl bg-white/80 p-3.5 border border-amber-200/50">
                  <span className="text-[10px] font-extrabold uppercase text-amber-900 tracking-wider">{t('Observed Gap & Vulnerability')}</span>
                  <p className="mt-1 text-xs leading-relaxed text-fg-secondary">
                    {report.narrativeStrategy.narrativeTension.observedGap}
                  </p>
                  <p className="mt-2 text-[11px] text-fg-muted">
                    <strong className="text-fg-secondary">{t('Why it matters')}: </strong>
                    {report.narrativeStrategy.narrativeTension.whyItMatters}
                  </p>
                  <EvidenceRefs
                    ids={report.narrativeStrategy.narrativeTension.evidenceIds}
                    report={report}
                    label={t('Evidence supporting this diagnosis')}
                  />
                </div>

                <div className="rounded-xl bg-rose-50/70 p-3.5 border border-rose-200/80 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-brand tracking-wider">{t('Strategic Resolution Direction')}</span>
                    <p className="mt-1 text-xs leading-relaxed font-semibold text-rose-950">
                      {report.narrativeStrategy.narrativeTension.possibleDirection}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-brand">
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                    <span>{t('Use this direction to resolve the narrative gap.')}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Narrative Options */}
          {report.narrativeStrategy.narrativeOptions.length > 0 ? (
            <div className="flex flex-col gap-3 border-t border-line/60 pt-6">
              <h3 className="text-base font-bold text-fg">{t('Strategic Narrative Positioning Options')}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {report.narrativeStrategy.narrativeOptions.map((option) => (
                  <div
                    key={option.key}
                    className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-5 shadow-xs transition-all hover:border-rose-300 hover:shadow-sm"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-fg">{option.title}</h4>
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                          {t('Strategic Fit')}: {option.strategicFit}
                        </span>
                      </div>
                      <TextBlock label={t('Central idea')} value={option.centralIdea} />
                      <TextBlock label={t('Why it emerges')} value={option.whyItEmerges} />
                      <div>
                        <h5 className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{t('Strongest supporting experiences')}</h5>
                        <ul className="mt-2 flex flex-col gap-1 text-xs leading-relaxed text-fg-secondary">
                          {option.supportingExperienceIds.map((id) => (
                            <li key={id} className="flex gap-2">
                              <span aria-hidden="true">•</span>
                              <span>{activityLabel(report, id)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <TextBlock label={t('What could strengthen it')} value={option.whatCouldStrengthenIt} />
                    </div>
                    <div className="border-t border-line/70 pt-4">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{t('Evaluation')}</h5>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {Object.entries(option.evaluation).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-fg-secondary">{t(formatIdentifier(key))}</span>
                            <span className="font-semibold capitalize text-fg">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ─── SECTION 4: STRATEGIC ROADMAP ───────────────────────────────── */}
      <section id="strategic-roadmap" aria-labelledby="strategy-v3-roadmap" className="flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-black text-white shadow-xs">
              04
            </span>
            <div>
              <h2 id="strategy-v3-roadmap" className="font-display text-lg font-bold tracking-tight text-fg sm:text-xl">
                {t('Strategic Roadmap')}
              </h2>
              <p className="text-xs text-fg-muted">{t('Phased milestone plan with concrete deliverables and verification checks')}</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex rounded-full bg-surface-subtle px-3 py-1 text-[11px] font-semibold text-fg-muted">
            {t('Step 4 of 4')}
          </span>
        </div>

        <div className="flex flex-col gap-5">
          {compressedTimeline ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
              <span className="font-semibold">{t('Compressed timeline')}</span>
              <span className="text-amber-800">{t('The roadmap is prioritised around the current deadline.')}</span>
            </div>
          ) : null}
          {report.strategicRoadmap.map((phase, index) => (
            <div
              key={phase.phaseKey}
              className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-xs hover:border-rose-200 transition-colors"
            >
              {/* Phase Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 px-3 items-center justify-center rounded-full bg-brand text-xs font-black text-white shadow-xs">
                    PHASE 0{index + 1}
                  </span>
                  <h3 className="text-base font-bold text-fg">{phase.name}</h3>
                </div>
                <Badge variant="neutral" className="font-semibold text-xs">{phase.estimatedTimeline}</Badge>
              </div>

              {/* Goal */}
              <div className="rounded-xl bg-surface-subtle/60 p-3.5 border border-line/60">
                <p className="text-xs text-fg-secondary leading-relaxed">
                  <strong className="font-bold text-fg">{t('Phase Goal')}: </strong>
                  {phase.goal}
                </p>
              </div>

              {/* Key Actions */}
              <RoadmapList label={t('Key Actions')} items={phase.keyActions} />

              {/* Deliverables with Tool Launchers */}
              {phase.deliverables.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-fg-muted">{t('Deliverables & Application Tools')}</span>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {phase.deliverables.map((deliverable) => (
                      <div
                        key={deliverable.key}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-3.5 shadow-2xs transition-all hover:border-brand hover:shadow-xs"
                      >
                        <span className="text-xs font-bold text-fg">{deliverable.label}</span>
                        {deliverable.tool ? (
                          <Button
                            href={toolHref(applicationId, deliverable.tool)}
                            variant="secondary"
                            size="sm"
                            className="shrink-0 text-xs font-bold text-brand hover:bg-rose-50 border-rose-200"
                          >
                            {t({
                              personal_canvas: 'Open Personal Canvas',
                              cv_builder: 'Open CV Builder',
                              statement_writer: 'Open Statement Writer',
                            }[deliverable.tool])} →
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Success Criteria */}
              <RoadmapList label={t('Success Criteria & Verification')} items={phase.successCriteria} isSuccess />
            </div>
          ))}

          {/* Planner Sync CTA Banner */}
          <div className="relative overflow-hidden flex flex-col items-start justify-between gap-4 rounded-3xl border border-rose-300 bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 p-6 sm:p-8 text-white shadow-md sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-inner">
                <CalendarIcon className="h-6 w-6 text-white" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-bold text-white">{t('Turn this roadmap into trackable Planner tasks')}</h3>
                <p className="max-w-2xl text-xs text-white/90 leading-relaxed">
                  {t('Automatically syncs each roadmap milestone and deliverable into your interactive Kanban board & calendar planner with live progress tracking.')}
                </p>
              </div>
            </div>
            <Button
              href={`/ai-strategy/${applicationId}/planner`}
              size="md"
              className="shrink-0 bg-white text-brand hover:bg-white/90 font-bold shadow-sm"
            >
              {t('Add to Application Planner')} →
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Crafted Sub-Components
   ────────────────────────────────────────────────────────────────────────── */

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h5 className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{label}</h5>
      <p className="mt-1 text-xs leading-relaxed text-fg-secondary">{value}</p>
    </div>
  );
}

const PROFILE_AREA_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  academic: AcademicCapIcon,
  experience: BriefcaseIcon,
  differentiation: SparklesIcon,
  evidence: DocumentCheckIcon,
};
const ACTIVITY_DIMENSION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  relevance: TargetIcon,
  impact: FlameIcon,
  depth: LayersIcon,
};

function EvidenceRefs({
  ids,
  report,
  label,
}: {
  ids: string[];
  report: StrategyReportV3;
  label?: string;
}) {
  const { t } = useLanguage();
  const evidence = ids.map((id) => report.evidenceIndex?.find((item) => item.id === id)?.label ?? id);
  if (evidence.length === 0) return null;

  return (
    <div className="border-t border-line/60 pt-2">
      <h5 className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
        {label ?? t('Supporting evidence')} ({evidence.length})
      </h5>
      <ul className="mt-1 flex flex-col gap-1 text-xs leading-relaxed text-fg-secondary">
        {evidence.map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}
      </ul>
    </div>
  );
}

function activityLabel(report: StrategyReportV3, id: string): string {
  return report.profileDevelopmentStrategy.activityAnalyses.find((activity) => activity.activityId === id)?.title ?? id;
}

function PositionBlock({
  type,
  icon: Icon,
  badgeText,
  label,
  value,
}: {
  type: 'strength' | 'challenge' | 'opportunity';
  icon: React.ComponentType<{ className?: string }>;
  badgeText: string;
  label: string;
  value: string;
}) {
  const styles = {
    strength: {
      border: 'border-emerald-200/90 hover:border-emerald-300',
      bg: 'bg-surface',
      badge: 'bg-emerald-100/80 text-emerald-800 border-emerald-200',
      iconBg: 'bg-emerald-500 text-white shadow-emerald-200',
      labelColor: 'text-emerald-950',
    },
    challenge: {
      border: 'border-amber-200/90 hover:border-amber-300',
      bg: 'bg-surface',
      badge: 'bg-amber-100/80 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-500 text-white shadow-amber-200',
      labelColor: 'text-amber-950',
    },
    opportunity: {
      border: 'border-blue-200/90 hover:border-blue-300',
      bg: 'bg-surface',
      badge: 'bg-blue-100/80 text-blue-800 border-blue-200',
      iconBg: 'bg-blue-500 text-white shadow-blue-200',
      labelColor: 'text-blue-950',
    },
  }[type];

  return (
    <div className={cn('flex flex-col justify-between gap-3 rounded-3xl border p-5 sm:p-6 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs', styles.border, styles.bg)}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-xl shadow-xs', styles.iconBg)}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          <span className={cn('rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider', styles.badge)}>
            {badgeText}
          </span>
        </div>
        <div>
          <h3 className={cn('text-xs font-black uppercase tracking-wider', styles.labelColor)}>
            {label}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-fg-secondary break-words font-medium">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function GoalBlock({
  icon: Icon,
  label,
  tag,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tag: string;
  value: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-3xl border border-line bg-surface p-5 sm:p-6 shadow-2xs transition-all hover:border-rose-200 hover:shadow-xs">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-brand border border-rose-100 shadow-2xs">
              <Icon className="h-4.5 w-4.5 text-brand" />
            </div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-fg">{label}</h3>
          </div>
          <span className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-[9px] font-bold uppercase text-fg-muted tracking-wider">
            {tag}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-fg-secondary break-words font-medium">
          {value}
        </p>
      </div>
    </div>
  );
}

function PriorityCard({
  priority,
  overrides,
  onSave,
}: {
  priority: StrategyReportV3['strategicOverview']['topPriorities'][number];
  overrides: Overrides;
  onSave: (key: string, field: 'title' | 'why' | 'suggestedDirection', value: string) => void;
}) {
  const values = overrides[priority.key] ?? {};
  const priorityTitle = stringOverride(values.title) ?? priority.title;
  const whyText = stringOverride(values.why) ?? priority.why;
  const directionText = stringOverride(values.suggestedDirection) ?? priority.suggestedDirection;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line/90 bg-surface-subtle/30 p-5 transition-all hover:border-rose-300 hover:bg-white hover:shadow-xs">
      {/* Priority Rank Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/50 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 px-2.5 items-center justify-center rounded-full bg-gradient-to-r from-rose-600 to-rose-500 text-[11px] font-black text-white shadow-2xs">
            #{priority.rank}
          </span>
          <span className="text-sm font-bold text-fg">{priorityTitle}</span>
        </div>
      </div>

      {/* 3 Editable Fields */}
      <div className="grid gap-4 md:grid-cols-3">
        <Editable
          label="Priority"
          value={priorityTitle}
          onSave={(value) => onSave(priority.key, 'title', value)}
        />
        <Editable
          label="Why"
          value={whyText}
          onSave={(value) => onSave(priority.key, 'why', value)}
          multiline
        />
        <Editable
          label="Suggested direction"
          value={directionText}
          onSave={(value) => onSave(priority.key, 'suggestedDirection', value)}
          multiline
          isAction
        />
      </div>

      {/* Factor Visualizer Metrics Meter */}
      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-line/50">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-fg-muted">
          Assessment Factors:
        </span>
        <div className="flex flex-wrap gap-2">
          {Object.entries(priority.factors)
            .filter(([key]) => key !== 'rawPriority')
            .map(([key, value]) => {
              const score = typeof value === 'number' ? value : Number(value) || 0;
              return (
                <div
                  key={key}
                  className="flex items-center gap-1.5 rounded-lg border border-line/80 bg-white px-2.5 py-1 text-[10px] font-semibold text-fg-secondary shadow-2xs"
                >
                  <span>{formatIdentifier(key)}:</span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4].map((dot) => (
                      <span
                        key={dot}
                        aria-hidden="true"
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          dot <= score ? 'bg-brand' : 'bg-slate-200'
                        )}
                      />
                    ))}
                  </div>
                  <strong className="text-fg ml-0.5 font-bold">{score}/4</strong>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

function Editable({
  label,
  value,
  onSave,
  multiline = false,
  isAction = false,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
  multiline?: boolean;
  isAction?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDraft(value), 0);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className={cn('text-[10px] font-extrabold uppercase tracking-wider', isAction ? 'text-brand' : 'text-fg-muted')}>
          {label}
        </span>
        <span className="text-[9px] text-fg-muted font-medium">Click to edit</span>
      </div>
      {multiline ? (
        <textarea
          name={`strategy-${label}`}
          aria-label={label}
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft !== value) onSave(draft);
          }}
          className={cn(
            'w-full resize-none rounded-xl border p-3 text-xs leading-relaxed focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none transition-all shadow-2xs',
            isAction
              ? 'border-rose-200 bg-rose-50/40 text-rose-950 font-medium'
              : 'border-line/90 bg-white text-fg'
          )}
        />
      ) : (
        <input
          name={`strategy-${label}`}
          aria-label={label}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft !== value) onSave(draft);
          }}
          className="w-full rounded-xl border border-line/90 bg-white px-3.5 py-2.5 text-xs font-bold text-fg focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none transition-all shadow-2xs"
        />
      )}
    </label>
  );
}

function ProfileAreaCard({ area }: { area: ProfileAreaDiagnosis }) {
  const { t } = useLanguage();
  const Icon = PROFILE_AREA_ICONS[(area.category || area.key).toLowerCase()] ?? DocumentCheckIcon;
  const statusClasses = {
    maintain: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    develop: 'bg-rose-50 text-brand border-rose-200',
    consolidate: 'bg-blue-50 text-blue-800 border-blue-200',
    build: 'bg-amber-50 text-amber-800 border-amber-200',
  }[area.status];

  return (
    <div className="flex flex-col justify-between rounded-3xl border border-line bg-surface p-6 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-xs">
      <div className="flex flex-col gap-4">
        {/* Header with Icon & Status */}
        <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-brand border border-rose-100 shadow-2xs">
              <Icon className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-fg">{formatIdentifier(area.label)}</h3>
              <span className="text-[10px] text-fg-muted">{t('Area Diagnostic')}</span>
            </div>
          </div>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider border shadow-2xs',
              statusClasses
            )}
          >
            {t(area.status)}
          </span>
        </div>

        {/* Diagnosis */}
        <p className="text-xs leading-relaxed text-fg-secondary break-words font-medium">
          {area.diagnosis}
        </p>

        {/* Why it matters */}
        <div className="rounded-xl bg-surface-subtle/60 p-3 border border-line/50 text-[11px] leading-relaxed text-fg-muted">
          <strong className="text-fg-secondary">{t('Why it matters')}: </strong>
          {area.whyItMatters}
        </div>
      </div>

      {/* Suggested Direction Callout */}
      <div className="mt-4 rounded-xl bg-gradient-to-r from-rose-50/90 via-white to-rose-50/50 p-3.5 border border-rose-200 text-xs leading-relaxed shadow-2xs">
        <div className="flex items-center gap-1.5 text-brand font-extrabold text-[10px] uppercase tracking-wider mb-1">
          <LightBulbIcon className="h-3.5 w-3.5" />
          <span>{t('Recommended Path')}</span>
        </div>
        <span className="text-rose-950 font-semibold">{area.suggestedDirection}</span>
      </div>

      {area.status === 'build' && area.developmentPlan ? (
        <div className="mt-4 flex flex-col gap-4 border-t border-line/70 pt-4">
          <TextBlock label={t('Gap')} value={area.developmentPlan.gap} />
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{t('Possible routes')}</h4>
            <ol className="mt-2 flex flex-col gap-2">
              {area.developmentPlan.possibleRoutes.map((route, index) => (
                <li key={route.title} className="flex gap-2 text-xs leading-relaxed text-fg-secondary">
                  <span className="font-mono text-fg-muted">{String(index + 1).padStart(2, '0')}</span>
                  <span><strong className="font-semibold text-fg">{route.title}</strong> — {route.rationale}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
            <TextBlock label={t('Recommended route')} value={`${area.developmentPlan.recommendedRoute.title} — ${area.developmentPlan.recommendedRoute.rationale}`} />
          </div>
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{t('Evidence expected')}</h4>
            <ul className="mt-2 flex flex-col gap-1 text-xs leading-relaxed text-fg-secondary">
              {area.developmentPlan.evidenceExpected.map((item) => <li key={item}>✓ {item}</li>)}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActivityCard({ activity, report }: { activity: ActivityStrategyAnalysis; report: StrategyReportV3 }) {
  const { t } = useLanguage();

  const getStatusBadge = (classification: string) => {
    switch (classification.toLowerCase()) {
      case 'maintain':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'develop':
        return 'bg-rose-50 text-brand border-rose-200';
      case 'consolidate':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'reposition':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'deprioritize':
      default:
        return 'bg-neutral-100 text-neutral-700 border-neutral-200';
    }
  };

  return (
    <details className="group/act rounded-2xl border border-line bg-surface p-4 transition-all open:border-rose-300 open:shadow-xs hover:border-line-hover">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 select-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-subtle text-fg-muted">
            <BriefcaseIcon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-bold text-fg break-words group-open/act:text-brand">
            {activity.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full border px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider shadow-2xs',
              getStatusBadge(activity.classification)
            )}
          >
            {t(activity.classification)}
          </span>
          <span className="text-xs font-bold text-fg-muted transition-transform group-open/act:rotate-180" aria-hidden="true">
            ⌄
          </span>
        </div>
      </summary>

      <div className="mt-4 flex flex-col gap-4 border-t border-line/60 pt-4">
        <TextBlock label={t('Diagnosis')} value={activity.diagnosis} />
        <EvidenceRefs ids={activity.evidenceIds} report={report} />

        {/* 4 Dimension mini-cards with icons */}
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(activity.dimensions).map(([key, dimension]) => {
            const DimIcon = ACTIVITY_DIMENSION_ICONS[key.toLowerCase()] ?? AwardIcon;

            return (
              <div key={key} className="rounded-xl bg-surface-subtle/50 p-3 border border-line/60">
                <div className="flex items-center gap-1.5 mb-1">
                  <DimIcon className="h-3.5 w-3.5 text-fg-muted" />
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-fg-muted">
                      {t(formatIdentifier(key))}
                    </span>
                    <span className="rounded-full border border-line bg-white px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-fg-muted">
                      {t(formatIdentifier(dimension.status))}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-fg-secondary font-medium">
                  {dimension.statement}
                </p>
              </div>
            );
          })}
        </div>

        {/* Recommended Move */}
        <div className="rounded-xl bg-gradient-to-r from-rose-50 via-white to-rose-50/50 p-3.5 border border-rose-200 text-xs">
          <strong className="font-extrabold text-brand uppercase tracking-wider text-[10px] block mb-0.5">
            {t('Recommended Strategic Move')}:
          </strong>
          <span className="text-rose-950 font-semibold">{activity.recommendedMove}</span>
        </div>
      </div>
    </details>
  );
}

function RoadmapList({
  label,
  items,
  isSuccess = false,
}: {
  label: string;
  items: string[];
  isSuccess?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-wider text-fg-muted">{label}</span>
      <div className="flex flex-col gap-1.5">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={cn(
              'flex items-start gap-2.5 rounded-xl p-2.5 text-xs text-fg-secondary transition-colors',
              isSuccess ? 'bg-emerald-50/50 border border-emerald-100' : 'bg-surface-subtle/40'
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
                isSuccess ? 'bg-emerald-500 text-white' : 'bg-brand text-white'
              )}
            >
              ✓
            </span>
            <span className="leading-relaxed font-medium">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function stringOverride(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toolHref(
  applicationId: string,
  tool: 'personal_canvas' | 'cv_builder' | 'statement_writer',
): string {
  if (tool === 'personal_canvas') {
    return `/ai-strategy/personal-report?return=${encodeURIComponent(`/ai-strategy/${applicationId}/strategy-report`)}`;
  }
  if (tool === 'cv_builder') return `/ai-strategy/${applicationId}/cv/target-profile`;
  return `/ai-strategy/${applicationId}/statement`;
}

