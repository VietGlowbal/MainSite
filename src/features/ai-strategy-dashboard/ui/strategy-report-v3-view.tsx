'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, CheckItem, CheckList, Badge } from '@/shared/ui';
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
   Inline SVG Icons for Ultra-Clean Design
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

  return (
    <div className="flex flex-col gap-gb-4xl" data-no-auto-translate data-report-auto-translate>
      {/* ─── Page Hero Banner ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-gb-2xl border border-rose-200/70 bg-gradient-to-br from-white via-rose-50/40 to-white p-gb-xl shadow-gb-xs">
        <div className="relative z-10 flex flex-col gap-gb-sm">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand shadow-xs">
              <SparklesIcon className="h-3.5 w-3.5 text-brand" />
              {t('AI Strategy Architecture V3')}
            </span>
            <span className="text-xs font-semibold text-fg-muted">· {t('Target Alignment & Action Plan')}</span>
          </div>

          <h1 className="font-display text-gb-display-sm font-bold tracking-tight text-fg sm:text-gb-display-md">
            {t('Personalized Application Strategy')}
          </h1>

          <p className="max-w-3xl text-gb-sm leading-relaxed text-fg-secondary">
            {t('Evidence-grounded tactical roadmap, narrative arc positioning, and dimension-by-dimension profile development designed to maximize admission probability.')}
          </p>

          {/* Anchor Navigation Pills */}
          <div className="mt-gb-md flex flex-wrap gap-2 pt-gb-xs border-t border-line/60">
            <a
              href="#strategic-overview"
              className="rounded-full bg-surface border border-line/80 px-3.5 py-1.5 text-xs font-semibold text-fg-secondary hover:border-brand hover:text-brand transition-all shadow-xs"
            >
              1. {t('Strategic Overview')}
            </a>
            <a
              href="#profile-development"
              className="rounded-full bg-surface border border-line/80 px-3.5 py-1.5 text-xs font-semibold text-fg-secondary hover:border-brand hover:text-brand transition-all shadow-xs"
            >
              2. {t('Profile Strategy')}
            </a>
            <a
              href="#narrative-strategy"
              className="rounded-full bg-surface border border-line/80 px-3.5 py-1.5 text-xs font-semibold text-fg-secondary hover:border-brand hover:text-brand transition-all shadow-xs"
            >
              3. {t('Narrative Strategy')}
            </a>
            <a
              href="#strategic-roadmap"
              className="rounded-full bg-surface border border-line/80 px-3.5 py-1.5 text-xs font-semibold text-fg-secondary hover:border-brand hover:text-brand transition-all shadow-xs"
            >
              4. {t('Execution Roadmap')}
            </a>
          </div>
        </div>
      </div>

      {/* ─── SECTION 1: STRATEGIC OVERVIEW ───────────────────────────────── */}
      <section id="strategic-overview" aria-labelledby="strategy-v3-overview" className="flex flex-col gap-gb-lg">
        <div className="flex items-center justify-between border-b border-line/70 pb-gb-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white shadow-xs">
              01
            </span>
            <h2 id="strategy-v3-overview" className="font-display text-gb-display-xs font-bold tracking-tight text-fg">
              {t('Strategic Overview')}
            </h2>
          </div>
          <span className="text-xs font-medium text-fg-muted">{t('High-Level Positioning')}</span>
        </div>

        <div className="flex flex-col gap-gb-xl">
          {overrideError ? (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-gb-sm font-semibold text-fg-error">
              {t('Could not save this edit. Please try again.')}
            </p>
          ) : null}

          {/* Top 3 Core Positioning Cards */}
          <div className="grid gap-gb-md md:grid-cols-3">
            <PositionBlock
              type="strength"
              icon={CheckCircleIcon}
              label={t('Profile Strength')}
              value={report.strategicOverview.currentPosition.profileStrength.statement}
            />
            <PositionBlock
              type="challenge"
              icon={AlertTriangleIcon}
              label={t('Key Challenge')}
              value={report.strategicOverview.currentPosition.keyChallenge.statement}
            />
            <PositionBlock
              type="opportunity"
              icon={TrendingUpIcon}
              label={t('Strategic Opportunity')}
              value={report.strategicOverview.strategicOpportunity.statement}
            />
          </div>

          {/* 2 Strategic Direction & Outcome Cards */}
          <div className="grid gap-gb-md md:grid-cols-2">
            <GoalBlock
              icon={TargetIcon}
              label={t('Strategic Goal')}
              subtitle={t('Direction of improvement & communication focus')}
              value={`${report.strategicOverview.strategicGoal.directionOfImprovement} ${report.strategicOverview.strategicGoal.communicationGoal}`}
            />
            <GoalBlock
              icon={AwardIcon}
              label={t('Expected Outcome')}
              subtitle={t('Anticipated portfolio transformation')}
              value={report.strategicOverview.expectedOutcome}
            />
          </div>

          {/* Priority Action Items */}
          <div className="flex flex-col gap-gb-md rounded-gb-2xl border border-line bg-surface p-gb-lg sm:p-gb-xl shadow-gb-xs">
            <div className="flex items-center justify-between border-b border-line/60 pb-gb-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-brand">
                  <TargetIcon className="h-3.5 w-3.5 text-brand" />
                </div>
                <h3 className="text-gb-md font-bold text-fg">{t('Top Three Priorities')}</h3>
              </div>
              <span className="text-xs text-fg-muted">{t('Ranked by impact & urgency')}</span>
            </div>

            <div className="mt-gb-xs flex flex-col gap-gb-md">
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
      <section id="profile-development" aria-labelledby="strategy-v3-profile" className="flex flex-col gap-gb-lg">
        <div className="flex items-center justify-between border-b border-line/70 pb-gb-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white shadow-xs">
              02
            </span>
            <h2 id="strategy-v3-profile" className="font-display text-gb-display-xs font-bold tracking-tight text-fg">
              {t('Profile Development Strategy')}
            </h2>
          </div>
          <span className="text-xs font-medium text-fg-muted">{t('Area & Activity Diagnostics')}</span>
        </div>

        {/* 4 Area Diagnostic Cards (Academic, Experience, Differentiation, Evidence) */}
        <div className="grid gap-gb-md sm:grid-cols-2">
          {report.profileDevelopmentStrategy.areas.map((area) => (
            <ProfileAreaCard key={area.key} area={area} />
          ))}
        </div>

        {/* Activity-Level Analysis with Filter */}
        <div className="flex flex-col gap-gb-lg rounded-gb-2xl border border-line bg-surface p-gb-lg sm:p-gb-xl shadow-gb-xs">
          <div className="flex flex-wrap items-center justify-between gap-gb-md border-b border-line/60 pb-gb-md">
            <div className="flex flex-col gap-1">
              <h3 className="text-gb-md font-bold text-fg">{t('Activity-Level Analysis')}</h3>
              <p className="text-xs text-fg-muted">{t('Strategic classification & recommendations for each portfolio entry')}</p>
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('Filter activity analysis')}>
              {FILTERS.map((value) => {
                const isSelected = filter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setFilter(value)}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-semibold transition-all',
                      isSelected
                        ? 'bg-brand text-white shadow-xs'
                        : 'border border-line/80 bg-surface-subtle/60 text-fg-secondary hover:bg-surface-subtle hover:text-fg'
                    )}
                  >
                    {t(value === 'all' ? 'All' : formatIdentifier(value))}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-gb-sm">
            {activities.map((activity) => (
              <ActivityCard key={activity.activityId} activity={activity} />
            ))}
            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line p-gb-xl text-center">
                <p className="text-gb-sm font-semibold text-fg-muted">{t('No activities match this filter.')}</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ─── SECTION 3: NARRATIVE STRATEGY ──────────────────────────────── */}
      <section id="narrative-strategy" aria-labelledby="strategy-v3-narrative" className="flex flex-col gap-gb-lg">
        <div className="flex items-center justify-between border-b border-line/70 pb-gb-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white shadow-xs">
              03
            </span>
            <h2 id="strategy-v3-narrative" className="font-display text-gb-display-xs font-bold tracking-tight text-fg">
              {t('Narrative Strategy')}
            </h2>
          </div>
          <span className="text-xs font-medium text-fg-muted">{t('Story Arc & Thematic Framing')}</span>
        </div>

        <div className="flex flex-col gap-gb-xl rounded-gb-2xl border border-line bg-surface p-gb-lg sm:p-gb-xl shadow-gb-xs">
          {/* Core Narrative Direction 5-Step Arc */}
          <div className="flex flex-col gap-gb-md">
            <div className="flex items-center justify-between">
              <h3 className="text-gb-md font-bold text-fg">{t('Core Narrative Direction')}</h3>
              <span className="text-xs text-fg-muted">{t('Five-Stage Storytelling Sequence')}</span>
            </div>

            <div className="grid gap-gb-sm sm:grid-cols-2 lg:grid-cols-5">
              {[
                { label: 'Origin / trigger', value: report.narrativeStrategy.coreNarrativeDirection.originTrigger, step: '01' },
                { label: 'Recurring motivation', value: report.narrativeStrategy.coreNarrativeDirection.recurringMotivation, step: '02' },
                { label: 'Key actions taken', value: report.narrativeStrategy.coreNarrativeDirection.actions.join(' '), step: '03' },
                { label: 'Capabilities developed', value: report.narrativeStrategy.coreNarrativeDirection.capabilitiesDeveloped.join(' '), step: '04' },
                { label: 'Emerging direction', value: report.narrativeStrategy.coreNarrativeDirection.emergingDirection, step: '05' },
              ].map((stage) => (
                <div
                  key={stage.step}
                  className="flex flex-col justify-between rounded-xl border border-line/70 bg-surface-subtle/40 p-gb-md transition-all hover:border-rose-200"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] font-bold text-brand">STAGE {stage.step}</span>
                    <h4 className="text-xs font-bold text-fg">{t(stage.label)}</h4>
                    <p className="mt-1 text-gb-xs leading-relaxed text-fg-secondary">
                      {stage.value || t('Not established from the available evidence.')}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {report.narrativeStrategy.coreNarrativeDirection.insight ? (
              <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-gb-md">
                <p className="text-gb-xs leading-relaxed text-fg-secondary">
                  <strong className="font-bold text-brand">{t('Strategic Synthesis')}: </strong>
                  {report.narrativeStrategy.coreNarrativeDirection.insight}
                </p>
              </div>
            ) : null}
          </div>

          {/* Supporting Themes */}
          {report.narrativeStrategy.supportingThemes.length > 0 ? (
            <div className="flex flex-col gap-gb-sm border-t border-line/60 pt-gb-lg">
              <h3 className="text-gb-md font-bold text-fg">{t('Supporting Themes')}</h3>
              <div className="grid gap-gb-md md:grid-cols-2">
                {report.narrativeStrategy.supportingThemes.map((theme) => (
                  <div
                    key={theme.key}
                    className="flex flex-col gap-2 rounded-xl border border-line/70 bg-surface-subtle/30 p-gb-md"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-brand">
                        {theme.title}
                      </span>
                    </div>
                    <p className="text-gb-xs leading-relaxed text-fg-secondary">{theme.significance}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Narrative Tension Callout */}
          {report.narrativeStrategy.narrativeTension ? (
            <div className="flex flex-col gap-gb-xs rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 p-gb-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangleIcon className="h-4 w-4 text-amber-600" />
                  <h3 className="text-gb-sm font-bold text-amber-900">{t('Narrative Tension & Resolution')}</h3>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                  {report.narrativeStrategy.narrativeTension.type}
                </span>
              </div>
              <p className="mt-1 text-gb-xs leading-relaxed text-fg-secondary">
                <strong className="text-fg">{t('Observed Gap')}: </strong>
                {report.narrativeStrategy.narrativeTension.observedGap}
              </p>
              <p className="text-gb-xs leading-relaxed text-fg-muted">
                <strong className="text-fg-secondary">{t('Why it matters')}: </strong>
                {report.narrativeStrategy.narrativeTension.whyItMatters}
              </p>
              <div className="mt-2 rounded-lg bg-white/80 p-2.5 border border-amber-200/60">
                <p className="text-gb-xs font-semibold text-brand">
                  → {report.narrativeStrategy.narrativeTension.possibleDirection}
                </p>
              </div>
            </div>
          ) : null}

          {/* Narrative Options */}
          {report.narrativeStrategy.narrativeOptions.length > 0 ? (
            <div className="flex flex-col gap-gb-sm border-t border-line/60 pt-gb-lg">
              <h3 className="text-gb-md font-bold text-fg">{t('Narrative Options')}</h3>
              <div className="grid gap-gb-md md:grid-cols-2">
                {report.narrativeStrategy.narrativeOptions.map((option) => (
                  <div
                    key={option.key}
                    className="flex flex-col justify-between rounded-xl border border-line bg-surface p-gb-lg shadow-xs"
                  >
                    <div className="flex flex-col gap-2">
                      <h4 className="text-gb-sm font-bold text-fg">{option.title}</h4>
                      <p className="text-gb-xs leading-relaxed text-fg-secondary">{option.centralIdea}</p>
                      <p className="text-gb-xs text-fg-muted">{option.whyItEmerges}</p>
                    </div>
                    <div className="mt-gb-md rounded-lg bg-rose-50/60 p-2.5 border border-rose-100">
                      <span className="text-[11px] font-bold text-brand">
                        {t('Strategic Fit')}: {option.strategicFit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ─── SECTION 4: STRATEGIC ROADMAP ───────────────────────────────── */}
      <section id="strategic-roadmap" aria-labelledby="strategy-v3-roadmap" className="flex flex-col gap-gb-lg">
        <div className="flex items-center justify-between border-b border-line/70 pb-gb-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white shadow-xs">
              04
            </span>
            <h2 id="strategy-v3-roadmap" className="font-display text-gb-display-xs font-bold tracking-tight text-fg">
              {t('Strategic Roadmap')}
            </h2>
          </div>
          <span className="text-xs font-medium text-fg-muted">{t('Phased Execution Blueprint')}</span>
        </div>

        <div className="flex flex-col gap-gb-lg">
          {report.strategicRoadmap.map((phase, index) => (
            <div
              key={phase.phaseKey}
              className="flex flex-col gap-gb-md rounded-gb-2xl border border-line bg-surface p-gb-lg sm:p-gb-xl shadow-gb-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-gb-md border-b border-line/60 pb-gb-sm">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-brand px-2.5 py-1 text-xs font-bold text-white">
                    PHASE 0{index + 1}
                  </span>
                  <h3 className="text-gb-md font-bold text-fg">{phase.name}</h3>
                </div>
                <Badge variant="neutral">{phase.estimatedTimeline}</Badge>
              </div>

              <p className="text-gb-xs text-fg-secondary leading-relaxed">
                <strong className="font-bold text-fg">{t('Phase Goal')}: </strong>
                {phase.goal}
              </p>

              {/* Key Actions */}
              <RoadmapList label={t('Key Actions')} items={phase.keyActions} />

              {/* Deliverables */}
              {phase.deliverables.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-muted">{t('Deliverables & Tools')}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {phase.deliverables.map((deliverable) => (
                      <div
                        key={deliverable.key}
                        className="flex items-center justify-between gap-2 rounded-xl border border-line/70 bg-surface-subtle/40 p-3 transition-colors hover:border-rose-200"
                      >
                        <span className="text-xs font-semibold text-fg">{deliverable.label}</span>
                        {deliverable.tool ? (
                          <Button
                            href={toolHref(applicationId, deliverable.tool)}
                            variant="secondary"
                            size="sm"
                            className="shrink-0 text-xs"
                          >
                            {t('Open Tool')} →
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Success Criteria */}
              <RoadmapList label={t('Success Criteria')} items={phase.successCriteria} isSuccess />
            </div>
          ))}

          {/* Planner Sync CTA Panel */}
          <div className="flex flex-col items-start justify-between gap-gb-md rounded-gb-2xl border border-rose-200 bg-gradient-to-r from-rose-50/70 via-white to-rose-50/30 p-gb-lg sm:p-gb-xl shadow-gb-xs sm:flex-row sm:items-center">
            <div className="flex flex-col gap-1">
              <h3 className="text-gb-md font-bold text-fg">{t('Turn this roadmap into Planner tasks')}</h3>
              <p className="max-w-2xl text-gb-xs leading-relaxed text-fg-secondary">
                {t('Adds one trackable Planner task for each roadmap deliverable and preserves completed work when the report regenerates.')}
              </p>
            </div>
            <Button href={`/ai-strategy/${applicationId}/planner`} size="sm" className="shrink-0">
              {t('Add to Planner')}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Sub-Components
   ────────────────────────────────────────────────────────────────────────── */

function PositionBlock({
  type,
  icon: Icon,
  label,
  value,
}: {
  type: 'strength' | 'challenge' | 'opportunity';
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  const styles = {
    strength: {
      border: 'border-emerald-200/80',
      bg: 'bg-emerald-50/40',
      iconBg: 'bg-emerald-100 text-emerald-700',
      labelColor: 'text-emerald-800',
    },
    challenge: {
      border: 'border-amber-200/80',
      bg: 'bg-amber-50/40',
      iconBg: 'bg-amber-100 text-amber-700',
      labelColor: 'text-amber-800',
    },
    opportunity: {
      border: 'border-blue-200/80',
      bg: 'bg-blue-50/40',
      iconBg: 'bg-blue-100 text-blue-700',
      labelColor: 'text-blue-800',
    },
  }[type];

  return (
    <div className={cn('flex flex-col gap-gb-xs rounded-gb-2xl border p-gb-lg shadow-gb-xs transition-all', styles.border, styles.bg)}>
      <div className="flex items-center gap-2">
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg shadow-2xs', styles.iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className={cn('text-[11px] font-bold uppercase tracking-wider', styles.labelColor)}>
          {label}
        </h3>
      </div>
      <p className="mt-1 text-gb-xs leading-relaxed text-fg-secondary break-words font-medium">
        {value}
      </p>
    </div>
  );
}

function GoalBlock({
  icon: Icon,
  label,
  subtitle,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  subtitle: string;
  value: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-gb-2xl border border-line bg-surface p-gb-lg shadow-gb-xs">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-brand border border-rose-100 shadow-2xs">
            <Icon className="h-4 w-4 text-brand" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-wider text-fg">{label}</h3>
            <span className="text-[10px] text-fg-muted">{subtitle}</span>
          </div>
        </div>
        <p className="mt-2 text-gb-xs leading-relaxed text-fg-secondary break-words">
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
    <div className="flex flex-col gap-gb-md rounded-xl border border-line/80 bg-surface-subtle/30 p-gb-md sm:p-gb-lg transition-all hover:border-rose-200">
      {/* Header with Rank & Action Pill */}
      <div className="flex flex-wrap items-center justify-between gap-gb-sm border-b border-line/50 pb-gb-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-6 px-2.5 items-center justify-center rounded-full bg-brand text-[11px] font-black text-white shadow-xs">
            #{priority.rank}
          </span>
          <span className="text-xs font-bold text-fg">
            {formatIdentifier(priorityTitle)}
          </span>
        </div>
        {priority.interventionKind ? (
          <span className="rounded-md bg-surface border border-line px-2 py-0.5 text-[10px] font-semibold text-fg-muted uppercase">
            {formatIdentifier(priority.interventionKind)}
          </span>
        ) : null}
      </div>

      {/* 3 Editable / Detailed Fields */}
      <div className="grid gap-gb-md md:grid-cols-3">
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
        />
      </div>

      {/* Priority Factor Scores */}
      <div className="flex flex-wrap items-center gap-1.5 pt-gb-xs border-t border-line/40 text-[10px] text-fg-muted font-medium">
        <span className="font-semibold text-fg-secondary">Factors:</span>
        {Object.entries(priority.factors)
          .filter(([key]) => key !== 'rawPriority')
          .map(([key, value]) => (
            <span
              key={key}
              className="rounded-md bg-surface border border-line/60 px-2 py-0.5 text-fg-secondary"
            >
              {formatIdentifier(key)}: <strong className="text-fg">{value}</strong>/5
            </span>
          ))}
      </div>
    </div>
  );
}

function Editable({
  label,
  value,
  onSave,
  multiline = false,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDraft(value), 0);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
        {label}
      </span>
      {multiline ? (
        <textarea
          name={`strategy-${label}`}
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft !== value) onSave(draft);
          }}
          className="w-full resize-none rounded-lg border border-line/80 bg-white p-2.5 text-xs text-fg leading-relaxed focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-colors"
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
          className="w-full rounded-lg border border-line/80 bg-white px-3 py-2 text-xs font-semibold text-fg focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-colors"
        />
      )}
    </label>
  );
}

function ProfileAreaCard({ area }: { area: ProfileAreaDiagnosis }) {
  const { t } = useLanguage();

  const getAreaIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'academic':
        return AcademicCapIcon;
      case 'experience':
        return BriefcaseIcon;
      case 'differentiation':
        return SparklesIcon;
      case 'evidence':
      default:
        return DocumentCheckIcon;
    }
  };

  const Icon = getAreaIcon(area.category || area.key);

  return (
    <div className="flex flex-col justify-between rounded-gb-2xl border border-line bg-surface p-gb-lg sm:p-gb-xl shadow-gb-xs transition-all hover:border-rose-200">
      <div className="flex flex-col gap-gb-sm">
        {/* Header with Icon & Status */}
        <div className="flex items-center justify-between gap-gb-sm border-b border-line/60 pb-gb-xs">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-brand border border-rose-100 shadow-2xs">
              <Icon className="h-4.5 w-4.5 text-brand" />
            </div>
            <h3 className="text-gb-md font-bold text-fg">{formatIdentifier(area.label)}</h3>
          </div>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
              area.status === 'maintain'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-brand border border-rose-200'
            )}
          >
            {t(area.status)}
          </span>
        </div>

        {/* Diagnosis */}
        <p className="text-gb-xs leading-relaxed text-fg-secondary break-words">
          {area.diagnosis}
        </p>

        {/* Why it matters */}
        <div className="rounded-lg bg-surface-subtle/50 p-2.5 border border-line/50 text-[11px] leading-relaxed text-fg-muted">
          <strong className="text-fg-secondary">{t('Why it matters')}: </strong>
          {area.whyItMatters}
        </div>
      </div>

      {/* Suggested Direction Callout */}
      <div className="mt-gb-md rounded-lg bg-rose-50/60 p-2.5 border border-rose-100 text-[11px] leading-relaxed">
        <strong className="font-bold text-brand">{t('Suggested direction')}: </strong>
        <span className="text-rose-950 font-medium">{area.suggestedDirection}</span>
      </div>
    </div>
  );
}

function ActivityCard({ activity }: { activity: ActivityStrategyAnalysis }) {
  const { t } = useLanguage();

  const getStatusBadge = (classification: string) => {
    switch (classification.toLowerCase()) {
      case 'maintain':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'develop':
        return 'bg-rose-50 text-brand border-rose-200';
      case 'consolidate':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'reposition':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'deprioritize':
      default:
        return 'bg-neutral-100 text-neutral-600 border-neutral-200';
    }
  };

  return (
    <details className="group/act rounded-xl border border-line bg-surface p-gb-md transition-all open:border-rose-200 open:shadow-xs">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-gb-md select-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-fg truncate group-open/act:text-brand">
            {activity.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
              getStatusBadge(activity.classification)
            )}
          >
            {t(activity.classification)}
          </span>
          <span className="text-xs text-fg-muted transition-transform group-open/act:rotate-180" aria-hidden="true">
            ⌄
          </span>
        </div>
      </summary>

      <div className="mt-gb-md flex flex-col gap-gb-sm border-t border-line/60 pt-gb-sm">
        <p className="text-gb-xs leading-relaxed text-fg-secondary">{activity.diagnosis}</p>

        {/* 4 Dimension mini-cards */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(activity.dimensions).map(([key, dimension]) => (
            <div key={key} className="rounded-lg bg-surface-subtle/50 p-2.5 border border-line/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                {t(formatIdentifier(key))}
              </span>
              <p className="mt-1 text-[11px] leading-relaxed text-fg-secondary">
                {dimension.statement}
              </p>
            </div>
          ))}
        </div>

        {/* Recommended Move */}
        <div className="rounded-lg bg-rose-50/60 p-2.5 border border-rose-100 text-[11px]">
          <strong className="font-bold text-brand">{t('Recommended Move')}: </strong>
          <span className="text-rose-950 font-medium">{activity.recommendedMove}</span>
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
    <div className="flex flex-col gap-1">
      <span className="text-gb-xs font-bold uppercase tracking-wider text-fg-muted">{label}</span>
      <div className="flex flex-col gap-1">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 text-gb-xs text-fg-secondary">
            <span
              className={cn(
                'mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                isSuccess ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-brand'
              )}
            >
              ✓
            </span>
            <span className="leading-relaxed">{item}</span>
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
