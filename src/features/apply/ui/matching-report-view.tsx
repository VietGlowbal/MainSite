'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n';
import { formatUiDateTime } from '@/shared/lib';
import { withReturn } from './personal-report/shared';
import {
  fitScoreToPercent,
  type MatchingReportPageData,
  type ProgrammeFit,
} from '../domain';
import {
  F5_DIMENSION_KEYS,
  F5_DIMENSION_WEIGHTS,
} from '@/shared/evaluation/f5-programme-fit';
import { weightedScore } from '@/shared/evaluation/weighted-score';
import {
  Avatar,
  Badge,
  Button,
  CheckItem,
  CheckList,
  Panel,
  ProgressBar,
} from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

const DIMENSIONS: Array<{
  key: keyof ProgrammeFit['dimensions'];
  label: string;
}> = [
  { key: 'academicCompetitiveness', label: 'Academic competitiveness' },
  { key: 'personaAlignment', label: 'Profile and programme fit' },
  { key: 'financialFeasibility', label: 'Financial feasibility' },
  { key: 'careerDirection', label: 'Career direction' },
  { key: 'applicationReadiness', label: 'Application readiness' },
];

const ELIGIBILITY_LABELS: Array<{ key: keyof ProgrammeFit['eligibility']; label: string }> = [
  { key: 'requiredSubjects', label: 'Required subjects' },
  { key: 'minimumQualification', label: 'Minimum qualification' },
  { key: 'languageRequirement', label: 'Language requirement' },
  { key: 'citizenshipRequirement', label: 'Citizenship requirement' },
  { key: 'deadline', label: 'Deadline' },
];

/**
 * Headline Match Score, computed at render time from the persisted dimension
 * scores using the canonical weights — never stored, never AI-authored, and
 * never an admission probability. A missing dimension drops out and its weight
 * renormalises (same rule as the deterministic engine); with nothing assessed
 * there is no headline number at all.
 */
function overallMatchPercent(fit: ProgrammeFit): number | null {
  const result = weightedScore(
    F5_DIMENSION_KEYS.map((key) => ({
      key,
      weight: F5_DIMENSION_WEIGHTS[key],
      value: fit.dimensions[key].score,
    })),
  );
  return result.score === null ? null : fitScoreToPercent(result.score);
}

function readinessPercent(fit: ProgrammeFit): number | null {
  const score = fit.dimensions.applicationReadiness.score;
  return score === null ? null : fitScoreToPercent(score);
}

function classificationLabel(classification: ProgrammeFit['classification']) {
  if (classification === 'safety') return 'Safety';
  if (classification === 'strong_match') return 'Strong Match';
  if (classification === 'match') return 'Match';
  if (classification === 'reach') return 'Reach';
  if (classification === 'currently_ineligible') return 'Currently ineligible';
  return 'Not enough data to classify';
}

function classificationVariant(classification: ProgrammeFit['classification']) {
  if (classification === 'safety') return 'safe' as const;
  if (classification === 'strong_match') return 'brand-subtle' as const;
  if (classification === 'match') return 'recommend' as const;
  if (classification === 'reach') return 'reach' as const;
  return 'neutral' as const;
}

function verified(value: string | null | undefined, fallback: string) {
  return value || fallback;
}

function eligibilityLabel(status: 'met' | 'not_met' | 'unknown') {
  if (status === 'met') return 'Met';
  if (status === 'not_met') return 'Not met';
  return 'Not verified';
}

export function MatchingReportView({
  data,
  migrationMissing,
}: {
  data: MatchingReportPageData;
  migrationMissing: boolean;
}) {
  const { t, lang } = useLanguage();
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
      if (body.nextRegenerationAt) setNextAt(body.nextRegenerationAt as string);
      if (!response.ok) throw new Error(body.error || t('Could not create Matching Report.'));
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t('Could not create Matching Report.'),
      );
    } finally {
      setBusy(false);
    }
  }

  const analysis = data.analysis;
  if (!analysis) {
    return (
      <div className="flex min-h-[32rem] flex-col items-center justify-center gap-gb-2xl text-center">
        <Avatar name={data.universityName} src={data.university?.logoUrl} size="lg" />
        <div className="flex max-w-2xl flex-col gap-gb-md">
          <Badge variant="brand-subtle">GlowBal Matching Report</Badge>
          <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
            {data.courseName}
          </h1>
          <p className="text-gb-md text-fg-tertiary">{data.universityName}</p>
          <p className="text-gb-sm text-fg-tertiary">
            {t('The report checks entry requirements first, then evaluates academic fit, profile, finances, career direction, and readiness separately.')}
          </p>
        </div>
        {error ? <p className="max-w-xl text-gb-sm text-fg-error">{error}</p> : null}
        <Button size="lg" onClick={generate} disabled={busy || migrationMissing}>
          {busy ? t('Creating report…') : t('Create Matching Report')}
        </Button>
        <Button
          href={withReturn('/profile', `/ai-strategy/${data.id}/matching-report`)}
          variant="secondary"
        >
          {t('Check profile data')}
        </Button>
      </div>
    );
  }

  const fit = analysis.fit;
  const matchPercent = overallMatchPercent(fit);
  const readiness = readinessPercent(fit);
  const narrative = analysis.narrative;
  const allGaps = [
    ...new Set([
      ...analysis.weaknesses,
      ...DIMENSIONS.flatMap(({ key }) => fit.dimensions[key].gaps),
    ]),
  ];

  return (
    <div className="flex flex-col gap-gb-4xl" data-no-auto-translate>
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
          <Badge variant={classificationVariant(fit.classification)}>
            {t(classificationLabel(fit.classification))}
          </Badge>
        </div>
        <div className="grid gap-gb-sm">
          <div className="flex items-center justify-between text-gb-sm">
            <span>{t('Data confidence')}</span>
            <strong>{fit.confidence}%</strong>
          </div>
          <ProgressBar value={fit.confidence} label={t('Matching Report confidence')} />
        </div>
        <div className="flex flex-wrap gap-gb-md">
          <Button onClick={generate} disabled={busy} variant="primary-on-dark">
            {busy ? t('Updating…') : t('Update report')}
          </Button>
          <Button href="/ai-strategy/matching" variant="secondary-on-dark">
            {t('Choose another profile')}
          </Button>
        </div>
      </header>

      {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}
      {nextAt ? (
        <p className="text-gb-xs text-fg-muted">
          {t('Next free generation')}: {formatUiDateTime(nextAt, lang)}
        </p>
      ) : null}

      {/*
        ─── SECTION 1 · OVERALL MATCH SUMMARY ────────────────────────────────
        Three figures per the canonical spec: match score, readiness,
        confidence. The headline number is a weighted MATCH SCORE computed
        from the persisted dimensions at render time — the copy below exists
        so it can never be read as an admission probability.
      */}
      <section aria-labelledby="match-summary-heading" className="flex flex-col gap-gb-lg">
        <h2 id="match-summary-heading" className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
          {t('Overall Match Summary')}
        </h2>
        <Panel className="flex flex-col gap-gb-xl">
          <div className="grid gap-gb-xl sm:grid-cols-3">
            <div className="flex items-center gap-gb-lg rounded-gb-2xl bg-surface-muted p-gb-xl">
              <span className="font-display text-gb-display-md font-semibold text-fg-brand">
                {matchPercent === null ? t('Not assessed') : `${matchPercent}%`}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="text-gb-sm font-semibold text-fg">{t('Match Score')}</span>
                <span className="mt-gb-xxs w-fit">
                  <Badge variant={classificationVariant(fit.classification)}>
                    {t(classificationLabel(fit.classification))}
                  </Badge>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-gb-lg rounded-gb-2xl bg-surface-muted p-gb-xl">
              <span className="font-display text-gb-display-md font-semibold text-fg">
                {readiness === null ? t('Not assessed') : `${readiness}%`}
              </span>
              <span className="text-gb-sm font-semibold text-fg">{t('Application readiness')}</span>
            </div>
            <div className="flex items-center gap-gb-lg rounded-gb-2xl bg-surface-muted p-gb-xl">
              <span className="font-display text-gb-display-md font-semibold text-fg">{fit.confidence}%</span>
              <span className="text-gb-sm font-semibold text-fg">{t('Data confidence')}</span>
            </div>
          </div>
          <p className="text-gb-xs text-fg-muted">
            {t('This score measures how well your profile aligns with this programme. It is not an admission probability or acceptance chance.')}
          </p>

          {analysis.narrative?.fitStatement ? (
            <p className="text-gb-sm leading-relaxed text-fg-tertiary">{analysis.narrative.fitStatement}</p>
          ) : null}

          {analysis.narrative?.topAlignments && analysis.narrative.topAlignments.length > 0 ? (
            <div className="flex flex-col gap-gb-md">
              <h3 className="text-gb-sm font-semibold text-fg">{t('Strongest alignments')}</h3>
              {analysis.narrative.topAlignments.map((alignment) => (
                <div key={alignment.aspect} className="rounded-gb-xl border border-line p-gb-lg">
                  <p className="text-gb-sm font-semibold text-fg">{alignment.aspect}</p>
                  <p className="mt-gb-xxs text-gb-xs text-fg-tertiary">{t('Evidence')}: {alignment.evidence}</p>
                  <p className="mt-gb-xxs text-gb-xs text-fg-tertiary">{t('What it means')}: {alignment.interpretation}</p>
                </div>
              ))}
            </div>
          ) : null}
        </Panel>
      </section>

      {fit.limitations.length > 0 ? (
        <Panel className="flex flex-col gap-gb-md">
          <h2 className="text-gb-md font-semibold text-fg">{t('Report limitations')}</h2>
          <ul className="list-disc space-y-gb-sm pl-gb-xl text-gb-sm text-fg-tertiary">
            {fit.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {/*
        ─── SECTION 2 · FIT BREAKDOWN & WHY YOU MATCH ───────────────────────
        One row per scored dimension, then the honest per-dimension detail:
        what we assessed, the evidence behind it, and where the gaps are.
        A dimension that was not assessed says so instead of showing 0%.
      */}
      <section aria-labelledby="fit-breakdown-heading" className="flex flex-col gap-gb-lg">
        <h2 id="fit-breakdown-heading" className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
          {t('Fit breakdown and why you match')}
        </h2>
        <div className="flex flex-col gap-gb-lg">
          {DIMENSIONS.map(({ key, label }) => {
            const dimension = fit.dimensions[key];
            const percent = dimension.score === null ? null : fitScoreToPercent(dimension.score);
            return (
              <Panel key={key} className="flex flex-col gap-gb-lg">
                <div className="flex items-center justify-between gap-gb-md">
                  <h3 className="text-gb-md font-semibold text-fg">{label}</h3>
                  <span className="text-gb-sm font-semibold text-fg-brand">
                    {percent === null
                      ? t('Not assessed')
                      : `${Number(dimension.score).toFixed(1)}/5 · ${percent}%`}
                  </span>
                </div>

                <dl className="grid gap-gb-md md:grid-cols-3">
                  <div className="rounded-gb-xl bg-surface-muted p-gb-md">
                    <dt className="text-gb-xs font-medium text-fg-muted">{t('Assessment')}</dt>
                    <dd className="mt-gb-xxs text-gb-sm leading-relaxed text-fg-tertiary">{dimension.summary}</dd>
                  </div>
                  <div className="rounded-gb-xl bg-surface-muted p-gb-md">
                    <dt className="text-gb-xs font-medium text-fg-muted">{t('Evidence')}</dt>
                    <dd className="mt-gb-xxs text-gb-sm leading-relaxed text-fg-tertiary">
                      {dimension.evidence.length > 0 ? (
                        <ul className="list-disc space-y-gb-xxs pl-gb-md">
                          {dimension.evidence.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        t('No specific evidence recorded')
                      )}
                    </dd>
                  </div>
                  <div className="rounded-gb-xl bg-surface-muted p-gb-md">
                    <dt className="text-gb-xs font-medium text-fg-muted">{t('Strengths')}</dt>
                    <dd className="mt-gb-xxs text-gb-sm leading-relaxed text-fg-tertiary">
                      {dimension.strengths.length > 0 ? (
                        <ul className="list-disc space-y-gb-xxs pl-gb-md">
                          {dimension.strengths.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        t('No specific evidence recorded')
                      )}
                    </dd>
                  </div>
                </dl>

                {dimension.gaps.length > 0 || dimension.limitation ? (
                  <div className="flex flex-col gap-gb-xxs rounded-gb-xl border border-line p-gb-md">
                    <span className="text-gb-xs font-medium text-fg-muted">{t('Gaps')}</span>
                    {dimension.gaps.length > 0 ? (
                      <ul className="list-disc space-y-gb-xxs pl-gb-md text-gb-sm text-fg-tertiary">
                        {dimension.gaps.map((gap) => (
                          <li key={gap}>{gap}</li>
                        ))}
                      </ul>
                    ) : null}
                    {dimension.limitation ? (
                      <p className="text-gb-xs text-fg-muted">{dimension.limitation}</p>
                    ) : null}
                  </div>
                ) : null}
              </Panel>
            );
          })}
        </div>
      </section>

      {/*
        ─── SECTION 3 · HARD CRITERIA ASSESSMENT ─────────────────────────────
        The five canonical gates straight off `fit.eligibility`. A failed gate
        is why the report reads `currently_ineligible`; an unknown gate is
        reported as unverified rather than guessed.
      */}
      <section aria-labelledby="hard-criteria-heading" className="flex flex-col gap-gb-lg">
        <h2 id="hard-criteria-heading" className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
          {t('Hard criteria assessment')}
        </h2>
        <Panel className="flex flex-col gap-gb-lg">
          <div className="grid gap-gb-md sm:grid-cols-2">
            {ELIGIBILITY_LABELS.map(({ key, label }) => {
              const status = fit.eligibility[key];
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-gb-md rounded-gb-xl bg-surface-muted p-gb-lg"
                >
                  <span className="text-gb-sm text-fg-tertiary">{t(label)}</span>
                  <Badge variant={status === 'met' ? 'safe' : status === 'not_met' ? 'reach' : 'neutral'}>
                    {t(eligibilityLabel(status))}
                  </Badge>
                </div>
              );
            })}
          </div>
          <p className="text-gb-xs text-fg-muted">
            {t('A failed requirement makes the application currently ineligible regardless of every other score.')}
          </p>
        </Panel>
      </section>

      {/* ─── SECTION 4 · GAP & RISK ANALYSIS ──────────────────────────────── */}
      <section aria-labelledby="gap-risk-heading" className="flex flex-col gap-gb-lg">
        <h2 id="gap-risk-heading" className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
          {t('Gap and risk analysis')}
        </h2>
        <Panel className="flex flex-col gap-gb-xl">
          {narrative?.criticalGaps && narrative.criticalGaps.length > 0 ? (
            <div className="flex flex-col gap-gb-lg">
              <h3 className="text-gb-sm font-semibold text-fg">{t('Critical gaps')}</h3>
              {narrative.criticalGaps.map((criticalGap) => (
                <div key={criticalGap.gap} className="flex flex-col gap-gb-sm rounded-gb-xl border border-line p-gb-lg">
                  <div className="flex items-center justify-between gap-gb-md">
                    <p className="text-gb-sm font-semibold text-fg">{criticalGap.gap}</p>
                    <span
                      aria-label={t('Impact level {level} of 5', { level: criticalGap.impactLevel })}
                      className="text-gb-xs text-fg-brand"
                    >
                      {'★'.repeat(criticalGap.impactLevel)}
                      {'☆'.repeat(5 - criticalGap.impactLevel)}
                    </span>
                  </div>
                  <p className="text-gb-xs text-fg-tertiary">{t('Evidence')}: {criticalGap.evidence}</p>
                  <p className="text-gb-xs text-fg-tertiary">{t('Why it matters')}: {criticalGap.whyItMatters}</p>
                  <p className="text-gb-xs text-fg-tertiary">{t('Suggested direction')}: {criticalGap.suggestedDirection}</p>
                </div>
              ))}
            </div>
          ) : null}

          {allGaps.length > 0 ? (
            <div className="flex flex-col gap-gb-md">
              <h3 className="text-gb-sm font-semibold text-fg">{t('Other evidence-backed gaps')}</h3>
              <ul className="list-disc space-y-gb-sm pl-gb-xl text-gb-sm text-fg-tertiary">
                {allGaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {narrative?.competitiveGaps && narrative.competitiveGaps.length > 0 ? (
            <div className="flex flex-col gap-gb-md">
              <h3 className="text-gb-sm font-semibold text-fg">{t('Competitive gaps')}</h3>
              <ul className="list-disc space-y-gb-sm pl-gb-xl text-gb-sm text-fg-tertiary">
                {narrative.competitiveGaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {narrative?.hiddenRisks && narrative.hiddenRisks.length > 0 ? (
            <div className="flex flex-col gap-gb-md">
              <h3 className="text-gb-sm font-semibold text-fg">{t('Hidden risks')}</h3>
              <ul className="list-disc space-y-gb-sm pl-gb-xl text-gb-sm text-fg-tertiary">
                {narrative.hiddenRisks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {!narrative?.criticalGaps?.length &&
          allGaps.length === 0 &&
          !narrative?.competitiveGaps?.length &&
          !narrative?.hiddenRisks?.length ? (
            <p className="text-gb-sm text-fg-muted">
              {t('AI did not identify any evidence-backed gaps.')}
            </p>
          ) : null}
        </Panel>
      </section>

      {/* ─── SECTION 5 · ADMISSIONS PERSPECTIVE ───────────────────────────── */}
      {narrative?.admissionsPerspective ? (
        <section aria-labelledby="admissions-perspective-heading" className="flex flex-col gap-gb-lg">
          <h2
            id="admissions-perspective-heading"
            className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg"
          >
            {t('Admissions perspective')}
          </h2>
          <Panel className="grid gap-gb-xl md:grid-cols-2">
            <div className="flex flex-col gap-gb-sm rounded-gb-xl bg-surface-muted p-gb-lg">
              <h3 className="text-gb-sm font-semibold text-fg">{t('First impression')}</h3>
              <p className="text-gb-sm leading-relaxed text-fg-tertiary">
                {narrative.admissionsPerspective.firstImpression}
              </p>
            </div>
            <div className="flex flex-col gap-gb-sm rounded-gb-xl bg-surface-muted p-gb-lg">
              <h3 className="text-gb-sm font-semibold text-fg">{t('What strengthens your application')}</h3>
              {narrative.admissionsPerspective.strengthens.length > 0 ? (
                <CheckList>
                  {narrative.admissionsPerspective.strengthens.map((item) => (
                    <CheckItem key={item}>{item}</CheckItem>
                  ))}
                </CheckList>
              ) : (
                <p className="text-gb-sm text-fg-muted">{t('No specific evidence recorded')}</p>
              )}
            </div>
            <div className="flex flex-col gap-gb-sm rounded-gb-xl bg-surface-muted p-gb-lg">
              <h3 className="text-gb-sm font-semibold text-fg">{t('Questions we still have')}</h3>
              {narrative.admissionsPerspective.questions.length > 0 ? (
                <ul className="list-disc space-y-gb-sm pl-gb-md text-gb-sm text-fg-tertiary">
                  {narrative.admissionsPerspective.questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gb-sm text-fg-muted">{t('No specific evidence recorded')}</p>
              )}
            </div>
            <div className="flex flex-col gap-gb-sm rounded-gb-xl bg-surface-muted p-gb-lg">
              <h3 className="text-gb-sm font-semibold text-fg">{t('What we would like to see')}</h3>
              {narrative.admissionsPerspective.desiredAdditions.length > 0 ? (
                <ul className="list-disc space-y-gb-sm pl-gb-md text-gb-sm text-fg-tertiary">
                  {narrative.admissionsPerspective.desiredAdditions.map((addition) => (
                    <li key={addition}>{addition}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gb-sm text-fg-muted">{t('No specific evidence recorded')}</p>
              )}
            </div>
          </Panel>
        </section>
      ) : null}

      {/* ─── SECTION 6 · FINAL RECOMMENDATION ─────────────────────────────── */}
      <section aria-labelledby="final-recommendation-heading" className="flex flex-col gap-gb-lg">
        <h2
          id="final-recommendation-heading"
          className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg"
        >
          {t('Final recommendation')}
        </h2>
        <Panel className="flex flex-col gap-gb-xl">
          {narrative?.finalRecommendation ? (
            <>
              <p className="text-gb-sm leading-relaxed text-fg-tertiary">
                {narrative.finalRecommendation.conclusion}
              </p>
              <dl className="grid gap-gb-md sm:grid-cols-2">
                <div className="rounded-gb-xl bg-surface-muted p-gb-lg">
                  <dt className="text-gb-xs font-medium text-fg-muted">{t('Biggest strength')}</dt>
                  <dd className="mt-gb-xxs text-gb-sm text-fg">{narrative.finalRecommendation.biggestStrength}</dd>
                </div>
                <div className="rounded-gb-xl bg-surface-muted p-gb-lg">
                  <dt className="text-gb-xs font-medium text-fg-muted">{t('Biggest opportunity')}</dt>
                  <dd className="mt-gb-xxs text-gb-sm text-fg">{narrative.finalRecommendation.biggestOpportunity}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="text-gb-sm text-fg-tertiary">
              {t('Regenerate the report with a complete profile for a personalised recommendation.')}
            </p>
          )}
          <Button href={`/ai-strategy/${data.id}/strategy-report`} variant="primary" size="lg" className="w-fit">
            {t('Continue to the Strategy Report')}
          </Button>
        </Panel>
      </section>

      <div className="grid gap-gb-2xl lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-gb-2xl">
          <Panel className="flex flex-col gap-gb-lg">
            <h2 className="text-gb-lg font-semibold text-fg">{t('Why this university?')}</h2>
            <p className="text-gb-sm leading-relaxed text-fg-tertiary">
            {verified(data.university?.insight || data.university?.bestFor, t('No verified data'))}
            </p>
            {analysis.strengths.length > 0 ? (
              <CheckList>
                {analysis.strengths.slice(0, 4).map((strength) => (
                  <CheckItem key={strength}>{strength}</CheckItem>
                ))}
              </CheckList>
            ) : null}
          </Panel>

          <Panel className="flex flex-col gap-gb-lg">
            <h2 className="text-gb-lg font-semibold text-fg">{t('Programme overview')}</h2>
            <p className="text-gb-sm leading-relaxed text-fg-tertiary">
              {verified(data.course.summary, t('No verified data'))}
            </p>
            <dl className="grid gap-gb-md sm:grid-cols-2">
              {([
                ['Study level', data.degreeLevel],
                ['Duration', data.course.duration],
                ['Study mode', data.studyMode],
                ['Intake', data.intake],
              ] as Array<[string, string | null | undefined]>).map(([label, value]) => (
                <div key={label} className="rounded-gb-xl bg-surface-muted p-gb-lg">
                  <dt className="text-gb-xs text-fg-muted">{t(label)}</dt>
                  <dd className="text-gb-sm font-medium text-fg">{verified(value, t('No verified data'))}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel className="flex flex-col gap-gb-lg">
            <h2 className="text-gb-lg font-semibold text-fg">{t('Admission requirements')}</h2>
            <p className="text-gb-sm text-fg-tertiary">
              {verified(data.course.entryRequirements, t('No verified data'))}
            </p>
            <p className="text-gb-sm text-fg-tertiary">
              {verified(data.course.englishRequirements, t('No verified data'))}
            </p>
          </Panel>

          <Panel className="flex flex-col gap-gb-lg">
            <h2 className="text-gb-lg font-semibold text-fg">{t('Costs and scholarships')}</h2>
            <p className="text-gb-sm text-fg-tertiary">
              {t('Tuition')}: {verified(data.course.tuition || data.university?.tuition, t('No verified data'))}
            </p>
            <p className="text-gb-sm text-fg-tertiary">
              {t('Living costs')}: {verified(data.university?.livingCost, t('No verified data'))}
            </p>
            {data.scholarships.length > 0 ? (
              <div className="flex flex-col gap-gb-md">
                {data.scholarships.map((scholarship) => (
                  <div key={scholarship.id} className="rounded-gb-xl border border-line p-gb-lg">
                    <p className="text-gb-sm font-semibold text-fg">{scholarship.name}</p>
                    <p className="text-gb-xs text-fg-tertiary">
                      {verified(scholarship.coverage, t('No verified data'))}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gb-sm text-fg-muted">
                {verified(data.university?.scholarship, t('No verified data'))}
              </p>
            )}
          </Panel>
        </div>

        <aside className="h-fit lg:sticky lg:top-gb-3xl">
          <Panel className="flex flex-col gap-gb-lg">
            <h2 className="text-gb-md font-semibold text-fg">{t('Sources and freshness')}</h2>
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
                    verified(null, t('No verified data'))
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-fg-muted">{t('Source confidence')}</dt>
                <dd className="text-fg">
                  {data.course.sourceConfidence === null
                    ? verified(null, t('No verified data'))
                    : `${Math.round(data.course.sourceConfidence * 100)}%`}
                </dd>
              </div>
              <div>
                <dt className="text-fg-muted">{t('Last extracted')}</dt>
                <dd className="text-fg">
                  {data.course.lastExtractedAt
                    ? formatUiDateTime(data.course.lastExtractedAt, lang)
                    : verified(null, t('No verified data'))}
                </dd>
              </div>
              <div>
                <dt className="text-fg-muted">{t('Last analysed')}</dt>
                <dd className="text-fg">
                  {formatUiDateTime(analysis.createdAt, lang)}
                </dd>
              </div>
            </dl>
            <Button href="/ai-strategy" variant="secondary">
              {t('Back to AI Strategy')}
            </Button>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
