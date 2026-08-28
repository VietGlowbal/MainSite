'use client';

import { getV2Sections } from '../domain';
import type { MatchingReportV3 } from '@/lib/ai/matching/domain';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n';
import { withReturn } from './personal-report/shared';
import type { MatchingReportPageData } from '../domain';
import {
  MATCH_SCORE_DISCLAIMER,
  eligibilityRows,
  fitRows,
  matchSummary,
  tieredGaps,
  type ClassificationTone,
  type FitRow,
  type MatchSummary,
} from '../domain';
import {
  Avatar,
  Badge,
  Button,
  CheckItem,
  CheckList,
  Panel,
  ProgressBar,
  type BadgeVariant,
} from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { RequirementStatusTrack } from './matching-report';
import type { EligibilityRow } from '../domain';
import { PROGRAMME_FIT_METRICS, UNIVERSITY_FIT_METRICS } from '@/lib/ai/matching/v3-scoring';

/**
 * The Matching Report — six sections, per docs/strategy-reports-spec.md.
 *
 * ─── WHY THIS REPLACED A TAB STRIP ───────────────────────────────────────────
 *
 * The previous canonical route rendered a six-tab view of catalogue facts
 * (`programme-fit-report.tsx`) which never showed the F5 assessment at all,
 * while this component — the one built on the F5 shape — was exported and
 * rendered by nothing. A student reading the tabs learned what the course
 * costs, not whether they fit it.
 *
 * Tabs also hid the one thing this report exists to say. A student who opens
 * "how well do I match" and has to click through six tabs to find out is being
 * asked to do the report's job. Everything is on one page now, in the order the
 * question is actually asked: where do I stand, why, am I eligible, what is
 * missing, how does an admissions reader see me, what do I do next.
 *
 * ─── THE NUMBERS ARE ALIGNMENT, NEVER LIKELIHOOD ─────────────────────────────
 *
 * `matchPercent` is a weighted rubric score. It is not a chance of admission
 * and `MATCH_SCORE_DISCLAIMER` sits directly under it so the caption cannot
 * drift away from the figure. See core principle 7.
 *
 * ─── WHAT IS DELIBERATELY NOT HERE YET ───────────────────────────────────────
 *
 * The layout's Admissions Perspective has four blocks. Two ("Questions we still
 * have", "What we'd like to see") need AI output the fit record does not carry,
 * so rather than fabricate an admissions voice, this renders the two that have
 * real backing plus an honest account of what could not be checked. Adding the
 * other two means new prompt fields and a new column — tracked as follow-up.
 */

const TONE_BADGE: Record<ClassificationTone, BadgeVariant> = {
  safe: 'safe',
  recommend: 'recommend',
  reach: 'reach',
  neutral: 'neutral',
  blocked: 'reach',
};

const SECTIONS = [
  { id: 'summary', label: 'Overall match' },
  { id: 'breakdown', label: 'Why you match' },
  { id: 'criteria', label: 'Entry requirements' },
  { id: 'gaps', label: 'Gaps and risks' },
  { id: 'perspective', label: 'Admissions view' },
  { id: 'next', label: 'What next' },
] as const;

const V3_METRIC_LABELS = Object.fromEntries(
  [...UNIVERSITY_FIT_METRICS, ...PROGRAMME_FIT_METRICS].map((metric) => [metric.id, metric.label]),
) as Record<string, string>;
const V3_SUBMETRIC_LABELS = Object.fromEntries(
  [...UNIVERSITY_FIT_METRICS, ...PROGRAMME_FIT_METRICS].flatMap((metric) =>
    metric.submetrics.map((submetric) => [submetric.id, submetric.label]),
  ),
) as Record<string, string>;

function verified(value: string | null | undefined, fallback: string) {
  return value || fallback;
}

export function MatchingReportView({
  data,
  migrationMissing,
}: {
  data: MatchingReportPageData;
  migrationMissing: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    migrationMissing ? t('Matching Report is not enabled in the database.') : null,
  );
  const [nextAt, setNextAt] = useState<string | null>(null);
  useLoadingIndicator(busy, t('Assessing programme fit'));

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/applications/${data.id}/match-insights`, {
        method: 'POST',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body?.error ?? t('We could not build the report. Please try again.'));
        const nextRegenerationAt = body?.nextRegenerationAt ?? body?.nextAvailableAt;
        if (nextRegenerationAt) setNextAt(nextRegenerationAt);
        return;
      }
      router.refresh();
    } catch {
      setError(t('We could not reach the server. Please check your connection and try again.'));
    } finally {
      setBusy(false);
    }
  }

  const analysis = data.analysis;

  if (!analysis) {
    return (
      <div className="flex flex-col items-start gap-gb-xl">
        <div className="flex flex-col gap-gb-md">
          <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
            {data.courseName}
          </h1>
          <p className="text-gb-md text-fg-tertiary">{data.universityName}</p>
          <p className="max-w-2xl text-gb-sm text-fg-tertiary">
            {t(
              'The report checks entry requirements first, then scores academic fit, profile and values, career direction, finances and readiness as separate dimensions.',
            )}
          </p>
        </div>
        {error ? <p className="max-w-xl text-gb-sm text-fg-error">{error}</p> : null}
        <Button size="lg" onClick={generate} disabled={busy || migrationMissing}>
          {busy ? t('Creating report…') : t('Create Matching Report')}
        </Button>
        <Button href={withReturn('/profile', `/ai-strategy/${data.id}/matching-report`)} variant="secondary">
          {t('Check profile data')}
        </Button>
      </div>
    );
  }

  if (analysis.reportV3) {
    return <V3ReportView data={data} report={analysis.reportV3} busy={busy} onGenerate={generate} error={error} t={t} />;
  }

  const fit = analysis.fit;
  const summary = matchSummary(fit);
  
  if (analysis.reportV2) {
    const v2 = getV2Sections(analysis.reportV2);
    const criterionLabels = new Map(
      analysis.reportV2.criteria.map((criterion) => [criterion.id, criterion.label]),
    );
    const criterionLabel = (id: string, fallback: string) => criterionLabels.get(id) ?? fallback;
    const fitLabel = {
      strong_current_alignment: 'Strong current alignment',
      moderate_current_alignment: 'Moderate current alignment',
      limited_current_alignment: 'Limited current alignment',
      not_assessed: 'Not assessed',
    }[v2.snapshot.fitLabel];

    return (
      <div className="flex flex-col gap-gb-4xl" data-no-auto-translate data-report-auto-translate>
        <ReportHeader
          data={data}
          summary={summary}
          busy={busy}
          onGenerate={generate}
          t={t}
        />

        {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}
        {nextAt ? (
          <p className="text-gb-xs text-fg-muted">
            {t('Next free generation')}: {new Date(nextAt).toLocaleString('vi-VN')}
          </p>
        ) : null}

        <div className="grid gap-gb-3xl lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div className="flex min-w-0 flex-col gap-gb-4xl">
            <section className="flex flex-col gap-gb-xl">
              <h2 className="text-gb-display-xs font-semibold text-fg">{t('Current Alignment Snapshot')}</h2>
              <Panel className="flex flex-col gap-gb-lg">
                <div className="flex flex-col gap-gb-sm">
                  <Badge variant={fitLabel === 'Strong current alignment' ? 'safe-chip' : fitLabel === 'Limited current alignment' ? 'reach' : 'neutral-chip'}>
                    {t(fitLabel)}
                  </Badge>
                  <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">{v2.snapshot.summary}</p>
                </div>
                <div className="grid gap-gb-md sm:grid-cols-2">
                  <div>
                    <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('Strongest Alignment Areas')}</p>
                    <ul className="mt-gb-xs space-y-gb-xs text-gb-sm text-fg-secondary">
                      {v2.strengths.slice(0, 2).map((strength) => <li key={strength.id}>{strength.title}</li>)}
                      {v2.strengths.length === 0 ? <li>{t('No evidence-backed strengths were recorded for this programme yet.')}</li> : null}
                    </ul>
                  </div>
                  <div>
                    <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('Important Gaps')}</p>
                    <ul className="mt-gb-xs space-y-gb-xs text-gb-sm text-fg-secondary">
                      {v2.gaps.slice(0, 2).map((gap) => <li key={gap.id}>{gap.title}</li>)}
                      {v2.gaps.length === 0 ? <li>{t('We did not find evidence-backed gaps for this programme.')}</li> : null}
                    </ul>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-gb-lg gap-y-gb-xs border-t border-line pt-gb-md text-gb-xs text-fg-muted">
                  <span>{t('Alignment score')}: {v2.snapshot.fitScore === null ? t('Not assessed') : `${v2.snapshot.fitScore}%`}</span>
                  <span>{t('Evidence coverage')}: {v2.snapshot.evidenceCoverage}%</span>
                </div>
                <p className="text-gb-xs text-fg-muted">{t(MATCH_SCORE_DISCLAIMER)}</p>
              </Panel>
            </section>

            <section className="flex flex-col gap-gb-xl">
              <h2 className="text-gb-display-xs font-semibold text-fg">{t('Critical Requirements')}</h2>
              {v2.criticalRequirements.length > 0 ? (
                <RequirementStatusTrack
                  criteria={v2.criticalRequirements.map((r): EligibilityRow => ({
                    key: r.criterionId,
                    label: criterionLabel(r.criterionId, r.criterionId),
                    status: r.status === 'meets' ? 'met' : r.status === 'does_not_meet' ? 'not_met' : 'unknown',
                    statusLabel: r.status === 'meets' ? 'Met' : r.status === 'does_not_meet' ? 'Not met' : 'We could not check this',
                    blocking: r.status === 'does_not_meet',
                  }))}
                />
              ) : <Panel><p className="text-gb-sm text-fg-muted">{t('No hard requirements were recorded.')}</p></Panel>}
              {v2.criticalRequirements.map((requirement) => (
                <Panel key={`hard-${requirement.criterionId}`} className="flex flex-col gap-gb-xs">
                  <h3 className="text-gb-md font-semibold text-fg">{criterionLabel(requirement.criterionId, requirement.criterionId)}</h3>
                  <p className="text-gb-sm text-fg-secondary">{requirement.explanation}</p>
                  <V2References evidenceIds={requirement.evidenceIds} sourceRefs={[]} t={t} />
                </Panel>
              ))}
            </section>

            <section className="flex flex-col gap-gb-xl">
              <h2 className="text-gb-display-xs font-semibold text-fg">{t('Strongest Alignment Areas')}</h2>
              {v2.strengths.length > 0 ? v2.strengths.map((strength) => (
                <Panel key={strength.id} className="flex flex-col gap-gb-xs">
                  <h3 className="text-gb-md font-semibold text-fg">{strength.title}</h3>
                  <p className="text-gb-sm text-fg-secondary">{strength.description}</p>
                  <V2References evidenceIds={strength.evidenceIds} sourceRefs={[]} t={t} />
                </Panel>
              )) : <Panel><p className="text-gb-sm text-fg-muted">{t('No evidence-backed strengths were recorded for this programme yet.')}</p></Panel>}
            </section>
            
            <section className="flex flex-col gap-gb-xl">
              <h2 className="text-gb-display-xs font-semibold text-fg">{t('Important Gaps')}</h2>
              {v2.gaps.length > 0 ? v2.gaps.map((gap) => (
                <Panel key={gap.id} className="flex flex-col gap-gb-xs">
                  <div className="flex flex-wrap items-center gap-gb-sm">
                    <Badge variant={gap.severity === 'critical' || gap.severity === 'high' ? 'reach' : 'neutral-chip'}>{t(gap.severity)}</Badge>
                    <h3 className="text-gb-md font-semibold text-fg">{gap.title}</h3>
                  </div>
                  <p className="text-gb-sm text-fg-secondary">{gap.description}</p>
                  {gap.evidenceNeeded.length > 0 ? <p className="text-gb-xs text-fg-muted">{t('Evidence needed')}: {gap.evidenceNeeded.join(' · ')}</p> : null}
                  <V2References evidenceIds={gap.currentEvidenceIds} sourceRefs={[]} t={t} />
                </Panel>
              )) : <Panel><p className="text-gb-sm text-fg-muted">{t('We did not find evidence-backed gaps for this programme.')}</p></Panel>}
            </section>

            <section className="flex flex-col gap-gb-xl">
              <h2 className="text-gb-display-xs font-semibold text-fg">{t('Programme Criteria Breakdown')}</h2>
              {v2.criteriaBreakdown.map((signal) => (
                <Panel key={signal.criterionId} className="flex flex-col gap-gb-xs">
                  <div className="flex flex-wrap items-center justify-between gap-gb-sm">
                    <h3 className="text-gb-md font-semibold text-fg">{criterionLabel(signal.criterionId, signal.criterionLabel)}</h3>
                    <Badge variant={signal.alignment === 'strong' ? 'safe-chip' : signal.alignment === 'missing' ? 'reach' : 'neutral-chip'}>{t(signal.alignment)}</Badge>
                  </div>
                  <p className="text-gb-sm text-fg-secondary">{signal.reasoning}</p>
                  {signal.missingEvidence.length > 0 ? <p className="text-gb-xs text-fg-muted">{t('Evidence needed')}: {signal.missingEvidence.join(' · ')}</p> : null}
                  <V2References evidenceIds={signal.applicantEvidenceIds} sourceRefs={signal.criterionSourceRefs} t={t} />
                </Panel>
              ))}
            </section>

            <section className="flex flex-col gap-gb-xl">
              <h2 className="text-gb-display-xs font-semibold text-fg">{t('Positioning Opportunities')}</h2>
              {v2.opportunities.length > 0 ? v2.opportunities.map((opportunity) => (
                <Panel key={opportunity.id} className="flex flex-col gap-gb-xs">
                  <h3 className="text-gb-md font-semibold text-fg">{opportunity.title}</h3>
                  <p className="text-gb-sm text-fg-secondary">{opportunity.recommendedPositioning}</p>
                  <p className="text-gb-xs text-fg-muted">{opportunity.rationale}</p>
                  <V2References evidenceIds={opportunity.evidenceIds} sourceRefs={[]} t={t} />
                </Panel>
              )) : <Panel><p className="text-gb-sm text-fg-muted">{t('No positioning opportunities were recorded.')}</p></Panel>}
            </section>

            {v2.scholarship && (
              <section className="flex flex-col gap-gb-xl">
                <h2 className="text-gb-display-xs font-semibold text-fg">{t('Scholarship Alignment')}</h2>
                {(v2.scholarship.hardRequirements ?? []).map((requirement) => (
                  <Panel key={`scholarship-hard-${requirement.criterionId}`} className="flex flex-col gap-gb-xs">
                    <h3 className="text-gb-md font-semibold text-fg">{criterionLabel(requirement.criterionId, requirement.criterionId)}</h3>
                    <p className="text-gb-sm text-fg-secondary">{requirement.explanation}</p>
                    <V2References evidenceIds={requirement.evidenceIds} sourceRefs={[]} t={t} />
                  </Panel>
                ))}
                {v2.scholarship.criteria.map((signal) => (
                  <Panel key={`scholarship-${signal.criterionId}`} className="flex flex-col gap-gb-xs">
                    <h3 className="text-gb-md font-semibold text-fg">{criterionLabel(signal.criterionId, signal.criterionLabel)}</h3>
                    <p className="text-gb-sm text-fg-secondary">{signal.reasoning}</p>
                    <V2References evidenceIds={signal.applicantEvidenceIds} sourceRefs={signal.criterionSourceRefs} t={t} />
                  </Panel>
                ))}
              </section>
            )}

            <section className="flex flex-col gap-gb-xl">
              <h2 className="text-gb-display-xs font-semibold text-fg">{t('Evidence that improves assessment')}</h2>
              {v2.evidenceNeeded.length > 0 ? v2.evidenceNeeded.map((gap) => (
                <Panel key={`evidence-${gap.id}`} className="flex flex-col gap-gb-xs">
                  <h3 className="text-gb-md font-semibold text-fg">{gap.title}</h3>
                  <p className="text-gb-sm text-fg-secondary">{gap.description}</p>
                  <ul className="list-disc space-y-gb-xs pl-gb-xl text-gb-xs text-fg-tertiary">
                    {(gap.evidenceNeeded.length > 0 ? gap.evidenceNeeded : [t('Add a verified source for this criterion.')]).map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </Panel>
              )) : <Panel><p className="text-gb-sm text-fg-muted">{t('No additional evidence was requested.')}</p></Panel>}
            </section>

          </div>
          <SourcesAside data={data} analysis={analysis} t={t} />
        </div>
      </div>
    );
  }

  const rows = fitRows(fit);

  const gaps = tieredGaps(fit);
  const criteria = eligibilityRows(fit);
  const unchecked = rows.filter((row) => !row.assessed);

  return (
    <div className="flex flex-col gap-gb-4xl" data-no-auto-translate data-report-auto-translate>
      <ReportHeader
        data={data}
        summary={summary}
        busy={busy}
        onGenerate={generate}
        t={t}
      />

      {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}
      {nextAt ? (
        <p className="text-gb-xs text-fg-muted">
          {t('Next free generation')}: {new Date(nextAt).toLocaleString('vi-VN')}
        </p>
      ) : null}

      <SectionNav t={t} />

      <div className="grid gap-gb-3xl lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-gb-4xl">
          <MatchSummarySection summary={summary} rows={rows} t={t} />
          <FitBreakdownSection rows={rows} t={t} />
          <HardCriteriaSection criteria={criteria} data={data} t={t} />
          <GapRiskSection gaps={gaps} t={t} />
          <AdmissionsPerspectiveSection
            summary={summary}
            rows={rows}
            strengths={analysis.strengths}
            unchecked={unchecked}
            limitations={fit.limitations}
            t={t}
          />
          <FinalRecommendationSection data={data} summary={summary} gaps={gaps} t={t} />
        </div>

        <SourcesAside data={data} analysis={analysis} t={t} />
      </div>
    </div>
  );
}

function V2References({
  evidenceIds,
  sourceRefs,
  t,
}: {
  evidenceIds: string[];
  sourceRefs: string[];
  t: Translate;
}) {
  if (evidenceIds.length === 0 && sourceRefs.length === 0) return null;
  return (
    <div className="flex flex-col gap-gb-xxs text-gb-xs text-fg-muted">
      {evidenceIds.length > 0 ? <p>{t('Evidence references')}: {evidenceIds.join(', ')}</p> : null}
      {sourceRefs.length > 0 ? <p>{t('Programme source references')}: {sourceRefs.join(', ')}</p> : null}
    </div>
  );
}

type Translate = ReturnType<typeof useT>;

function ReportHeader({
  data,
  summary,
  busy,
  onGenerate,
  t,
}: {
  data: MatchingReportPageData;
  summary: MatchSummary;
  busy: boolean;
  onGenerate: () => void;
  t: Translate;
}) {
  return (
    <header className="flex flex-col gap-gb-xl rounded-gb-2xl bg-surface-inverse-deep p-gb-3xl text-fg-on-inverse">
      <div className="flex flex-wrap items-start justify-between gap-gb-xl">
        <div className="flex min-w-0 items-center gap-gb-lg">
          <Avatar name={data.universityName} src={data.university?.logoUrl} size="lg" />
          <div className="min-w-0">
            <p className="text-gb-sm text-fg-on-inverse-muted">{data.universityName}</p>
            <h1 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight">
              {data.courseName}
            </h1>
            <p className="text-gb-sm text-fg-on-inverse-secondary">
              {[data.degreeLevel, data.country].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <Badge variant={TONE_BADGE[summary.tone]}>{t(summary.label)}</Badge>
      </div>
      <div className="flex flex-wrap gap-gb-md">
        <Button onClick={onGenerate} disabled={busy} variant="primary-on-dark">
          {busy ? t('Updating…') : t('Update report')}
        </Button>
        <Button href="/ai-strategy" variant="secondary-on-dark">
          {t('Back to AI Strategy')}
        </Button>
      </div>
    </header>
  );
}

/** In-page anchors. Six sections is past the point where a reader can hold the shape in their head. */
function SectionNav({ t }: { t: Translate }) {
  return (
    <nav aria-label={t('Report sections')} className="-mx-gb-lg overflow-x-auto px-gb-lg">
      <ul className="flex min-w-max gap-gb-xs">
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="inline-flex rounded-gb-full bg-surface-muted px-gb-lg py-gb-xs text-gb-xs font-medium text-fg-secondary transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {t(section.label)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SectionHeading({
  id,
  index,
  title,
  blurb,
}: {
  id: string;
  index: number;
  title: string;
  blurb?: string;
}) {
  return (
    <div className="flex flex-col gap-gb-xs">
      <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
        {index}
      </p>
      <h2
        id={id}
        className="scroll-mt-gb-4xl font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg"
      >
        {title}
      </h2>
      {blurb ? <p className="max-w-2xl text-gb-sm text-fg-tertiary">{blurb}</p> : null}
    </div>
  );
}

/**
 * A percentage that may be absent. "Not assessed" and 0% mean opposite things
 * to a student, so an unassessed figure never renders as a number.
 */
function Figure({
  value,
  label,
  t,
}: {
  value: number | null;
  label: string;
  t: Translate;
}) {
  return (
    <div className="flex min-w-[8rem] flex-1 flex-col gap-gb-xxs rounded-gb-xl bg-surface-muted p-gb-lg">
      <dt className="text-gb-xs text-fg-muted">{label}</dt>
      <dd className="font-display text-gb-display-xs font-semibold text-fg">
        {value === null ? (
          <span className="text-gb-md font-medium text-fg-muted">{t('Not assessed')}</span>
        ) : (
          `${value}%`
        )}
      </dd>
    </div>
  );
}

function MatchSummarySection({
  summary,
  rows,
  t,
}: {
  summary: MatchSummary;
  rows: FitRow[];
  t: Translate;
}) {
  // The two or three best-evidenced dimensions, which is what the layout's
  // "strongest alignment" block is. Unassessed rows can never be "strongest".
  const strongest = rows
    .filter((row) => row.assessed && (row.percent ?? 0) >= 50)
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))
    .slice(0, 3);

  return (
    <section className="flex flex-col gap-gb-xl">
      <SectionHeading id="summary" index={1} title={t('Overall match')} />

      <dl className="flex flex-wrap gap-gb-lg">
        <Figure value={summary.matchPercent} label={t('Match score')} t={t} />
        <Figure value={summary.readinessPercent} label={t('Application readiness')} t={t} />
        <Figure value={summary.confidencePercent} label={t('Data confidence')} t={t} />
      </dl>

      <p className="max-w-2xl text-gb-xs text-fg-muted">{t(MATCH_SCORE_DISCLAIMER)}</p>

      <Panel className="flex flex-col gap-gb-md">
        <div className="flex flex-wrap items-center gap-gb-md">
          <Badge variant={TONE_BADGE[summary.tone]}>{t(summary.label)}</Badge>
          {summary.alignment !== 'Not assessed' ? (
            <span className="text-gb-sm text-fg-secondary">
              {t('{level} alignment with this programme', { level: t(summary.alignment) })}
            </span>
          ) : null}
        </div>
        <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">
          {t(summary.meaning)}
        </p>
      </Panel>

      {summary.blockingRequirements.length > 0 ? (
        <Panel className="flex flex-col gap-gb-md border-line-error bg-surface-error">
          <h3 className="text-gb-md font-semibold text-fg-error">
            {t('These requirements are not met yet')}
          </h3>
          <ul className="flex flex-col gap-gb-xs">
            {summary.blockingRequirements.map((row) => (
              <li key={row.key} className="text-gb-sm text-fg-secondary">
                {t(row.label)}
              </li>
            ))}
          </ul>
          <p className="text-gb-xs text-fg-tertiary">
            {t('Fixing these matters more than raising any score below.')}
          </p>
        </Panel>
      ) : null}

      {strongest.length > 0 ? (
        <div className="flex flex-col gap-gb-md">
          <h3 className="text-gb-md font-semibold text-fg">{t('Where you align most')}</h3>
          <div className="grid gap-gb-lg sm:grid-cols-2 lg:grid-cols-3">
            {strongest.map((row) => (
              <Panel key={row.key} className="flex flex-col gap-gb-xs">
                <p className="text-gb-xs text-fg-muted">{t(row.label)}</p>
                <p className="font-display text-gb-xl font-semibold text-fg-brand">
                  {row.percent}%
                </p>
                <p className="text-gb-sm leading-relaxed text-fg-tertiary">{row.summary}</p>
              </Panel>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FitBreakdownSection({ rows, t }: { rows: FitRow[]; t: Translate }) {
  return (
    <section className="flex flex-col gap-gb-xl">
      <SectionHeading
        id="breakdown"
        index={2}
        title={t('Why you match')}
        blurb={t(
          'Five dimensions, scored separately. Only the academic one decides your Reach, Match or Safety band — the rest describe fit without moving it.',
        )}
      />

      <div className="flex flex-col gap-gb-lg">
        {rows.map((row) => (
          <Panel key={row.key} className="flex flex-col gap-gb-md">
            <div className="flex flex-wrap items-baseline justify-between gap-gb-md">
              <h3 className="text-gb-md font-semibold text-fg">{t(row.label)}</h3>
              {row.assessed ? (
                <span className="font-display text-gb-lg font-semibold text-fg-brand">
                  {row.percent}%
                </span>
              ) : (
                <Badge variant="neutral-chip">{t('Not assessed')}</Badge>
              )}
            </div>

            <p className="text-gb-xs text-fg-muted">{t(row.meaning)}</p>

            {row.assessed ? (
              <ProgressBar
                value={row.percent ?? 0}
                label={t('{dimension} alignment', { dimension: t(row.label) })}
              />
            ) : null}

            {row.summary ? (
              <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">
                {row.summary}
              </p>
            ) : null}

            {row.strengths.length > 0 ? (
              <div className="flex flex-col gap-gb-xs">
                <h4 className="text-gb-xs font-semibold text-fg-secondary">
                  {t('What supports this')}
                </h4>
                <CheckList>
                  {row.strengths.map((strength) => (
                    <CheckItem key={strength}>{strength}</CheckItem>
                  ))}
                </CheckList>
              </div>
            ) : null}

            {row.limitation ? (
              <p className="text-gb-xs text-fg-muted">{row.limitation}</p>
            ) : null}
          </Panel>
        ))}
      </div>
    </section>
  );
}

function HardCriteriaSection({
  criteria,
  data,
  t,
}: {
  criteria: ReturnType<typeof eligibilityRows>;
  data: MatchingReportPageData;
  t: Translate;
}) {
  return (
    <section className="flex flex-col gap-gb-xl">
      <SectionHeading
        id="criteria"
        index={3}
        title={t('Entry requirements')}
        blurb={t(
          'Whether you can apply at all, which is a different question from how competitive you are. Anything we could not verify is marked as unchecked rather than assumed either way.',
        )}
      />

      <Panel className="flex flex-col gap-gb-md">
        <ul className="flex flex-col">
          {criteria.map((row) => (
            <li
              key={row.key}
              className="flex flex-wrap items-center justify-between gap-gb-md border-b border-line py-gb-lg last:border-b-0"
            >
              <span className="text-gb-sm font-medium text-fg">{t(row.label)}</span>
              {row.blocking ? (
                <Badge variant="reach">{t(row.statusLabel)}</Badge>
              ) : row.status === 'met' ? (
                <Badge variant="safe-chip">{t(row.statusLabel)}</Badge>
              ) : (
                <span className="text-gb-xs text-fg-muted">{t(row.statusLabel)}</span>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="flex flex-col gap-gb-md">
        <h3 className="text-gb-md font-semibold text-fg">{t('What the course publishes')}</h3>
        <p className="text-gb-sm leading-relaxed text-fg-tertiary">
          {verified(data.course.entryRequirements, t('No verified data'))}
        </p>
        <p className="text-gb-sm leading-relaxed text-fg-tertiary">
          {verified(data.course.englishRequirements, t('No verified data'))}
        </p>
        {data.courseUrl ? (
          <a
            href={data.courseUrl}
            target="_blank"
            rel="noreferrer"
            className="text-gb-sm text-fg-brand hover:underline"
          >
            {t('Check the official course page')}
          </a>
        ) : null}
      </Panel>
    </section>
  );
}

function GapRiskSection({ gaps, t }: { gaps: ReturnType<typeof tieredGaps>; t: Translate }) {
  const critical = gaps.filter((gap) => gap.tier === 'critical');
  const competitive = gaps.filter((gap) => gap.tier === 'competitive');

  return (
    <section className="flex flex-col gap-gb-xl">
      <SectionHeading
        id="gaps"
        index={4}
        title={t('Gaps and risks')}
        blurb={t(
          'Critical gaps sit on the dimensions that carry the most weight and are currently weakest. Competitive gaps are worth closing but are not what is holding this application back.',
        )}
      />

      {gaps.length === 0 ? (
        <Panel>
          <p className="text-gb-sm text-fg-muted">
            {t('We did not find evidence-backed gaps for this programme.')}
          </p>
        </Panel>
      ) : (
        <div className="flex flex-col gap-gb-2xl">
          {critical.length > 0 ? (
            <GapGroup
              title={t('Critical gaps')}
              tone="critical"
              entries={critical}
              t={t}
            />
          ) : null}
          {competitive.length > 0 ? (
            <GapGroup
              title={t('Competitive gaps')}
              tone="competitive"
              entries={competitive}
              t={t}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

function GapGroup({
  title,
  tone,
  entries,
  t,
}: {
  title: string;
  tone: 'critical' | 'competitive';
  entries: ReturnType<typeof tieredGaps>;
  t: Translate;
}) {
  return (
    <div className="flex flex-col gap-gb-md">
      <h3 className="text-gb-md font-semibold text-fg">{title}</h3>
      <div className="flex flex-col gap-gb-md">
        {entries.map((entry) => (
          <Panel
            key={`${entry.dimension}-${entry.text}`}
            className={`flex flex-col gap-gb-xs ${
              tone === 'critical' ? 'border-line-error' : ''
            }`}
          >
            <Badge variant={tone === 'critical' ? 'reach' : 'neutral-chip'}>
              {t(entry.dimension)}
            </Badge>
            <p className="text-gb-sm leading-relaxed text-fg-secondary">{entry.text}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function AdmissionsPerspectiveSection({
  summary,
  rows,
  strengths,
  unchecked,
  limitations,
  t,
}: {
  summary: MatchSummary;
  rows: FitRow[];
  strengths: string[];
  unchecked: FitRow[];
  limitations: string[];
  t: Translate;
}) {
  const strongest = rows
    .filter((row) => row.assessed)
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))[0];

  return (
    <section className="flex flex-col gap-gb-xl">
      <SectionHeading
        id="perspective"
        index={5}
        title={t('How this reads to an admissions reader')}
      />

      <div className="grid gap-gb-lg md:grid-cols-2">
        <Panel className="flex flex-col gap-gb-md">
          <h3 className="text-gb-md font-semibold text-fg">{t('First impression')}</h3>
          <p className="text-gb-sm leading-relaxed text-fg-secondary">{t(summary.meaning)}</p>
          {strongest ? (
            <p className="text-gb-sm leading-relaxed text-fg-tertiary">
              {t('Your strongest dimension here is {dimension}.', {
                dimension: t(strongest.label),
              })}
            </p>
          ) : null}
        </Panel>

        <Panel className="flex flex-col gap-gb-md">
          <h3 className="text-gb-md font-semibold text-fg">
            {t('What strengthens your application')}
          </h3>
          {strengths.length > 0 ? (
            <CheckList>
              {strengths.slice(0, 5).map((strength) => (
                <CheckItem key={strength}>{strength}</CheckItem>
              ))}
            </CheckList>
          ) : (
            <p className="text-gb-sm text-fg-muted">
              {t('No evidence-backed strengths were recorded for this programme yet.')}
            </p>
          )}
        </Panel>
      </div>

      {unchecked.length > 0 || limitations.length > 0 ? (
        <Panel className="flex flex-col gap-gb-md">
          <h3 className="text-gb-md font-semibold text-fg">{t('What we could not check')}</h3>
          <p className="text-gb-xs text-fg-muted">
            {t(
              'These are gaps in our information, not judgements about you. Filling them in makes the report sharper.',
            )}
          </p>
          {unchecked.length > 0 ? (
            <ul className="flex flex-col gap-gb-xs">
              {unchecked.map((row) => (
                <li key={row.key} className="text-gb-sm text-fg-secondary">
                  {t(row.label)}
                </li>
              ))}
            </ul>
          ) : null}
          {limitations.length > 0 ? (
            <ul className="list-disc space-y-gb-xs pl-gb-xl text-gb-xs text-fg-tertiary">
              {limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          ) : null}
        </Panel>
      ) : null}
    </section>
  );
}

function FinalRecommendationSection({
  data,
  summary,
  gaps,
  t,
}: {
  data: MatchingReportPageData;
  summary: MatchSummary;
  gaps: ReturnType<typeof tieredGaps>;
  t: Translate;
}) {
  const firstCritical = gaps.find((gap) => gap.tier === 'critical');

  return (
    <section className="flex flex-col gap-gb-xl">
      <SectionHeading id="next" index={6} title={t('What to do next')} />

      <Panel className="flex flex-col gap-gb-lg">
        <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">{t(summary.meaning)}</p>

        {summary.blockingRequirements.length > 0 ? (
          <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">
            {t(
              'Start with the entry requirements above. Until those are met, improving anything else will not change whether this application can be submitted.',
            )}
          </p>
        ) : firstCritical ? (
          <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">
            {t('Your highest-impact work is on {dimension}.', {
              dimension: t(firstCritical.dimension),
            })}
          </p>
        ) : null}

        <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-tertiary">
          {t(
            'Your Strategy Report turns these findings into a prioritised plan and a set of tasks you can work through.',
          )}
        </p>

        <div className="flex flex-wrap gap-gb-md">
          <Button href={`/ai-strategy/${data.id}/strategy-report`}>
            {t('Open my Strategy Report')}
          </Button>
          <Button href={`/ai-strategy/${data.id}/planner`} variant="secondary">
            {t('Go to my Planner')}
          </Button>
        </div>
      </Panel>
    </section>
  );
}

function SourcesAside({
  data,
  analysis,
  t,
}: {
  data: MatchingReportPageData;
  analysis: NonNullable<MatchingReportPageData['analysis']>;
  t: Translate;
}) {
  return (
    <aside className="h-fit lg:sticky lg:top-gb-3xl">
      <Panel className="flex flex-col gap-gb-lg">
        <h2 className="text-gb-md font-semibold text-fg">{t('Sources and freshness')}</h2>
        <p className="text-gb-xs text-fg-muted">
          {t(
            'Course details are extracted automatically from the university’s own pages. Check the official page before relying on any figure.',
          )}
        </p>
        <dl className="flex flex-col gap-gb-md text-gb-sm">
          <div>
            <dt className="text-fg-muted">{t('Official source')}</dt>
            <dd className="break-words text-fg">
              {data.courseUrl ? (
                <a
                  href={data.courseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-fg-brand hover:underline"
                >
                  {t('Open programme page')}
                </a>
              ) : (
                t('No verified data')
              )}
            </dd>
          </div>
          <div>
            <dt className="text-fg-muted">{t('Source confidence')}</dt>
            <dd className="text-fg">
              {data.course.sourceConfidence === null
                ? t('No verified data')
                : `${Math.round(data.course.sourceConfidence * 100)}%`}
            </dd>
          </div>
          <div>
            <dt className="text-fg-muted">{t('Last extracted')}</dt>
            <dd className="text-fg">
              {data.course.lastExtractedAt
                ? new Date(data.course.lastExtractedAt).toLocaleString('vi-VN')
                : t('No verified data')}
            </dd>
          </div>
          <div>
            <dt className="text-fg-muted">{t('Last analysed')}</dt>
            <dd className="text-fg">{new Date(analysis.createdAt).toLocaleString('vi-VN')}</dd>
          </div>
        </dl>
      </Panel>
    </aside>
  );
}

function V3ReportView({
  data,
  report,
  busy,
  onGenerate,
  error,
  t,
}: {
  data: MatchingReportPageData;
  report: MatchingReportV3;
  busy: boolean;
  onGenerate: () => void;
  error: string | null;
  t: Translate;
}) {
  const evidence = new Map(report.evidenceIndex.map((item) => [item.id, item]));
  const sources = new Map(report.targetSourceIndex.map((item) => [item.ref, item]));
  const statusLabel = (status: string) => status === 'assessed' ? t('Assessed') : status === 'limited' ? t('Limited') : t('Not available');
  const fitBadge = 'neutral-chip';

  return (
    <div className="flex flex-col gap-gb-4xl" data-no-auto-translate data-report-auto-translate>
      <header className="flex flex-col gap-gb-xl rounded-gb-2xl bg-surface-inverse-deep p-gb-3xl text-fg-on-inverse">
        <div className="flex flex-wrap items-start justify-between gap-gb-xl">
          <div className="flex min-w-0 items-center gap-gb-lg">
            <Avatar name={data.universityName} src={data.university?.logoUrl} size="lg" />
            <div className="min-w-0">
              <p className="text-gb-sm text-fg-on-inverse-muted">{data.universityName}</p>
              <h1 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight">{data.courseName}</h1>
              <p className="text-gb-sm text-fg-on-inverse-secondary">{[data.degreeLevel, data.country].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          <Badge variant={fitBadge}>{t('University')} {report.universityFit.score === null ? t('Not assessed') : `${report.universityFit.score}%`} · {t('Programme')} {report.programmeFit.score === null ? t('Not assessed') : `${report.programmeFit.score}%`}</Badge>
        </div>
        <div className="flex flex-wrap gap-gb-md">
          <Button onClick={onGenerate} disabled={busy} variant="primary-on-dark">{busy ? t('Updating…') : t('Update report')}</Button>
          <Button href="/ai-strategy" variant="secondary-on-dark">{t('Back to AI Strategy')}</Button>
        </div>
      </header>
      {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}

      <section className="flex flex-col gap-gb-xl">
        <SectionHeading id="university-fit" index={1} title={t('University Fit')} blurb={t('Alignment with the university’s mission, community, learning environment and named opportunities—not an admissions probability.')} />
        <V3FitPanel fit={report.universityFit} statusLabel={statusLabel} evidence={evidence} sources={sources} t={t} />
      </section>

      <section className="flex flex-col gap-gb-xl">
        <SectionHeading id="programme-fit" index={2} title={t('Programme Fit')} blurb={t('Alignment with the programme’s curriculum, competencies, experience opportunities and future direction.')} />
        <V3FitPanel fit={report.programmeFit} statusLabel={statusLabel} evidence={evidence} sources={sources} t={t} />
        <Panel className="flex flex-col gap-gb-sm">
          <h3 className="text-gb-md font-semibold text-fg">{t('Programme interpretation')}</h3>
          <div className="grid gap-gb-md md:grid-cols-2">
            <div>
              <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('Strongest alignment')}</p>
              <p className="text-gb-sm text-fg-secondary">
                {report.programmeFit.strongestAlignment.length > 0
                  ? report.programmeFit.strongestAlignment.map((id) => t(V3_METRIC_LABELS[id] ?? id)).join(' · ')
                  : t('Not assessed')}
              </p>
            </div>
            <div>
              <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('Potential gap')}</p>
              <p className="text-gb-sm text-fg-secondary">{report.programmeFit.potentialGap ?? t('Not assessed')}</p>
            </div>
          </div>
          <div className="border-t border-line pt-gb-sm">
            <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('Strategic interpretation')}</p>
            <p className="text-gb-sm leading-relaxed text-fg-secondary">{report.programmeFit.strategicInterpretation}</p>
          </div>
        </Panel>
      </section>

      <section className="flex flex-col gap-gb-xl">
        <SectionHeading id="key-takeaways" index={3} title={t('Key Takeaways')} />
        <div className="grid gap-gb-lg md:grid-cols-2">
          {Object.entries(report.keyTakeaways).map(([key, takeaway]) => (
            <Panel key={key} className="flex flex-col gap-gb-sm">
              <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t({
                strongestFit: 'Strongest fit',
                competitiveAdvantage: 'Competitive advantage',
                criticalGap: 'Critical gap',
                strategicDirection: 'Strategic direction',
              }[key as keyof MatchingReportV3['keyTakeaways']] ?? key)}</p>
              <h3 className="text-gb-md font-semibold text-fg">{takeaway.title}</h3>
              <p className="text-gb-sm leading-relaxed text-fg-secondary">{takeaway.body}</p>
              <V3References evidenceIds={takeaway.evidenceIds} targetSourceRefs={takeaway.targetSourceRefs} evidence={evidence} sources={sources} t={t} />
            </Panel>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-gb-xl">
        <SectionHeading id="hard-requirements" index={4} title={t('Hard Requirements')} blurb={t('These statuses are deterministic checks. Unknown means the available evidence could not establish a result.')} />
        {report.hardRequirements.length > 0 ? report.hardRequirements.map((requirement) => (
          <Panel key={requirement.id} className="flex flex-col gap-gb-xs">
            <div className="flex flex-wrap items-center justify-between gap-gb-sm">
              <h3 className="text-gb-md font-semibold text-fg">{requirement.label}</h3>
              <Badge variant={requirement.status === 'met' ? 'safe-chip' : requirement.status === 'not_met' ? 'reach' : 'neutral-chip'}>{t(requirement.status)}</Badge>
            </div>
            <p className="text-gb-sm text-fg-secondary">{requirement.explanation}</p>
            <V3References evidenceIds={requirement.evidenceIds} targetSourceRefs={requirement.targetSourceRefs} evidence={evidence} sources={sources} t={t} />
          </Panel>
        )) : <Panel><p className="text-gb-sm text-fg-muted">{t('No hard requirements were recorded.')}</p></Panel>}
      </section>

      <section className="flex flex-col gap-gb-xl">
        <SectionHeading id="scholarship-alignment" index={5} title={t('Scholarship Alignment')} />
        <Panel><p className="text-gb-sm text-fg-muted">{report.scholarshipAlignment ? t('Scholarship alignment is shown separately from programme fit.') : t('No selected scholarship was available for this application, so scholarship alignment was not assessed.')}</p></Panel>
      </section>

      <aside className="flex flex-col gap-gb-sm rounded-gb-xl border border-line bg-surface-subtle p-gb-lg text-gb-xs text-fg-muted">
        <p>{t('Evidence coverage')}: {report.overall.evidenceCoverage}% · {t('Confidence')}: {Math.round(report.overall.confidence * 100)}%</p>
        <p>{t('Last analysed')}: {new Date(report.generatedAt).toLocaleString('vi-VN')}</p>
        <p>{t('Scores describe alignment with the supplied evidence and target sources. They do not predict admission decisions.')}</p>
      </aside>
    </div>
  );
}

function V3FitPanel({
  fit,
  statusLabel,
  evidence,
  sources,
  t,
}: {
  fit: MatchingReportV3['universityFit'] | MatchingReportV3['programmeFit'];
  statusLabel: (status: string) => string;
  evidence: Map<string, MatchingReportV3['evidenceIndex'][number]>;
  sources: Map<string, MatchingReportV3['targetSourceIndex'][number]>;
  t: Translate;
}) {
  return (
    <div className="flex flex-col gap-gb-lg">
      <Panel className="flex flex-col gap-gb-md">
        <div className="flex flex-wrap items-end justify-between gap-gb-md">
          <div>
            <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{statusLabel(fit.status)}</p>
            <p className="font-display text-gb-display-sm font-semibold text-fg">{fit.score === null ? t('Not assessed') : `${fit.score}%`}</p>
          </div>
          <p className="text-gb-sm text-fg-muted">{t('Coverage')}: {fit.coverage}% · {t('Confidence')}: {Math.round(fit.confidence * 100)}%</p>
        </div>
        {fit.score === null ? <p className="text-gb-xs text-fg-muted">{t('No aggregate score is available until this fit has enough evidence.')}</p> : <ProgressBar value={fit.score} label={t('Alignment score')} />}
        <p className="max-w-3xl text-gb-sm leading-relaxed text-fg-secondary">{fit.summary}</p>
      </Panel>
      <div className="grid gap-gb-lg md:grid-cols-2">
        {Object.values(fit.metrics).map((metric) => (
          <Panel key={metric.id} className="flex flex-col gap-gb-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-gb-sm">
              <h3 className="text-gb-md font-semibold text-fg">{t(V3_METRIC_LABELS[metric.id] ?? metric.id)}</h3>
              <span className="text-gb-sm font-semibold text-fg-brand">{metric.score === null ? t('Not assessed') : `${metric.score}%`}</span>
            </div>
            <p className="text-gb-xs text-fg-muted">{statusLabel(metric.status)} · {t('Coverage')}: {metric.coverage}%</p>
            <p className="text-gb-sm leading-relaxed text-fg-secondary">{metric.summary}</p>
            <div className="flex flex-col gap-gb-sm border-t border-line pt-gb-sm">
              {metric.submetrics.map((submetric) => (
                <div key={submetric.submetricId} className="flex flex-col gap-gb-xxs">
                  <p className="text-gb-xs font-medium text-fg">{t(V3_SUBMETRIC_LABELS[submetric.submetricId] ?? submetric.submetricId)} · {statusLabel(submetric.status)}</p>
                  <p className="text-gb-xs text-fg-muted">{submetric.reasoning}</p>
                  <V3References evidenceIds={submetric.applicantEvidenceIds} targetSourceRefs={submetric.targetSourceRefs} evidence={evidence} sources={sources} t={t} />
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function V3References({
  evidenceIds,
  targetSourceRefs,
  evidence,
  sources,
  t,
}: {
  evidenceIds: string[];
  targetSourceRefs: string[];
  evidence: Map<string, MatchingReportV3['evidenceIndex'][number]>;
  sources: Map<string, MatchingReportV3['targetSourceIndex'][number]>;
  t: Translate;
}) {
  if (evidenceIds.length === 0 && targetSourceRefs.length === 0) return null;
  return (
    <div className="flex flex-col gap-gb-xxs text-gb-xs text-fg-muted">
      {evidenceIds.length > 0 ? <p>{t('Evidence')}: {evidenceIds.map((id) => evidence.get(id)?.label ?? id).join(' · ')}</p> : null}
      {targetSourceRefs.length > 0 ? <p>{t('Target source')}: {targetSourceRefs.map((ref) => sources.get(ref)?.title ?? ref).join(' · ')}</p> : null}
    </div>
  );
}
