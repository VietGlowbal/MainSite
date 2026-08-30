'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, CheckItem, CheckList, Panel, Textarea, Badge } from '@/shared/ui';
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

export function StrategyReportV3View({ applicationId, report }: { applicationId: string; report: StrategyReportV3 }) {
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

  const saveOverride = (itemKey: string, field: 'title' | 'why' | 'suggestedDirection', value: string) => {
    const requestId = ++saveSequence.current;
    const previous = overrides[itemKey]?.[field];
    setOverrideError(false);
    setOverrides((current) => ({ ...current, [itemKey]: { ...current[itemKey], [field]: value } }));
    void fetch(`/api/applications/${applicationId}/report-overrides`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'strategy_v3', itemKey, field, value }),
    }).then((res) => {
      if (!res.ok) throw new Error('Override save failed');
    }).catch(() => {
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
      <section id="strategic-overview" aria-labelledby="strategy-v3-overview" className="flex flex-col gap-gb-lg">
        <h2 id="strategy-v3-overview" className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
          {t('Strategic Overview')}
        </h2>
        <Panel className="flex flex-col gap-gb-xl">
          {overrideError ? <p role="alert" className="text-gb-sm text-fg-error">{t('Could not save this edit. Please try again.')}</p> : null}
          <div className="grid gap-gb-lg md:grid-cols-3">
            <OverviewBlock label={t('Profile strength')} value={report.strategicOverview.currentPosition.profileStrength.statement} />
            <OverviewBlock label={t('Key challenge')} value={report.strategicOverview.currentPosition.keyChallenge.statement} />
            <OverviewBlock label={t('Strategic opportunity')} value={report.strategicOverview.strategicOpportunity.statement} />
          </div>
          <div className="grid gap-gb-lg md:grid-cols-2">
            <OverviewBlock label={t('Strategic goal')} value={`${report.strategicOverview.strategicGoal.directionOfImprovement} ${report.strategicOverview.strategicGoal.communicationGoal}`} />
            <OverviewBlock label={t('Expected outcome')} value={report.strategicOverview.expectedOutcome} />
          </div>
          <details open className="rounded-gb-xl bg-surface-muted p-gb-lg">
            <summary className="cursor-pointer text-gb-sm font-semibold text-fg">{t('Top three priorities')}</summary>
            <div className="mt-gb-lg flex flex-col gap-gb-lg">
              {report.strategicOverview.topPriorities.map((priority) => (
                <PriorityCard key={priority.key} priority={priority} overrides={overrides} onSave={saveOverride} />
              ))}
            </div>
          </details>
        </Panel>
      </section>

      <section id="profile-development" aria-labelledby="strategy-v3-profile" className="flex flex-col gap-gb-lg">
        <h2 id="strategy-v3-profile" className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
          {t('Profile Development Strategy')}
        </h2>
        <div className="grid gap-gb-lg md:grid-cols-2">
          {report.profileDevelopmentStrategy.areas.map((area) => <ProfileAreaCard key={area.key} area={area} />)}
        </div>
        <Panel className="flex flex-col gap-gb-lg">
          <div className="flex flex-wrap items-center justify-between gap-gb-md">
            <h3 className="text-gb-lg font-semibold text-fg">{t('Activity-level analysis')}</h3>
            <div className="flex flex-wrap gap-gb-xxs" role="group" aria-label={t('Filter activity analysis')}>
              {FILTERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className="rounded-gb-md border border-line px-gb-sm py-gb-xxs text-gb-xs text-fg-secondary aria-pressed:bg-brand aria-pressed:text-on-brand"
                >
                  {t(value === 'all' ? 'All' : value)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-gb-md">
            {activities.map((activity) => <ActivityCard key={activity.activityId} activity={activity} />)}
            {activities.length === 0 ? <p className="text-gb-sm text-fg-muted">{t('No activities match this filter.')}</p> : null}
          </div>
        </Panel>
      </section>

      <section id="narrative-strategy" aria-labelledby="strategy-v3-narrative" className="flex flex-col gap-gb-lg">
        <h2 id="strategy-v3-narrative" className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
          {t('Narrative Strategy')}
        </h2>
        <Panel className="flex flex-col gap-gb-xl">
          <div>
            <h3 className="text-gb-lg font-semibold text-fg">{t('Core narrative direction')}</h3>
            <div className="mt-gb-md grid gap-gb-md md:grid-cols-5">
              {[
                ['Origin / trigger', report.narrativeStrategy.coreNarrativeDirection.originTrigger],
                ['Recurring motivation', report.narrativeStrategy.coreNarrativeDirection.recurringMotivation],
                ['Actions', report.narrativeStrategy.coreNarrativeDirection.actions.join(' ')],
                ['Capabilities developed', report.narrativeStrategy.coreNarrativeDirection.capabilitiesDeveloped.join(' ')],
                ['Emerging direction', report.narrativeStrategy.coreNarrativeDirection.emergingDirection],
              ].map(([label, value], index) => (
                <div key={label} className="rounded-gb-xl bg-surface-muted p-gb-md">
                  <p className="text-gb-xxs font-medium uppercase tracking-wide text-fg-muted">{index + 1}. {t(String(label))}</p>
                  <p className="mt-gb-xs text-gb-sm text-fg-tertiary">{value ?? t('Not established from the available evidence.')}</p>
                </div>
              ))}
            </div>
            <p className="mt-gb-lg text-gb-sm leading-relaxed text-fg-tertiary">{report.narrativeStrategy.coreNarrativeDirection.insight}</p>
          </div>
          <div>
            <h3 className="text-gb-lg font-semibold text-fg">{t('Supporting themes')}</h3>
            <div className="mt-gb-md grid gap-gb-md md:grid-cols-2">
              {report.narrativeStrategy.supportingThemes.map((theme) => (
                <div key={theme.key} className="rounded-gb-xl border border-line p-gb-lg">
                  <Badge variant="brand-subtle">{theme.title}</Badge>
                  <p className="mt-gb-sm text-gb-sm text-fg-tertiary">{theme.significance}</p>
                </div>
              ))}
            </div>
          </div>
          {report.narrativeStrategy.narrativeTension ? (
            <div className="rounded-gb-xl border border-line p-gb-lg">
              <h3 className="text-gb-lg font-semibold text-fg">{t('Narrative tension / gap')}</h3>
              <Badge variant="neutral">{report.narrativeStrategy.narrativeTension.type}</Badge>
              <p className="mt-gb-sm text-gb-sm text-fg-tertiary">{report.narrativeStrategy.narrativeTension.observedGap}</p>
              <p className="mt-gb-sm text-gb-xs text-fg-muted">{report.narrativeStrategy.narrativeTension.whyItMatters}</p>
              <p className="mt-gb-sm text-gb-xs text-fg-brand">{report.narrativeStrategy.narrativeTension.possibleDirection}</p>
            </div>
          ) : null}
          <div>
            <h3 className="text-gb-lg font-semibold text-fg">{t('Narrative options')}</h3>
            <div className="mt-gb-md grid gap-gb-md md:grid-cols-2">
              {report.narrativeStrategy.narrativeOptions.map((option) => (
                <div key={option.key} className="rounded-gb-xl border border-line p-gb-lg">
                  <h4 className="text-gb-md font-semibold text-fg">{option.title}</h4>
                  <p className="mt-gb-sm text-gb-sm text-fg-tertiary">{option.centralIdea}</p>
                  <p className="mt-gb-sm text-gb-xs text-fg-muted">{option.whyItEmerges}</p>
                  <p className="mt-gb-sm text-gb-xs text-fg-brand">{t('Strategic fit')}: {option.strategicFit}</p>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </section>

      <section id="strategic-roadmap" aria-labelledby="strategy-v3-roadmap" className="flex flex-col gap-gb-lg">
        <h2 id="strategy-v3-roadmap" className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
          {t('Strategic Roadmap')}
        </h2>
        {report.strategicRoadmap.map((phase, index) => (
          <Panel key={phase.phaseKey} className="flex flex-col gap-gb-lg">
            <div className="flex flex-wrap items-center justify-between gap-gb-md">
              <h3 className="text-gb-lg font-semibold text-fg">{index + 1}. {phase.name}</h3>
              <Badge variant="neutral">{phase.estimatedTimeline}</Badge>
            </div>
            <p className="text-gb-sm text-fg-tertiary"><strong>{t('Goal')}:</strong> {phase.goal}</p>
            <RoadmapList label={t('Key actions')} items={phase.keyActions} />
            <div>
              <p className="text-gb-xs font-medium text-fg-muted">{t('Deliverables')}</p>
              <div className="mt-gb-sm flex flex-col gap-gb-sm">
                {phase.deliverables.map((deliverable) => (
                  <div key={deliverable.key} className="flex flex-wrap items-center justify-between gap-gb-md rounded-gb-xl border border-line p-gb-md">
                    <span className="text-gb-sm text-fg">{deliverable.label}</span>
                    {deliverable.tool ? <Button href={toolHref(applicationId, deliverable.tool)} variant="secondary" size="sm">{t('Open tool')}</Button> : null}
                  </div>
                ))}
              </div>
            </div>
            <RoadmapList label={t('Success criteria')} items={phase.successCriteria} />
          </Panel>
        ))}
        <Panel className="flex flex-col gap-gb-md">
          <h3 className="text-gb-lg font-semibold text-fg">{t('Turn this roadmap into Planner tasks')}</h3>
          <p className="max-w-2xl text-gb-sm text-fg-tertiary">{t('Adds one trackable Planner task for each roadmap deliverable and preserves completed work when the report regenerates.')}</p>
          <Button href={`/ai-strategy/${applicationId}/planner`} size="sm" className="self-start">{t('Add to Planner')}</Button>
        </Panel>
      </section>
    </div>
  );
}

function OverviewBlock({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-gb-sm rounded-gb-2xl bg-surface-muted p-gb-xl"><h3 className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{label}</h3><p className="text-gb-sm leading-relaxed text-fg-secondary">{value}</p></div>;
}

function PriorityCard({ priority, overrides, onSave }: { priority: StrategyReportV3['strategicOverview']['topPriorities'][number]; overrides: Overrides; onSave: (key: string, field: 'title' | 'why' | 'suggestedDirection', value: string) => void }) {
  const values = overrides[priority.key] ?? {};
  return <div className="rounded-gb-xl border border-line bg-surface p-gb-lg"><div className="mb-gb-md flex flex-wrap items-center gap-gb-sm"><Badge variant="brand-subtle">#{priority.rank}</Badge></div><div className="grid gap-gb-md md:grid-cols-3"><Editable label="Priority" value={stringOverride(values.title) ?? priority.title} onSave={(value) => onSave(priority.key, 'title', value)} /><Editable label="Why" value={stringOverride(values.why) ?? priority.why} onSave={(value) => onSave(priority.key, 'why', value)} multiline /><Editable label="Suggested direction" value={stringOverride(values.suggestedDirection) ?? priority.suggestedDirection} onSave={(value) => onSave(priority.key, 'suggestedDirection', value)} multiline /></div><div className="mt-gb-md flex flex-wrap gap-gb-xs text-gb-xxs text-fg-muted">{Object.entries(priority.factors).filter(([key]) => key !== 'rawPriority').map(([key, value]) => <span key={key} className="rounded-gb-md bg-surface-muted px-gb-xs py-gb-xxs">{key}: {value}</span>)}</div></div>;
}

function Editable({ label, value, onSave, multiline = false }: { label: string; value: string; onSave: (value: string) => void; multiline?: boolean }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDraft(value), 0);
    return () => window.clearTimeout(timer);
  }, [value]);
  return <label className="flex flex-col gap-gb-xxs"><span className="text-gb-xs font-medium text-fg-muted">{label}</span>{multiline ? <Textarea name={`strategy-${label}`} rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => { if (draft !== value) onSave(draft); }} className="resize-none" /> : <input name={`strategy-${label}`} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => { if (draft !== value) onSave(draft); }} className="rounded-gb-md border border-line bg-surface px-gb-sm py-gb-xxs text-gb-sm text-fg" />}</label>;
}

function ProfileAreaCard({ area }: { area: ProfileAreaDiagnosis }) {
  const { t } = useLanguage();
  return <Panel className="flex flex-col gap-gb-md"><div className="flex items-center justify-between gap-gb-sm"><h3 className="text-gb-lg font-semibold text-fg">{area.label}</h3><Badge variant={area.status === 'maintain' ? 'neutral' : 'brand-subtle'}>{t(area.status)}</Badge></div><p className="text-gb-sm text-fg-tertiary">{area.diagnosis}</p><p className="text-gb-xs text-fg-muted"><strong>{t('Why it matters')}:</strong> {area.whyItMatters}</p><p className="text-gb-xs text-fg-brand"><strong>{t('Suggested direction')}:</strong> {area.suggestedDirection}</p></Panel>;
}

function ActivityCard({ activity }: { activity: ActivityStrategyAnalysis }) {
  const { t } = useLanguage();
  return <details className="rounded-gb-xl border border-line p-gb-lg"><summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-gb-md"><span className="text-gb-md font-semibold text-fg">{activity.title}</span><Badge variant={activity.classification === 'deprioritize' ? 'neutral' : 'brand-subtle'}>{t(activity.classification)}</Badge></summary><p className="mt-gb-md text-gb-sm text-fg-tertiary">{activity.diagnosis}</p><div className="mt-gb-lg grid gap-gb-sm sm:grid-cols-2 lg:grid-cols-4">{Object.entries(activity.dimensions).map(([key, dimension]) => <div key={key} className="rounded-gb-lg bg-surface-muted p-gb-md"><p className="text-gb-xxs font-medium uppercase tracking-wide text-fg-muted">{t(key)}</p><p className="mt-gb-xxs text-gb-xs text-fg-tertiary">{dimension.statement}</p></div>)}</div><p className="mt-gb-md text-gb-xs text-fg-brand"><strong>{t('Recommended move')}:</strong> {activity.recommendedMove}</p></details>;
}

function RoadmapList({ label, items }: { label: string; items: string[] }) {
  return <div><p className="text-gb-xs font-medium text-fg-muted">{label}</p><CheckList>{items.map((item) => <CheckItem key={item}>{item}</CheckItem>)}</CheckList></div>;
}

function stringOverride(value: unknown): string | undefined { return typeof value === 'string' ? value : undefined; }

function toolHref(applicationId: string, tool: 'personal_canvas' | 'cv_builder' | 'statement_writer'): string {
  if (tool === 'personal_canvas') return `/ai-strategy/personal-report?return=${encodeURIComponent(`/ai-strategy/${applicationId}/strategy-report`)}`;
  if (tool === 'cv_builder') return `/ai-strategy/${applicationId}/cv/target-profile`;
  return `/ai-strategy/${applicationId}/statement`;
}
