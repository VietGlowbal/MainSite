'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StrategyPriorityLevel, StrategyReportV2 } from '../domain';
import {
  Badge,
  Button,
  CheckItem,
  CheckList,
  Panel,
  Textarea,
} from '@/shared/ui';
import { useLanguage } from '@/lib/i18n';

/**
 * The five-section F8 Strategy Report (`report_v2`).
 *
 * The Strategic Priority Table is student-editable: edits layer OVER the
 * generated base through `application_report_overrides` (keyed by the row's
 * stable key), so a regeneration that keeps a key can never erase the edit,
 * and one that drops the key simply stops showing it. A failed autosave never
 * blocks reading the rest of the report.
 *
 * Every sub-component lives at MODULE SCOPE — nesting them inside this view
 * would remount them on every parent render and wipe in-progress edits.
 */

type Overrides = Record<string, Record<string, unknown>>;

type PriorityField = 'title' | 'currentSituation' | 'whyItMatters' | 'expectedImpact';
type SaveableField = PriorityField | 'recommendedActions' | 'level';

function toolHref(
  tool: NonNullable<StrategyReportV2['executionRoadmap']['phases'][number]['deliverables'][number]['tool']>,
  applicationId: string,
  returnTo: string,
): string {
  if (tool === 'personal_canvas') {
    return `/ai-strategy/personal-report?return=${encodeURIComponent(returnTo)}`;
  }
  if (tool === 'cv_builder') return `/apply/${applicationId}/cv`;
  return `/apply/${applicationId}/statement-feedback`;
}

export function StrategyReportV2View({
  applicationId,
  report,
}: {
  applicationId: string;
  report: StrategyReportV2;
}) {
  const { t } = useLanguage();
  const strategyReportHref = `/ai-strategy/${applicationId}/strategy-report`;

  // ── Student overrides ────────────────────────────────────────────────────
  const [overrides, setOverrides] = useState<Overrides>({});
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/applications/${applicationId}/report-overrides?kind=strategy_f8`)
      .then((res) => res.json())
      .then((body: { overrides?: Overrides }) => {
        if (!cancelled && body.overrides) setOverrides(body.overrides);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  return (
    <div className="flex flex-col gap-gb-4xl" data-no-auto-translate data-report-auto-translate>
      {/* ─── 1 · STRATEGIC OVERVIEW ─────────────────────────────────────── */}
      <section aria-labelledby="v2-overview-heading" className="flex flex-col gap-gb-lg">
        <h2
          id="v2-overview-heading"
          className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg"
        >
          {t('Strategic Overview')}
        </h2>
        <Panel className="flex flex-col gap-gb-xl">
          <div className="grid gap-gb-xl md:grid-cols-3">
            <OverviewBlock label={t('Current position')}>
              {report.strategicOverview.currentPosition.profile}
            </OverviewBlock>
            <OverviewBlock label={t('Strategic goal')}>
              {report.strategicOverview.strategicGoal.primaryObjective}
            </OverviewBlock>
            <OverviewBlock label={t('Expected outcome')}>
              {report.strategicOverview.expectedOutcome}
            </OverviewBlock>
          </div>
          <div className="rounded-gb-xl bg-surface-muted p-gb-lg">
            <h3 className="text-gb-sm font-semibold text-fg">{t('Top three priorities')}</h3>
            <ol className="mt-gb-sm list-decimal space-y-gb-xxs pl-gb-xl text-gb-sm text-fg-tertiary">
              {report.strategicOverview.topPriorities.map((priority) => (
                <li key={priority}>{priority}</li>
              ))}
            </ol>
          </div>
        </Panel>
      </section>

      {/* ─── 2 · STRATEGIC PRIORITY TABLE (student-editable) ────────────── */}
      <section aria-labelledby="v2-priorities-heading" className="flex flex-col gap-gb-lg">
        <h2
          id="v2-priorities-heading"
          className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg"
        >
          {t('Strategic Priority Table')}
        </h2>
        <p className="text-gb-xs text-fg-muted">
          {t('You can edit this table — your changes are saved separately and survive regeneration.')}
        </p>
        <div className="flex flex-col gap-gb-lg">
          {report.priorityTable.map((row) => (
            <PriorityRowCard
              key={row.key}
              applicationId={applicationId}
              row={row}
              overrides={overrides}
            />
          ))}
        </div>
      </section>

      {/* ─── 3 · PROFILE DEVELOPMENT STRATEGY ───────────────────────────── */}
      <section aria-labelledby="v2-profile-dev-heading" className="flex flex-col gap-gb-lg">
        <h2
          id="v2-profile-dev-heading"
          className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg"
        >
          {t('Profile Development Strategy')}
        </h2>
        <Panel className="grid gap-gb-xl md:grid-cols-3">
          <StrategyBlock
            title={t('Academic')}
            lines={[
              [t('Current status'), report.profileDevelopmentStrategy.academic.currentStatus],
              [t('Gap'), report.profileDevelopmentStrategy.academic.gap],
              [t('Strategic focus'), report.profileDevelopmentStrategy.academic.strategicFocus],
              [t('Expected outcome'), report.profileDevelopmentStrategy.academic.expectedOutcome],
            ]}
          />
          <StrategyBlock
            title={t('Experience')}
            lines={[
              [t('Current status'), report.profileDevelopmentStrategy.experience.currentStatus],
              [t('Gap'), report.profileDevelopmentStrategy.experience.gap],
              [t('Strategic focus'), report.profileDevelopmentStrategy.experience.strategicFocus],
              [t('Expected outcome'), report.profileDevelopmentStrategy.experience.expectedOutcome],
            ]}
          />
          <StrategyBlock
            title={t('Differentiation')}
            lines={[
              [t('Current competitive advantage'), report.profileDevelopmentStrategy.differentiation.currentAdvantage],
              [t('What makes you unique'), report.profileDevelopmentStrategy.differentiation.uniqueness],
              [t('How to amplify it'), report.profileDevelopmentStrategy.differentiation.amplifyHow],
              [t('Desired admissions perception'), report.profileDevelopmentStrategy.differentiation.desiredPerception],
            ]}
          />
        </Panel>
      </section>

      {/* ─── 4 · NARRATIVE STRATEGY ─────────────────────────────────────── */}
      <section aria-labelledby="v2-narrative-heading" className="flex flex-col gap-gb-lg">
        <h2
          id="v2-narrative-heading"
          className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg"
        >
          {t('Narrative Strategy')}
        </h2>
        <Panel className="flex flex-col gap-gb-xl">
          <div className="rounded-gb-xl bg-surface-muted p-gb-lg">
            <h3 className="text-gb-sm font-semibold text-fg">{t('Core narrative')}</h3>
            <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-tertiary">
              {report.narrativeStrategy.coreNarrative.centralStory}
            </p>
            {report.narrativeStrategy.coreNarrative.supportingEvidence.length > 0 ? (
              <>
                <p className="mt-gb-md text-gb-xs font-medium text-fg-muted">{t('Supporting evidence')}</p>
                <CheckList>
                  {report.narrativeStrategy.coreNarrative.supportingEvidence.map((item) => (
                    <CheckItem key={item}>{item}</CheckItem>
                  ))}
                </CheckList>
              </>
            ) : null}
            <p className="mt-gb-md text-gb-xs text-fg-brand">
              {t('Admissions value')}: {report.narrativeStrategy.coreNarrative.admissionsValue}
            </p>
          </div>

          <div className="grid gap-gb-lg md:grid-cols-2">
            {report.narrativeStrategy.themes.map((theme) => (
              <div key={theme.key} className="rounded-gb-xl border border-line p-gb-lg">
                <Badge variant="brand-subtle">{theme.title}</Badge>
                <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-tertiary">{theme.rationale}</p>
                {theme.evidence.length > 0 ? (
                  <ul className="mt-gb-sm list-disc space-y-gb-xxs pl-gb-md text-gb-xs text-fg-muted">
                    {theme.evidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>

          <div className="rounded-gb-xl bg-surface-muted p-gb-lg">
            <h3 className="text-gb-sm font-semibold text-fg">{t('Consistency check')}</h3>
            <dl className="mt-gb-sm grid gap-gb-md sm:grid-cols-2">
              <ConsistencyLine label={t('What supports it')} value={report.narrativeStrategy.consistencyCheck.supports} />
              <ConsistencyLine
                label={t('What feels disconnected')}
                value={report.narrativeStrategy.consistencyCheck.feelsDisconnected}
              />
              <ConsistencyLine label={t('Emphasise')} value={report.narrativeStrategy.consistencyCheck.emphasise} />
              <ConsistencyLine
                label={t('Play a supporting role')}
                value={report.narrativeStrategy.consistencyCheck.supportingRole}
              />
            </dl>
          </div>
        </Panel>
      </section>

      {/* ─── 5 · EXECUTION ROADMAP ──────────────────────────────────────── */}
      <section aria-labelledby="v2-roadmap-heading" className="flex flex-col gap-gb-lg">
        <h2
          id="v2-roadmap-heading"
          className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg"
        >
          {t('Execution Roadmap')}
        </h2>
        {report.executionRoadmap.phases.map((phase, index) => (
          <Panel key={phase.phaseKey} className="flex flex-col gap-gb-lg">
            <div className="flex items-center justify-between gap-gb-md">
              <h3 className="text-gb-md font-semibold text-fg">
                {index + 1}. {phase.name}
              </h3>
              <Badge variant="neutral">{phase.timeline}</Badge>
            </div>
            <p className="text-gb-sm leading-relaxed text-fg-tertiary">{phase.objective}</p>
            {phase.keyActions.length > 0 ? (
              <div>
                <p className="text-gb-xs font-medium text-fg-muted">{t('Key actions')}</p>
                <CheckList>
                  {phase.keyActions.map((action) => (
                    <CheckItem key={action}>{action}</CheckItem>
                  ))}
                </CheckList>
              </div>
            ) : null}
            {phase.deliverables.length > 0 ? (
              <div className="flex flex-col gap-gb-sm">
                <p className="text-gb-xs font-medium text-fg-muted">{t('Deliverables')}</p>
                {phase.deliverables.map((deliverable) => {
                  const href = deliverable.tool
                    ? toolHref(deliverable.tool, applicationId, strategyReportHref)
                    : null;
                  return (
                    <div
                      key={deliverable.key}
                      className="flex items-center justify-between gap-gb-md rounded-gb-xl border border-line p-gb-md"
                    >
                      <span className="text-gb-sm text-fg">{deliverable.label}</span>
                      {href ? (
                        <Button href={href} variant="secondary" size="sm">
                          {t('Open tool')}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
            {phase.successCriteria.length > 0 ? (
              <div>
                <p className="text-gb-xs font-medium text-fg-muted">{t('Success criteria')}</p>
                <ul className="list-disc space-y-gb-xxs pl-gb-md text-gb-sm text-fg-tertiary">
                  {phase.successCriteria.map((criterion) => (
                    <li key={criterion}>{criterion}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>
        ))}
        <AddToPlannerCard applicationId={applicationId} />
      </section>
    </div>
  );
}

// ─── Module-scope sub-components ─────────────────────────────────────────────

type PriorityRow = StrategyReportV2['priorityTable'][number];

function PriorityRowCard({
  applicationId,
  row,
  overrides,
}: {
  applicationId: string;
  row: PriorityRow;
  overrides: Overrides;
}) {
  const { t } = useLanguage();
  const [fieldStates, setFieldStates] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  useEffect(() => {
    const refs = timers.current;
    return () => {
      for (const timer of Object.values(refs)) if (timer) clearTimeout(timer);
    };
  }, []);

  const saveField = useCallback(
    (field: SaveableField, value: unknown) => {
      setFieldStates((prev) => ({ ...prev, [field]: 'saving' }));
      if (timers.current[field]) clearTimeout(timers.current[field]);
      timers.current[field] = setTimeout(async () => {
        try {
          const res = await fetch(`/api/applications/${applicationId}/report-overrides`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemKey: row.key, field, value }),
          });
          setFieldStates((prev) => ({ ...prev, [field]: res.ok ? 'saved' : 'error' }));
        } catch {
          setFieldStates((prev) => ({ ...prev, [field]: 'error' }));
        }
      }, 700);
    },
    [applicationId, row.key],
  );

  const overrideValue = (field: string): string | undefined => {
    const raw = overrides[row.key]?.[field];
    if (raw === undefined || raw === null) return undefined;
    if (Array.isArray(raw)) return raw.map(String).join('\n');
    return String(raw);
  };

  const markerFor = (field: string, overridden: boolean) => {
    const state = fieldStates[field];
    if (!overridden && !state) return null;
    return (
      <span aria-live="polite" className="text-gb-xxs text-fg-muted">
        {state === 'saving'
          ? t('Saving…')
          : state === 'error'
            ? t('Save error')
            : overridden || state === 'saved'
              ? t('Saved')
              : ''}
      </span>
    );
  };

  const titleOverride = overrideValue('title');
  const situationOverride = overrideValue('currentSituation');
  const whyOverride = overrideValue('whyItMatters');
  const actionsOverride = overrideValue('recommendedActions');
  const impactOverride = overrideValue('expectedImpact');
  const levelOverride = overrides[row.key]?.level as StrategyPriorityLevel | undefined;

  return (
    <Panel className="flex flex-col gap-gb-lg">
      <div className="flex flex-wrap items-end justify-between gap-gb-md">
        <div className="min-w-0 flex-1">
          <EditableField
            fieldKey="title"
            rowKey={row.key}
            label={t('Priority')}
            value={titleOverride ?? row.title}
            multiline={false}
            onSave={(value) => saveField('title', value)}
          />
        </div>
        <label className="flex items-center gap-gb-sm pb-gb-xxs text-gb-xs text-fg-muted">
          {markerFor('level', levelOverride !== undefined)}
          {t('Level')}
          <select
            value={levelOverride ?? row.level}
            onChange={(event) => saveField('level', event.target.value)}
            className="rounded-gb-md border border-line bg-surface px-gb-sm py-gb-xxs text-gb-xs text-fg"
          >
            <option value="critical">{t('Critical')}</option>
            <option value="high">{t('High')}</option>
            <option value="medium">{t('Medium')}</option>
          </select>
        </label>
      </div>

      <EditableField
        fieldKey="currentSituation"
        rowKey={row.key}
        label={t('Current situation')}
        value={situationOverride ?? row.currentSituation}
        multiline
        onSave={(value) => saveField('currentSituation', value)}
      />
      <EditableField
        fieldKey="whyItMatters"
        rowKey={row.key}
        label={t('Why it matters')}
        value={whyOverride ?? row.whyItMatters}
        multiline
        onSave={(value) => saveField('whyItMatters', value)}
      />
      <EditableField
        fieldKey="recommendedActions"
        rowKey={row.key}
        label={t('Recommended actions')}
        value={actionsOverride ?? row.recommendedActions.join('\n')}
        multiline
        onSave={(value) =>
          saveField(
            'recommendedActions',
            value.split('\n').map((line) => line.trim()).filter(Boolean),
          )
        }
      />
      <EditableField
        fieldKey="expectedImpact"
        rowKey={row.key}
        label={t('Expected impact')}
        value={impactOverride ?? row.expectedImpact}
        multiline
        onSave={(value) => saveField('expectedImpact', value)}
      />
    </Panel>
  );
}

function EditableField({
  fieldKey,
  rowKey,
  label,
  value,
  multiline,
  onSave,
}: {
  fieldKey: string;
  rowKey: string;
  label: string;
  value: string;
  multiline: boolean;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  // Sync the draft when the underlying value changes (override loaded after
  // mount, or regeneration swapped the base) — React's recommended
  // adjust-state-during-render pattern instead of an effect.
  const [lastSynced, setLastSynced] = useState(value);
  if (value !== lastSynced) {
    setLastSynced(value);
    setDraft(value);
  }
  const name = `priority-${rowKey}-${fieldKey}`;
  return (
    <label className="flex flex-col gap-gb-xxs">
      <span className="text-gb-xs font-medium text-fg-muted">{label}</span>
      {multiline ? (
        <Textarea
          name={name}
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft !== value) onSave(draft);
          }}
          className="resize-none"
        />
      ) : (
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft !== value) onSave(draft);
          }}
          className="rounded-gb-md border border-line bg-surface px-gb-sm py-gb-xxs text-gb-sm text-fg"
        />
      )}
    </label>
  );
}

function OverviewBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-gb-sm rounded-gb-2xl bg-surface-muted p-gb-xl">
      <h3 className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{label}</h3>
      <p className="text-gb-sm leading-relaxed text-fg-secondary">{children}</p>
    </div>
  );
}

function StrategyBlock({ title, lines }: { title: string; lines: Array<[string, string]> }) {
  return (
    <div className="flex flex-col gap-gb-md rounded-gb-xl bg-surface-muted p-gb-lg">
      <h3 className="text-gb-sm font-semibold text-fg">{title}</h3>
      <dl className="flex flex-col gap-gb-md">
        {lines.map(([label, value]) => (
          <ConsistencyLine key={label} label={label} value={value} />
        ))}
      </dl>
    </div>
  );
}

function ConsistencyLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gb-xxs font-medium text-fg-muted">{label}</dt>
      <dd className="text-gb-xs leading-relaxed text-fg-tertiary">{value}</dd>
    </div>
  );
}

/**
 * Opens the canonical Planner, whose page initializer compiles and reconciles
 * the latest F8 roadmap before rendering it.
 */
function AddToPlannerCard({ applicationId }: { applicationId: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  function run() {
    router.push(`/ai-strategy/${applicationId}/planner`);
  }

  return (
    <Panel className="flex flex-col gap-gb-md">
      <h3 className="text-gb-lg font-semibold text-fg">{t('Turn this roadmap into Planner tasks')}</h3>
      <p className="max-w-2xl text-gb-sm text-fg-tertiary">
        {t(
          'Adds the deliverables from each phase above to your Planner as tasks you can track. Safe to click again after this report regenerates — it updates the same tasks rather than duplicating them.',
        )}
      </p>
      <Button
        size="sm"
        className="self-start"
        onClick={run}
      >
        {t('Add to Planner')}
      </Button>
    </Panel>
  );
}
