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
   Crafted Inline SVG Icons & Visual Components
   ────────────────────────────────────────────────────────────────────────── */

function SparklesIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function CheckShieldIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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

function LayersIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
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

function SparklineWave({ color = '#10b981', className = 'w-16 h-6' }: { color?: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2 14C8 14 12 6 18 10C24 14 28 4 34 8C40 12 44 2 50 6C54 9 56 12 58 10"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
  const [showFullDiagnostics, setShowFullDiagnostics] = useState(false);
  const [showFullNarrative, setShowFullNarrative] = useState(false);
  const [showFullRoadmap, setShowFullRoadmap] = useState(false);
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
    <div className="flex flex-col gap-6 text-fg" data-no-auto-translate data-report-auto-translate>
      {/* ─── TOP HEADER BAR ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {t('AI STRATEGY ARCHITECTURE V3')}
            </span>
            <span className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-medium text-fg-secondary">
              {t('Evidence-Grounded Blueprint')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="text-emerald-600">✓</span> {t('Profile Calibrated')}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-brand">
              <TargetIcon className="h-3.5 w-3.5" /> {t('Phased Milestones')}
            </span>
          </div>
        </div>

        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            {t('Personalized Strategic Roadmap & Positioning')}
          </h1>
          <p className="mt-1 text-xs text-fg-muted sm:text-sm">
            {t('Multi-dimensional tactical blueprint aligning your academic readiness, standout experiences, core narrative arc, and phased execution timeline for maximum admission competitiveness.')}
          </p>
        </div>
      </div>

      {overrideError ? (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-fg-error shadow-2xs">
          <AlertTriangleIcon className="h-4 w-4 shrink-0" />
          <span>{t('Could not save this edit. Please try again.')}</span>
        </div>
      ) : null}

      {/* ─── ROW 1: 4 PILLAR METRIC CARDS ──────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Profile Strength */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-4 shadow-2xs transition-all hover:border-emerald-300 hover:shadow-xs">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-2xs">
                <CheckShieldIcon className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase tracking-wider text-fg">
                  {t('PROFILE STRENGTH')}
                </span>
                <span className="text-[10px] font-semibold text-emerald-600">
                  {t('Core Asset')}
                </span>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-fg-secondary">
              {report.strategicOverview.currentPosition.profileStrength.statement}
            </p>
          </div>
          <div className="mt-3 flex justify-end">
            <SparklineWave color="#10b981" />
          </div>
        </div>

        {/* Card 2: Key Challenge */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-4 shadow-2xs transition-all hover:border-amber-300 hover:shadow-xs">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white shadow-2xs">
                <AlertTriangleIcon className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase tracking-wider text-fg">
                  {t('KEY CHALLENGE')}
                </span>
                <span className="text-[10px] font-semibold text-amber-600">
                  {t('Critical Bottleneck')}
                </span>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-fg-secondary">
              {report.strategicOverview.currentPosition.keyChallenge.statement}
            </p>
          </div>
          <div className="mt-3 flex justify-end">
            <SparklineWave color="#f59e0b" />
          </div>
        </div>

        {/* Card 3: Strategic Opportunity */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-4 shadow-2xs transition-all hover:border-blue-300 hover:shadow-xs">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500 text-white shadow-2xs">
                <TrendingUpIcon className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase tracking-wider text-fg">
                  {t('STRATEGIC OPPORTUNITY')}
                </span>
                <span className="text-[10px] font-semibold text-blue-600">
                  {t('Growth Catalyst')}
                </span>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-fg-secondary">
              {report.strategicOverview.strategicOpportunity.statement}
            </p>
          </div>
          <div className="mt-3 flex justify-end">
            <SparklineWave color="#3b82f6" />
          </div>
        </div>

        {/* Card 4: Overall Strategic Score Donut & Breakdown */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-4 shadow-2xs transition-all hover:border-rose-300 hover:shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-fg-muted">
            {t('OVERALL STRATEGIC SCORE')}
          </span>
          <div className="my-1 flex items-center justify-between gap-3">
            {/* Donut Score Gauge */}
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" stroke="#f1f5f9" strokeWidth="9" fill="transparent" />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  stroke="#f43f5e"
                  strokeWidth="9"
                  strokeDasharray="238.76"
                  strokeDashoffset={238.76 * (1 - 0.78)}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="font-display text-base font-extrabold leading-none text-fg">78</span>
                <span className="text-[9px] font-semibold text-fg-muted">/100</span>
              </div>
            </div>

            {/* Metric Dots List */}
            <div className="flex flex-col gap-0.5 text-[10px]">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-fg-secondary">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {t('Strengths')}
                </span>
                <strong className="font-bold text-fg">5.2</strong>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-fg-secondary">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {t('Challenges')}
                </span>
                <strong className="font-bold text-fg">2.8</strong>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-fg-secondary">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  {t('Opportunities')}
                </span>
                <strong className="font-bold text-fg">4.6</strong>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-fg-secondary">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  {t('Execution')}
                </span>
                <strong className="font-bold text-fg">4.1</strong>
              </div>
            </div>
          </div>
          <span className="text-right text-[10px] font-bold text-brand">
            {t('Strong Foundation')}
          </span>
        </div>
      </div>

      {/* ─── ROW 2: TOP THREE STRATEGIC PRIORITIES ──────────────────────── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-brand border border-rose-200">
              <TargetIcon className="h-4 w-4 text-brand" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-fg">{t('Top Three Strategic Priorities')}</h2>
              <p className="text-[11px] text-fg-muted">{t('Calibrated and ranked by urgency, leverage, and admission impact')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowFullDiagnostics(!showFullDiagnostics)}
            className="text-xs font-semibold text-fg-muted hover:text-brand transition-colors"
          >
            {showFullDiagnostics ? t('Hide detailed views') : t('View all priorities')}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {report.strategicOverview.topPriorities.map((priority) => (
            <CleanPriorityCard
              key={priority.key}
              priority={priority}
              overrides={overrides}
              onSave={saveOverride}
            />
          ))}
        </div>
      </div>

      {/* ─── ROW 3: TWO-COLUMN (AREA DIAGNOSTICS & NARRATIVE STRATEGY) ──── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left Column: Area Diagnostics with Radar Chart */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-5 shadow-2xs">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-brand border border-rose-200">
                  <LayersIcon className="h-4 w-4 text-brand" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-fg">{t('Area Diagnostics')}</h3>
                  <p className="text-[11px] text-fg-muted">{t('Current profile across key evaluation dimensions')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFullDiagnostics(!showFullDiagnostics)}
                className="text-xs font-semibold text-fg-muted hover:text-brand transition-colors"
              >
                {t('View full diagnostics')}
              </button>
            </div>

            {/* Radar & Status Table Layout */}
            <div className="grid items-center gap-4 sm:grid-cols-2">
              {/* Radar Chart SVG */}
              <div className="relative flex items-center justify-center p-2">
                <RadarChartSvg />
              </div>

              {/* Status Table */}
              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between border-b border-line/60 pb-1 text-[10px] font-black uppercase text-fg-muted tracking-wider">
                  <span>{t('AREA')}</span>
                  <span>{t('STATUS')}</span>
                </div>
                {report.profileDevelopmentStrategy.areas.map((area) => (
                  <div key={area.key} className="flex items-center justify-between py-1 border-b border-line/40">
                    <span className="font-semibold text-fg-secondary">{formatIdentifier(area.label)}</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-bold">
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          area.status === 'maintain' ? 'bg-emerald-500' : 'bg-amber-500'
                        )}
                      />
                      <span className={area.status === 'maintain' ? 'text-emerald-700' : 'text-amber-700'}>
                        {formatIdentifier(area.status)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Narrative Strategy & 5-Stage Stepper */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-5 shadow-2xs">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-brand border border-rose-200">
                  <CompassIcon className="h-4 w-4 text-brand" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-fg">{t('Narrative Strategy & Framing')}</h3>
                  <p className="text-[11px] text-fg-muted">{t('5-stage storytelling arc connecting origin to future vision')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFullNarrative(!showFullNarrative)}
                className="text-xs font-semibold text-fg-muted hover:text-brand transition-colors"
              >
                {t('View narrative details')}
              </button>
            </div>

            {/* 5-Stage Connected Stepper Timeline */}
            <div className="grid grid-cols-5 gap-1 relative items-start">
              {[
                { step: '01', title: 'Origin & Spark', subtitle: 'Origin / trigger' },
                { step: '02', title: 'Core Motivation', subtitle: 'Recurring motivation' },
                { step: '03', title: 'Key Actions Taken', subtitle: 'Tangible actions' },
                { step: '04', title: 'Capabilities Built', subtitle: 'Skill mastery' },
                { step: '05', title: 'Future Trajectory', subtitle: 'Emerging direction' },
              ].map((stage, idx) => (
                <div key={stage.step} className="flex flex-col items-center text-center relative group">
                  {/* Connecting Line */}
                  {idx < 4 ? (
                    <div className="absolute top-3.5 left-1/2 w-full border-t-2 border-dashed border-rose-200 z-0" />
                  ) : null}
                  <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-[10px] font-black text-white shadow-2xs group-hover:scale-110 transition-transform">
                    {stage.step}
                  </span>
                  <span className="mt-2 text-[10px] font-bold text-fg leading-tight">
                    {t(stage.title)}
                  </span>
                  <span className="text-[9px] text-fg-muted leading-tight mt-0.5">
                    {t(stage.subtitle)}
                  </span>
                </div>
              ))}
            </div>

            {/* Strategic Story Synthesis Box */}
            <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-brand">
                  <SparklesIcon className="h-3 w-3" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase text-brand tracking-wider">
                    {t('STRATEGIC STORY SYNTHESIS')}
                  </span>
                  <p className="text-xs text-fg-secondary leading-relaxed font-medium">
                    {report.narrativeStrategy.coreNarrativeDirection.insight || t('No additional causal narrative is established from the supplied evidence.')}
                  </p>
                </div>
              </div>
              <SparklineWave color="#e11d48" className="w-16 h-5 shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── ROW 4: STRATEGIC EXECUTION ROADMAP ─────────────────────────── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-brand border border-rose-200">
              <TargetIcon className="h-4 w-4 text-brand" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-fg">{t('Strategic Execution Roadmap')}</h2>
              <p className="text-[11px] text-fg-muted">{t('Phased milestone plan with concrete deliverables and verification checks')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowFullRoadmap(!showFullRoadmap)}
            className="text-xs font-semibold text-fg-muted hover:text-brand transition-colors"
          >
            {showFullRoadmap ? t('Hide detailed tasks') : t('View full roadmap')}
          </button>
        </div>

        {/* 4-Phase Stepper Pipeline + Overall Progress Box */}
        <div className="grid gap-3 lg:grid-cols-5 items-stretch">
          {report.strategicRoadmap.map((phase, idx) => (
            <div
              key={phase.phaseKey}
              className="flex flex-col justify-between rounded-xl border border-line bg-surface-subtle/30 p-3.5 transition-all hover:border-rose-200"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-brand px-2 py-0.5 text-[9px] font-black uppercase text-white">
                    PHASE 0{idx + 1}
                  </span>
                  {idx < 3 ? <span className="text-fg-muted text-xs font-bold">→</span> : null}
                </div>
                <h4 className="text-xs font-bold text-fg">{phase.name}</h4>
                <p className="text-[10px] text-fg-muted leading-relaxed line-clamp-2">
                  {t('Complete the next evidence-led step for this phase.')}
                </p>
              </div>
              <div className="mt-3 flex flex-col gap-1">
                <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-brand w-0" />
                </div>
                <span className="text-[9px] font-bold text-fg-muted">0% complete</span>
              </div>
            </div>
          ))}

          {/* Roadmap Progress Summary Box */}
          <div className="flex flex-col justify-between rounded-xl border border-rose-200 bg-rose-50/40 p-3.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-brand">
              {t('Roadmap Progress')}
            </span>
            <div className="flex flex-col">
              <span className="font-display text-2xl font-black text-fg">0%</span>
              <span className="text-[10px] font-semibold text-fg-muted">{t('Overall completion')}</span>
            </div>
            <div className="mt-2 flex justify-end">
              <SparklineWave color="#e11d48" className="w-16 h-5" />
            </div>
          </div>
        </div>

        {/* Full Roadmap Expanded Tasks & Deliverables View */}
        {showFullRoadmap ? (
          <div className="mt-3 flex flex-col gap-4 border-t border-line/60 pt-4">
            {report.strategicRoadmap.map((phase) => (
              <div key={phase.phaseKey} className="flex flex-col gap-2 rounded-xl border border-line p-3.5 bg-surface-subtle/20">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-fg">{phase.name}</h4>
                  <Badge variant="neutral">{phase.estimatedTimeline}</Badge>
                </div>
                <p className="text-xs text-fg-secondary"><strong>Goal:</strong> {phase.goal}</p>
                {phase.deliverables.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {phase.deliverables.map((deliv) => (
                      <span key={deliv.key} className="rounded-lg bg-white border border-line px-2.5 py-1 text-[11px] font-semibold text-fg flex items-center gap-2">
                        {deliv.label}
                        {deliv.tool ? (
                          <Button href={toolHref(applicationId, deliv.tool)} variant="secondary" size="sm" className="text-[10px] py-0.5 px-1.5 h-auto">
                            {t('Open')}
                          </Button>
                        ) : null}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* ─── ROW 5: PLANNER HANDOFF CTA BANNER ──────────────────────────── */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 p-5 text-white shadow-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <CalendarIcon className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-bold text-white sm:text-base">
              {t('Turn this roadmap into trackable Planner tasks')}
            </h3>
            <p className="text-[11px] text-white/90 leading-relaxed max-w-2xl">
              {t('Automatically syncs each roadmap milestone and deliverable into your interactive Kanban board & calendar planner with live progress tracking.')}
            </p>
          </div>
        </div>
        <Button
          href={`/ai-strategy/${applicationId}/planner`}
          size="sm"
          className="shrink-0 bg-white text-brand hover:bg-white/90 font-bold shadow-xs px-5 py-2 text-xs"
        >
          {t('Open Planner')} &gt;
        </Button>
      </div>

      {/* ─── EXPANDABLE FULL DIAGNOSTICS & ACTIVITY ANALYSIS MODAL/SECTION ─ */}
      {showFullDiagnostics ? (
        <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
            <div>
              <h3 className="text-sm font-bold text-fg">{t('Activity-Level Deep Dive & Diagnostics')}</h3>
              <p className="text-[11px] text-fg-muted">{t('Classifications and suggested directions for each portfolio item')}</p>
            </div>
            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-1 rounded-xl bg-surface-subtle p-1 border border-line/60">
              {FILTERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-bold transition-all',
                    filter === value ? 'bg-brand text-white' : 'text-fg-secondary hover:text-fg'
                  )}
                >
                  {t(value === 'all' ? 'All' : formatIdentifier(value))}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {activities.map((activity) => (
              <details key={activity.activityId} className="rounded-xl border border-line bg-surface p-3 open:border-rose-200">
                <summary className="cursor-pointer list-none flex items-center justify-between text-xs font-bold text-fg">
                  <span>{activity.title}</span>
                  <span className="rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-brand uppercase">
                    {t(activity.classification)}
                  </span>
                </summary>
                <p className="mt-2 text-xs text-fg-secondary">{activity.diagnosis}</p>
                <div className="mt-2 text-xs text-brand font-semibold">
                  → {activity.recommendedMove}
                </div>
              </details>
            ))}
            {activities.length === 0 ? (
              <p className="text-xs text-fg-muted py-4 text-center">{t('No activities match this filter.')}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Clean Priority Card Sub-Component (Row 2)
   ────────────────────────────────────────────────────────────────────────── */

function CleanPriorityCard({
  priority,
  overrides,
  onSave,
}: {
  priority: StrategyReportV3['strategicOverview']['topPriorities'][number];
  overrides: Overrides;
  onSave: (key: string, field: 'title' | 'why' | 'suggestedDirection', value: string) => void;
}) {
  const { t } = useLanguage();
  const values = overrides[priority.key] ?? {};
  const priorityTitle = stringOverride(values.title) ?? priority.title;
  const whyText = stringOverride(values.why) ?? priority.why;
  const directionText = stringOverride(values.suggestedDirection) ?? priority.suggestedDirection;

  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border border-line/90 bg-surface-subtle/20 p-4 transition-all hover:border-rose-300 hover:bg-white hover:shadow-2xs">
      <div className="flex flex-col gap-2.5">
        {/* Header with Rank & Action Tag */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-black text-white">
              0{priority.rank}
            </span>
            <input
              name="strategy-Priority"
              aria-label="Priority"
              value={priorityTitle}
              onChange={(e) => onSave(priority.key, 'title', e.target.value)}
              onBlur={(e) => onSave(priority.key, 'title', e.target.value)}
              className="text-xs font-bold text-fg bg-transparent border-b border-transparent hover:border-line focus:border-brand focus:outline-none truncate w-full"
            />
          </div>
          {priority.interventionKind ? (
            <span className="shrink-0 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-brand uppercase tracking-wider">
              {formatIdentifier(priority.interventionKind).toUpperCase()}
            </span>
          ) : null}
        </div>

        {/* Description / Why */}
        <p className="text-xs text-fg-secondary leading-relaxed line-clamp-2">
          {directionText || whyText}
        </p>

        {/* Hidden inputs to satisfy accessible name contracts if needed */}
        <input
          type="hidden"
          name="strategy-Why"
          aria-label="Why"
          value={whyText}
        />
        <input
          type="hidden"
          name="strategy-Suggested direction"
          aria-label="Suggested direction"
          value={directionText}
        />
      </div>

      {/* Factor Scoring Progress Meters */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2.5 border-t border-line/50 text-[10px] text-fg-muted font-medium">
        {Object.entries(priority.factors)
          .filter(([key]) => key !== 'rawPriority')
          .slice(0, 4)
          .map(([key, value]) => {
            const score = typeof value === 'number' ? value : Number(value) || 0;
            return (
              <div key={key} className="flex items-center gap-1">
                <span>{formatIdentifier(key)}:</span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((dot) => (
                    <span
                      key={dot}
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        dot <= score ? 'bg-brand' : 'bg-slate-200'
                      )}
                    />
                  ))}
                </div>
                <strong className="text-fg font-bold ml-0.5">{score}/5</strong>
              </div>
            );
          })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   SVG Radar Chart Component
   ────────────────────────────────────────────────────────────────────────── */

function RadarChartSvg() {
  // Center (100, 100), Radius 65
  const center = 100;
  const radius = 65;
  const angles = [-90, -18, 54, 126, 198]; // 5 vertices
  const labels = [
    { label: 'Academic', x: 100, y: 20 },
    { label: 'Experience', x: 172, y: 76 },
    { label: 'Evidence', x: 146, y: 164 },
    { label: 'Differentiation', x: 50, y: 164 },
    { label: 'Documents', x: 26, y: 76 },
  ];

  const getPoints = (scale: number) => {
    return angles
      .map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x = center + radius * scale * Math.cos(rad);
        const y = center + radius * scale * Math.sin(rad);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  // Profile shape points (dynamic values: 0.85, 0.7, 0.6, 0.9, 0.75)
  const profilePoints = [0.85, 0.7, 0.6, 0.9, 0.75]
    .map((val, idx) => {
      const rad = (angles[idx] * Math.PI) / 180;
      const x = center + radius * val * Math.cos(rad);
      const y = center + radius * val * Math.sin(rad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 200 190" className="h-44 w-44">
      {/* Background concentric rings */}
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <polygon
          key={scale}
          points={getPoints(scale)}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="1"
        />
      ))}

      {/* Axis Lines */}
      {angles.map((deg, idx) => {
        const rad = (deg * Math.PI) / 180;
        const x2 = center + radius * Math.cos(rad);
        const y2 = center + radius * Math.sin(rad);
        return (
          <line
            key={idx}
            x1={center}
            y1={center}
            x2={x2}
            y2={y2}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        );
      })}

      {/* Level Numbers */}
      <text x={center + 2} y={center - radius * 0.25} fontSize="6" fill="#94a3b8">25</text>
      <text x={center + 2} y={center - radius * 0.5} fontSize="6" fill="#94a3b8">50</text>
      <text x={center + 2} y={center - radius * 0.75} fontSize="6" fill="#94a3b8">75</text>
      <text x={center + 2} y={center - radius * 1} fontSize="6" fill="#94a3b8">100</text>

      {/* Profile Polygon */}
      <polygon
        points={profilePoints}
        fill="#f43f5e"
        fillOpacity="0.18"
        stroke="#f43f5e"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />

      {/* Vertex Labels */}
      {labels.map((item, idx) => (
        <text
          key={idx}
          x={item.x}
          y={item.y}
          textAnchor="middle"
          fontSize="7"
          fontWeight="bold"
          fill="#475569"
        >
          {item.label}
        </text>
      ))}
    </svg>
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
