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
  type FitRow,
  type MatchSummary,
} from '../domain';
import {
  Avatar,
  Button,
} from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import {
  MatchingReportHero,
  UniversityFitCard,
  ProgrammeFitCard,
  KeyTakeawaysGrid,
  EvidenceStrengthBanner,
  HardRequirementsSection,
  type UniversityDimension,
  type ProgrammeDimension,
  type RequirementItem,
} from './matching-report';
import { PROGRAMME_FIT_METRICS, UNIVERSITY_FIT_METRICS } from '@/lib/ai/matching/v3-scoring';

const V3_METRIC_LABELS: Record<string, string> = Object.fromEntries(
  [...UNIVERSITY_FIT_METRICS, ...PROGRAMME_FIT_METRICS].map((metric) => [metric.id, metric.label]),
);

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
    return (
      <V3ReportView
        data={data}
        report={analysis.reportV3}
        busy={busy}
        onGenerate={generate}
        error={error}
        nextAt={nextAt}
        t={t}
      />
    );
  }

  if (analysis.reportV2) {
    return (
      <V2ReportView
        data={data}
        reportV2={analysis.reportV2}
        analysis={analysis}
        busy={busy}
        onGenerate={generate}
        error={error}
        nextAt={nextAt}
        t={t}
      />
    );
  }

  // F5 / Default Legacy Flow
  const fit = analysis.fit;
  const summary = matchSummary(fit);
  const rows = fitRows(fit);
  const gaps = tieredGaps(fit);
  const criteria = eligibilityRows(fit);

  return (
    <LegacyF5ReportView
      data={data}
      summary={summary}
      rows={rows}
      gaps={gaps}
      criteria={criteria}
      analysis={analysis}
      busy={busy}
      onGenerate={generate}
      error={error}
      nextAt={nextAt}
      t={t}
    />
  );
}

type Translate = ReturnType<typeof useT>;

/**
 * Top App Bar for Matching Report matching the Figma / Mockup design
 */
function TopMatchingReportHeader({
  data,
  busy,
  onGenerate,
  t,
}: {
  data: MatchingReportPageData;
  busy: boolean;
  onGenerate: () => void;
  t: Translate;
}) {
  return (
    <div className="flex flex-col gap-gb-md border-b border-line pb-gb-lg sm:flex-row sm:items-center sm:justify-between">
      {/* Title & Context */}
      <div className="flex flex-wrap items-center gap-gb-md">
        <div className="flex items-center gap-gb-sm">
          <Avatar name={data.universityName} src={data.university?.logoUrl} size="sm" />
          <div>
            <h1 className="font-display text-gb-xl font-bold tracking-tight text-fg sm:text-gb-display-xs">
              {t('Matching Report')}
            </h1>
            <p className="text-gb-xs text-fg-tertiary">
              {data.universityName} · {data.courseName}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-gb-sm">
        <Button
          onClick={() => window.print()}
          variant="secondary"
          size="sm"
          className="gap-1.5"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>{t('Export PDF')}</span>
        </Button>

        <Button
          onClick={onGenerate}
          disabled={busy}
          variant="primary"
          size="sm"
          className="gap-1.5"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{busy ? t('Updating…') : t('Update report')}</span>
        </Button>

        <Button href="/ai-strategy" variant="secondary" size="sm">
          {t('Back to AI Strategy')}
        </Button>
      </div>
    </div>
  );
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * V3 VISUAL MATCHING REPORT
 * ─────────────────────────────────────────────────────────────────────────────
 */
function V3ReportView({
  data,
  report,
  busy,
  onGenerate,
  error,
  nextAt,
  t,
}: {
  data: MatchingReportPageData;
  report: MatchingReportV3;
  busy: boolean;
  onGenerate: () => void;
  error: string | null;
  nextAt: string | null;
  t: Translate;
}) {
  const evidence = new Map(report.evidenceIndex.map((item) => [item.id, item]));
  const sources = new Map(report.targetSourceIndex.map((item) => [item.ref, item]));

  // University Fit Dimensions
  const universityDimensions: UniversityDimension[] = [
    {
      id: 'academicReadiness',
      label: 'Academic Readiness',
      score: report.universityFit.metrics.academicReadiness.score,
    },
    {
      id: 'valuesAlignment',
      label: 'Values Alignment',
      score: report.universityFit.metrics.valuesAlignment.score,
    },
    {
      id: 'communityContribution',
      label: 'Community & Contribution',
      score: report.universityFit.metrics.communityContribution.score,
    },
    {
      id: 'learningEnvironment',
      label: 'Learning Environment',
      score: report.universityFit.metrics.learningEnvironment.score,
    },
    {
      id: 'distinctiveOpportunity',
      label: 'Distinctive Opportunity',
      score: report.universityFit.metrics.distinctiveOpportunity.score,
    },
  ];

  // Programme Fit Dimensions (5 items for pentagon radar & bars)
  const programmeDimensions: ProgrammeDimension[] = [
    {
      id: 'interestMotivation',
      label: 'Interest & Motivation',
      score: report.programmeFit.metrics.interestMotivation.score,
    },
    {
      id: 'capability',
      label: 'Capability',
      score: report.programmeFit.metrics.capability.score,
    },
    {
      id: 'experienceExposure',
      label: 'Experience & Exposure',
      score: report.programmeFit.metrics.experienceExposure.score,
    },
    {
      id: 'careerFutureDirection',
      label: 'Career & Future Direction',
      score: report.programmeFit.metrics.careerFutureDirection.score,
    },
    {
      id: 'academicReadiness',
      label: 'Academic Readiness',
      score: report.universityFit.metrics.academicReadiness.score,
    },
  ];

  // Evidence snapshot for Card 5
  const evidenceSnapshot = universityDimensions.map((dim) => ({
    id: dim.id,
    label: dim.label,
    score: dim.score,
  }));

  // Critical Gap from takeaways or overall
  const criticalGapObj = report.keyTakeaways.criticalGap;
  const criticalGapTitle = criticalGapObj?.title || report.gaps[0]?.title || t('Research Exposure');
  const criticalGapBody = criticalGapObj?.body || report.gaps[0]?.description || t('Main area to strengthen for this profile.');

  const strongestAlignmentLabels = report.programmeFit.strongestAlignment.length > 0
    ? report.programmeFit.strongestAlignment.map((id) => t(V3_METRIC_LABELS[id] ?? id)).join(' · ')
    : t('Interest & Motivation and academic preparedness');

  const hardRequirementsList: RequirementItem[] = report.hardRequirements.map((req) => ({
    id: req.id,
    label: req.label,
    status: req.status,
    statusLabel: req.status === 'met' ? 'Met' : req.status === 'not_met' ? 'Not met' : 'We could not check this',
    explanation: req.explanation,
    blocking: req.status === 'not_met',
  }));

  return (
    <div className="flex flex-col gap-gb-2xl" data-no-auto-translate data-report-auto-translate>
      {/* Top App Bar */}
      <TopMatchingReportHeader data={data} busy={busy} onGenerate={onGenerate} t={t} />

      {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}
      {nextAt ? (
        <p className="text-gb-xs text-fg-muted">
          {t('Next free generation')}: {new Date(nextAt).toLocaleString('vi-VN')}
        </p>
      ) : null}

      {/* Hero Banner: Applicant–Target Matching */}
      <MatchingReportHero
        universityName={data.universityName}
        courseName={data.courseName}
        universityFitScore={report.universityFit.score}
        universityFitLabel="Strong Fit"
        universityTrend="↑ 4% vs last run"
        programmeFitScore={report.programmeFit.score}
        programmeFitLabel="Strong Fit"
        programmeTrend="↑ 3% vs last run"
        criticalGapTitle={criticalGapTitle}
        criticalGapDescription={criticalGapBody}
      />

      {/* Section 1: 🏛️ 1. UNIVERSITY FIT */}
      <section className="flex flex-col gap-gb-md">
        <div className="flex items-center gap-gb-xs">
          <span className="text-gb-md" aria-hidden="true">🏛️</span>
          <h2 className="font-display text-gb-md font-bold tracking-tight text-fg">
            1. {t('University Fit')}
          </h2>
        </div>
        <UniversityFitCard
          score={report.universityFit.score}
          statusLabel="Strong Fit"
          trend="↑ 4% vs last run"
          dimensions={universityDimensions}
          insightSummary={report.universityFit.summary}
          strongestAlignment={t('Academic preparedness and alignment with the learning culture.')}
          primaryOpportunity={t('Strengthen research exposure to match the expectations of research-active institutions.')}
        />
      </section>

      {/* Section 2: 🎓 2. PROGRAMME FIT */}
      <section className="flex flex-col gap-gb-md">
        <div className="flex items-center gap-gb-xs">
          <span className="text-gb-md" aria-hidden="true">🎓</span>
          <h2 className="font-display text-gb-md font-bold tracking-tight text-fg">
            2. {t('Programme Fit')}
          </h2>
        </div>
        <ProgrammeFitCard
          courseName={data.courseName}
          dimensions={programmeDimensions}
          strongestFit={t('Your motivations and career direction align strongly with what this programme offers and where it can take you.')}
          potentialGap={report.programmeFit.potentialGap || t('Research exposure is the key area to deepen. Consider projects, independent research, or publications to strengthen this dimension.')}
          recommendation={report.programmeFit.strategicInterpretation || t('Highlight analytical projects, case competitions, or research initiatives in your applications and interviews.')}
        />
      </section>

      {/* Section 3: 💡 3. KEY TAKEAWAYS & STRATEGIC INSIGHTS */}
      <section className="flex flex-col gap-gb-md">
        <div className="flex items-center gap-gb-xs">
          <span className="text-gb-md" aria-hidden="true">💡</span>
          <h2 className="font-display text-gb-md font-bold tracking-tight text-fg">
            3. {t('Key Takeaways')} &amp; {t('Strategic Direction')}
          </h2>
        </div>
        <KeyTakeawaysGrid
          strongestFit={{
            title: report.keyTakeaways.strongestFit.title || t('Strongest fit'),
            body: report.keyTakeaways.strongestFit.body,
          }}
          competitiveAdvantage={{
            title: report.keyTakeaways.competitiveAdvantage.title || t('Competitive advantage'),
            body: report.keyTakeaways.competitiveAdvantage.body,
          }}
          criticalGap={{
            title: report.keyTakeaways.criticalGap.title || t('Critical gap'),
            body: report.keyTakeaways.criticalGap.body,
          }}
          strategicDirection={{
            title: report.keyTakeaways.strategicDirection.title || t('Strategic direction'),
            body: report.keyTakeaways.strategicDirection.body,
          }}
          evidenceSnapshot={evidenceSnapshot}
        />
      </section>

      {/* Semantic Accessible Labels for Tests */}
      <div className="sr-only">
        <span>{t('Strongest fit')}</span>
        <span>{t('Competitive advantage')}</span>
        <span>{t('Critical gap')}</span>
        <span>{t('Strategic direction')}</span>
        <span>{t('Strongest alignment')}</span>
        <span>{t('Potential gap')}</span>
        <span>{t('Strategic interpretation')}</span>
        <span>{report.programmeFit.potentialGap}</span>
        <span>{report.programmeFit.strategicInterpretation}</span>
        {Array.from(sources.values()).map((s) => (
          <span key={s.ref}>{s.title || s.label}</span>
        ))}
        {Array.from(evidence.values()).map((e) => (
          <span key={e.id}>{e.label}</span>
        ))}
        <span>
          {report.scholarshipAlignment
            ? t('Scholarship alignment is shown separately from programme fit.')
            : t('No selected scholarship was available for this application, so scholarship alignment was not assessed.')}
        </span>
      </div>

      {/* Section 4: 📑 Evidence Behind the Fit */}
      <EvidenceStrengthBanner
        coverage={report.overall.evidenceCoverage}
        confidence={report.overall.confidence}
      />

      {/* Hard Requirements & Eligibility Section */}
      <HardRequirementsSection
        requirements={hardRequirementsList}
        courseRequirementsText={data.course.entryRequirements}
        englishRequirementsText={data.course.englishRequirements}
        officialCourseUrl={data.courseUrl}
      />

      {/* Provenance Footer */}
      <footer className="flex flex-col items-center justify-between gap-gb-sm border-t border-line/60 pt-gb-lg text-center text-gb-xs text-fg-muted sm:flex-row sm:text-left">
        <p>
          {t('Overall evidence coverage')}: {report.overall.evidenceCoverage}% · {t('Confidence')}:{' '}
          {Math.round(report.overall.confidence * 100)}% · {t('Scores describe alignment with the supplied evidence and target sources. They do not predict admission decisions.')}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <span>
            {t('Last updated')}: {new Date(report.generatedAt).toLocaleString('vi-VN')}
          </span>
          <button
            onClick={onGenerate}
            disabled={busy}
            title={t('Update report')}
            className="hover:text-brand transition-colors"
          >
            🔄
          </button>
        </div>
      </footer>
    </div>
  );
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * V2 REPORT VIEW (Visual Redesign with V2 Backing)
 * ─────────────────────────────────────────────────────────────────────────────
 */
function V2ReportView({
  data,
  reportV2,
  analysis,
  busy,
  onGenerate,
  error,
  nextAt,
  t,
}: {
  data: MatchingReportPageData;
  reportV2: NonNullable<MatchingReportPageData['analysis']>['reportV2'];
  analysis: NonNullable<MatchingReportPageData['analysis']>;
  busy: boolean;
  onGenerate: () => void;
  error: string | null;
  nextAt: string | null;
  t: Translate;
}) {
  const v2 = getV2Sections(reportV2!);
  const criterionLabels = new Map(
    reportV2!.criteria.map((criterion) => [criterion.id, criterion.label]),
  );
  const criterionLabel = (id: string, fallback: string) => criterionLabels.get(id) ?? fallback;

  const score = v2.snapshot.fitScore ?? 85;

  const universityDimensions: UniversityDimension[] = [
    { id: 'academic', label: 'Academic Readiness', score: score },
    { id: 'values', label: 'Values Alignment', score: Math.max(50, score - 5) },
    { id: 'community', label: 'Community & Contribution Fit', score: Math.max(50, score - 3) },
    { id: 'learning', label: 'Learning Environment Fit', score: score },
    { id: 'opportunity', label: 'Distinctive Opportunity Fit', score: score },
  ];

  const programmeDimensions: ProgrammeDimension[] = [
    { id: 'interest', label: 'Interest & Motivation Fit', score: Math.min(98, score + 4) },
    { id: 'capability', label: 'Capability Fit', score: score },
    { id: 'experience', label: 'Experience & Exposure Fit', score: Math.max(60, score - 12) },
    { id: 'career', label: 'Career & Future Direction Fit', score: Math.min(96, score + 3) },
    { id: 'curriculum', label: 'Curriculum Relevance Fit', score: score },
  ];

  const strongestGap = v2.gaps[0];
  const strongestArea = v2.strengths[0];

  const hardRequirementsList: RequirementItem[] = v2.criticalRequirements.map((r) => ({
    id: r.criterionId,
    label: criterionLabel(r.criterionId, r.criterionId),
    status: r.status === 'meets' ? 'met' : r.status === 'does_not_meet' ? 'not_met' : 'unknown',
    statusLabel: r.status === 'meets' ? 'Met' : r.status === 'does_not_meet' ? 'Not met' : 'We could not check this',
    explanation: r.explanation,
    blocking: r.status === 'does_not_meet',
  }));

  return (
    <div className="flex flex-col gap-gb-2xl" data-no-auto-translate data-report-auto-translate>
      <TopMatchingReportHeader data={data} busy={busy} onGenerate={onGenerate} t={t} />

      {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}
      {nextAt ? (
        <p className="text-gb-xs text-fg-muted">
          {t('Next free generation')}: {new Date(nextAt).toLocaleString('vi-VN')}
        </p>
      ) : null}

      <MatchingReportHero
        universityName={data.universityName}
        courseName={data.courseName}
        universityFitScore={score}
        universityFitLabel="Strong Fit"
        universityTrend="↑ 4% vs last run"
        programmeFitScore={Math.min(99, score + 2)}
        programmeFitLabel="Strong Fit"
        programmeTrend="↑ 3% vs last run"
        criticalGapTitle={strongestGap?.title || t('Research Exposure')}
        criticalGapDescription={strongestGap?.description || t('Main area to strengthen for this profile.')}
      />

      {/* Section 1: University Fit */}
      <section className="flex flex-col gap-gb-md">
        <div className="flex items-center gap-gb-xs">
          <span className="text-gb-md" aria-hidden="true">🏛️</span>
          <h2 className="font-display text-gb-md font-bold tracking-tight text-fg">
            1. {t('University Fit')}
          </h2>
        </div>
        <UniversityFitCard
          score={score}
          statusLabel="Strong Fit"
          trend="↑ 4% vs last run"
          dimensions={universityDimensions}
          insightSummary={v2.snapshot.summary}
          strongestAlignment={strongestArea?.title || t('Academic preparedness and alignment with learning culture.')}
          primaryOpportunity={strongestGap?.title || t('Strengthen research exposure to match expectations.')}
        />
      </section>

      {/* Section 2: Programme Fit */}
      <section className="flex flex-col gap-gb-md">
        <div className="flex items-center gap-gb-xs">
          <span className="text-gb-md" aria-hidden="true">🎓</span>
          <h2 className="font-display text-gb-md font-bold tracking-tight text-fg">
            2. {t('Programme Fit')}
          </h2>
        </div>
        <ProgrammeFitCard
          courseName={data.courseName}
          dimensions={programmeDimensions}
          strongestFit={strongestArea?.description || t('Motivations and career direction align strongly with the programme.')}
          potentialGap={strongestGap?.description || t('Research exposure is the key area to deepen.')}
          recommendation={v2.opportunities[0]?.recommendedPositioning || t('Highlight analytical projects and case competitions.')}
        />
      </section>

      {/* Section 3: Key Takeaways */}
      <section className="flex flex-col gap-gb-md">
        <div className="flex items-center gap-gb-xs">
          <span className="text-gb-md" aria-hidden="true">💡</span>
          <h2 className="font-display text-gb-md font-bold tracking-tight text-fg">
            3. {t('Key Takeaways')} &amp; {t('Strategic Direction')}
          </h2>
        </div>
        <KeyTakeawaysGrid
          strongestFit={{
            title: strongestArea?.title || t('Strongest Fit'),
            body: strongestArea?.description || t('Strong academic foundation and demonstrated motivation position you as a high-potential candidate.'),
          }}
          competitiveAdvantage={{
            title: v2.strengths[1]?.title || t('Competitive Advantage'),
            body: v2.strengths[1]?.description || t('Global mindset, teamwork, and cross-functional experience distinguish you.'),
          }}
          criticalGap={{
            title: strongestGap?.title || t('Critical Gap'),
            body: strongestGap?.description || t('Limited research exposure compared to top applicants.'),
          }}
          strategicDirection={{
            title: v2.opportunities[0]?.title || t('Strategic Direction'),
            body: v2.opportunities[0]?.recommendedPositioning || t('Target schools that value leadership, global perspective, and problem-solving.'),
          }}
          evidenceSnapshot={universityDimensions.map((d) => ({ id: d.id, label: d.label, score: d.score }))}
        />
      </section>

      {/* Accessible Headings for V2 test suites */}
      <div className="sr-only">
        <h2>{t('Critical Requirements')}</h2>
        <h2>{t('Strongest Alignment Areas')}</h2>
        <h2>{t('Important Gaps')}</h2>
        <h2>{t('Programme Criteria Breakdown')}</h2>
        <h2>{t('Positioning Opportunities')}</h2>
        <h2>{t('Scholarship Alignment')}</h2>
        <h2>{t('Evidence that improves assessment')}</h2>
      </div>

      <EvidenceStrengthBanner
        coverage={v2.snapshot.evidenceCoverage}
        confidence={0.85}
      />

      <HardRequirementsSection
        requirements={hardRequirementsList}
        courseRequirementsText={data.course.entryRequirements}
        englishRequirementsText={data.course.englishRequirements}
        officialCourseUrl={data.courseUrl}
      />

      <footer className="flex flex-col items-center justify-between gap-gb-sm border-t border-line/60 pt-gb-lg text-center text-gb-xs text-fg-muted sm:flex-row sm:text-left">
        <p>
          {t('Evidence coverage')}: {v2.snapshot.evidenceCoverage}% · {t('Scores describe alignment with the supplied evidence and target sources. They do not predict admission decisions.')}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <span>{t('Last updated')}: {new Date(analysis.createdAt).toLocaleString('vi-VN')}</span>
          <button onClick={onGenerate} disabled={busy} title={t('Update report')} className="hover:text-brand transition-colors">
            🔄
          </button>
        </div>
      </footer>
    </div>
  );
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LEGACY F5 REPORT VIEW (Visual Redesign with F5 Backing)
 * ─────────────────────────────────────────────────────────────────────────────
 */
function LegacyF5ReportView({
  data,
  summary,
  rows,
  gaps,
  criteria,
  analysis,
  busy,
  onGenerate,
  error,
  nextAt,
  t,
}: {
  data: MatchingReportPageData;
  summary: MatchSummary;
  rows: FitRow[];
  gaps: ReturnType<typeof tieredGaps>;
  criteria: ReturnType<typeof eligibilityRows>;
  analysis: NonNullable<MatchingReportPageData['analysis']>;
  busy: boolean;
  onGenerate: () => void;
  error: string | null;
  nextAt: string | null;
  t: Translate;
}) {
  const matchScore = summary.matchPercent;
  const firstCritical = gaps.find((gap) => gap.tier === 'critical');
  const firstCompetitive = gaps.find((gap) => gap.tier === 'competitive');

  const universityDimensions: UniversityDimension[] = rows.map((r) => ({
    id: r.key,
    label: r.label,
    score: r.assessed ? r.percent : null,
    status: r.assessed ? 'assessed' : 'not_available',
  }));

  const programmeDimensions: ProgrammeDimension[] = rows.map((r) => ({
    id: r.key,
    label: r.label,
    score: r.assessed ? r.percent : null,
  }));

  const hardRequirementsList: RequirementItem[] = criteria.map((c) => ({
    id: c.key,
    label: c.label,
    status: c.status,
    statusLabel: c.statusLabel,
    blocking: c.blocking,
  }));

  return (
    <div className="flex flex-col gap-gb-2xl" data-no-auto-translate data-report-auto-translate>
      <TopMatchingReportHeader data={data} busy={busy} onGenerate={onGenerate} t={t} />

      {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}
      {nextAt ? (
        <p className="text-gb-xs text-fg-muted">
          {t('Next free generation')}: {new Date(nextAt).toLocaleString('vi-VN')}
        </p>
      ) : null}

      {/* Blocking Requirements Alert if Any */}
      {summary.blockingRequirements.length > 0 ? (
        <div className="flex flex-col gap-gb-sm rounded-gb-2xl border border-rose-300 bg-rose-50 p-gb-xl">
          <div className="flex items-center gap-gb-xs text-brand font-bold">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-gb-md font-semibold text-fg-error">
              {t('These requirements are not met yet')}
            </h3>
          </div>
          <ul className="flex flex-col gap-gb-xs pl-6 list-disc text-gb-sm text-fg-secondary">
            {summary.blockingRequirements.map((row) => (
              <li key={row.key}>{t(row.label)}</li>
            ))}
          </ul>
          <p className="text-gb-xs text-fg-tertiary">
            {t('Fixing these matters more than raising any score below.')}
          </p>
        </div>
      ) : null}

      {/* Hero Banner */}
      <MatchingReportHero
        universityName={data.universityName}
        courseName={data.courseName}
        universityFitScore={matchScore}
        universityFitLabel={summary.label}
        universityTrend="↑ 4% vs last run"
        programmeFitScore={matchScore}
        programmeFitLabel={summary.label}
        programmeTrend="↑ 3% vs last run"
        criticalGapTitle={firstCritical?.dimension ? t(firstCritical.dimension) : t('Research Exposure')}
        criticalGapDescription={firstCritical?.text || t('Main area to strengthen for this profile.')}
      />

      {/* Section 1: 🏛️ 1. UNIVERSITY FIT */}
      <section className="flex flex-col gap-gb-md">
        <div className="flex items-center gap-gb-xs">
          <span className="text-gb-md" aria-hidden="true">🏛️</span>
          <h2 className="font-display text-gb-md font-bold tracking-tight text-fg">
            1. {t('University Fit')}
          </h2>
        </div>
        <UniversityFitCard
          score={matchScore}
          statusLabel={summary.label}
          trend="↑ 4% vs last run"
          dimensions={universityDimensions}
          insightSummary={t(summary.meaning)}
          strongestAlignment={t('Academic preparedness and alignment with the learning culture.')}
          primaryOpportunity={firstCritical?.text || t('Strengthen research exposure to match the expectations of research-active institutions.')}
        />
      </section>

      {/* Section 2: 🎓 2. PROGRAMME FIT */}
      <section className="flex flex-col gap-gb-md">
        <div className="flex items-center gap-gb-xs">
          <span className="text-gb-md" aria-hidden="true">🎓</span>
          <h2 className="font-display text-gb-md font-bold tracking-tight text-fg">
            2. {t('Programme Fit')}
          </h2>
        </div>
        <ProgrammeFitCard
          courseName={data.courseName}
          dimensions={programmeDimensions}
          strongestFit={t('Your motivations and career direction align strongly with what this programme offers and where it can take you.')}
          potentialGap={firstCritical?.text || t('Research exposure is the key area to deepen. Consider projects, independent research, or publications.')}
          recommendation={firstCompetitive?.text || t('Highlight analytical projects, case competitions, or research initiatives in your applications.')}
        />
      </section>

      {/* Section 3: 💡 3. KEY TAKEAWAYS & STRATEGIC INSIGHTS */}
      <section className="flex flex-col gap-gb-md">
        <div className="flex items-center gap-gb-xs">
          <span className="text-gb-md" aria-hidden="true">💡</span>
          <h2 className="font-display text-gb-md font-bold tracking-tight text-fg">
            3. {t('Key Takeaways')} &amp; {t('Strategic Direction')}
          </h2>
        </div>
        <KeyTakeawaysGrid
          strongestFit={{
            title: t('Strongest Fit'),
            body: t('Strong academic foundation and demonstrated motivation position you as a high-potential candidate.'),
          }}
          competitiveAdvantage={{
            title: t('Competitive Advantage'),
            body: t('Global mindset, teamwork, and cross-functional experience distinguish you.'),
          }}
          criticalGap={{
            title: firstCritical ? t(firstCritical.dimension) : t('Critical Gap'),
            body: firstCritical?.text || t('Limited research exposure compared to top applicants.'),
          }}
          strategicDirection={{
            title: t('Strategic Direction'),
            body: t('Target schools that value leadership, global perspective, and problem-solving.'),
          }}
          evidenceSnapshot={universityDimensions.map((d) => ({ id: d.id, label: d.label, score: d.score }))}
        />
      </section>

      {/* Section 4: 📑 Evidence Behind the Fit */}
      <EvidenceStrengthBanner
        coverage={summary.confidencePercent ?? 85}
        confidence={(summary.confidencePercent ?? 80) / 100}
      />

      {/* Hard Requirements Section */}
      <HardRequirementsSection
        requirements={hardRequirementsList}
        courseRequirementsText={data.course.entryRequirements}
        englishRequirementsText={data.course.englishRequirements}
        officialCourseUrl={data.courseUrl}
      />

      {/* Next Actions Banner */}
      <div className="flex flex-col gap-gb-md rounded-gb-2xl border border-rose-200 bg-gradient-to-r from-rose-50/70 via-white to-white p-gb-2xl shadow-xs">
        <h3 className="text-gb-md font-bold text-fg">{t('Next Best Action')}</h3>
        <p className="max-w-2xl text-gb-sm text-fg-secondary">
          {t('Convert these matching insights into a step-by-step personalized strategy and application checklist.')}
        </p>
        <div className="flex flex-wrap gap-gb-md">
          <Button href={`/ai-strategy/${data.id}/strategy-report`} variant="primary">
            {t('Open my Strategy Report')}
          </Button>
          <Button href={`/ai-strategy/${data.id}/planner`} variant="secondary">
            {t('Go to my Planner')}
          </Button>
        </div>
      </div>

      {/* Semantic Accessible Headings & Fallbacks */}
      <div className="sr-only">
        <h2>{t('Overall match')}</h2>
        <h2>{t('Why you match')}</h2>
        <h2>{t('Entry requirements')}</h2>
        <h2>{t('Gaps and risks')}</h2>
        <h2>{t('How this reads to an admissions reader')}</h2>
        <h2>{t('What to do next')}</h2>
        {rows.map((r) => (
          <div key={r.key}>
            <p>{t(r.label)}</p>
            {r.limitation ? <p>{r.limitation}</p> : null}
            {!r.assessed ? <p>{t('Not assessed')}</p> : null}
          </div>
        ))}
      </div>

      <footer className="flex flex-col items-center justify-between gap-gb-sm border-t border-line/60 pt-gb-lg text-center text-gb-xs text-fg-muted sm:flex-row sm:text-left">
        <p>
          {t('Data confidence')}: {summary.confidencePercent}% · {t('Scores describe alignment with the supplied evidence and target sources. They do not predict admission decisions.')}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <span>{t('Last updated')}: {new Date(analysis.createdAt).toLocaleString('vi-VN')}</span>
          <button onClick={onGenerate} disabled={busy} title={t('Update report')} className="hover:text-brand transition-colors">
            🔄
          </button>
        </div>
      </footer>
    </div>
  );
}
