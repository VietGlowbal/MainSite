'use client';

import { getV2Sections } from '../domain';
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
import { RequirementStatusTrack, GapImpactRanking } from './matching-report';
import type { EligibilityRow, GapEntry } from '../domain';

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

  const fit = analysis.fit;
  const summary = matchSummary(fit);
  
  if (analysis.reportV2) {
    const v2 = getV2Sections(analysis.reportV2);
    
    return (
      <div className="flex flex-col gap-gb-4xl" data-no-auto-translate>
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
              <h2 className="text-gb-display-xs font-semibold text-fg">Critical Requirements</h2>
              <RequirementStatusTrack
                criteria={v2.criticalRequirements.map((r): EligibilityRow => ({
                  key: r.criterionId,
                  label: r.criterionId,
                  status: r.status === 'meets' ? 'met' : r.status === 'does_not_meet' ? 'not_met' : 'unknown',
                  statusLabel:
                    r.status === 'meets' ? 'Met' : r.status === 'does_not_meet' ? 'Not met' : 'We could not check this',
                  blocking: r.status === 'does_not_meet',
                }))}
              />
            </section>
            
            <section className="flex flex-col gap-gb-xl">
              <h2 className="text-gb-display-xs font-semibold text-fg">Strongest Alignment Areas</h2>
              {v2.strengths.map(s => <div key={s.id}>{s.title}</div>)}
            </section>
            
            <section className="flex flex-col gap-gb-xl">
              <h2 className="text-gb-display-xs font-semibold text-fg">Important Gaps</h2>
              <GapImpactRanking
                gaps={v2.gaps.map((g): GapEntry => ({
                  tier: g.severity === 'critical' || g.severity === 'high' ? 'critical' : 'competitive',
                  dimension: g.type,
                  text: g.description,
                }))}
              />
            </section>

            <section className="flex flex-col gap-gb-xl">
              <h2 className="text-gb-display-xs font-semibold text-fg">Programme Criteria Breakdown</h2>
              {v2.criteriaBreakdown.map(c => <div key={c.criterionId}>{c.criterionLabel}</div>)}
            </section>

            <section className="flex flex-col gap-gb-xl">
              <h2 className="text-gb-display-xs font-semibold text-fg">Positioning Opportunities</h2>
              {v2.opportunities.map(o => <div key={o.id}>{o.title}</div>)}
            </section>

            {v2.scholarship && (
              <section className="flex flex-col gap-gb-xl">
                <h2 className="text-gb-display-xs font-semibold text-fg">Scholarship Alignment</h2>
                {v2.scholarship.criteria.map(c => <div key={c.criterionId}>{c.criterionLabel}</div>)}
              </section>
            )}

            <section className="flex flex-col gap-gb-xl">
              <h2 className="text-gb-display-xs font-semibold text-fg">Evidence That Would Improve This Assessment</h2>
              {v2.evidenceNeeded.map(g => <div key={g.id}>{g.title}</div>)}
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
    <div className="flex flex-col gap-gb-4xl" data-no-auto-translate>
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

