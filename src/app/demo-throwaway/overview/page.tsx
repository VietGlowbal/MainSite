import Link from 'next/link';
import {
  cvContentStatus,
  cvReviewStatus,
  cvStatus,
  isAnalysisOutdated,
  isExportOutdated,
  isReviewOutdated,
  nextAction,
  statementStatus,
  statusLabel,
  strategyStatus,
  targetProfileStatus,
  type CvStatusInputs,
  type StatementStatusInputs,
} from '@/features/application-strategy/domain';
import {
  DEMO_APPLICATION,
  DEMO_APPLICATION_ID,
  DEMO_STATEMENT_DRAFT,
  DEMO_WORD_LIMIT,
  makeCvReview,
  makeStatementAnalysis,
  makeStructuredCv,
  makeTargetProfile,
  parseScenario,
  statementVersion,
  wordCount,
} from '../fixtures';
import { OverviewCards } from './overview-cards';

/**
 * THROWAWAY DEMO — workspace overview. Delete with the folder.
 *
 * Status is NOT hardcoded per scenario. The fixtures carry version numbers and
 * counts, and this page runs them through the committed domain functions. That
 * is the whole reason the demo is worth showing: the stale-review state on the
 * "In progress" scenario is `isReviewOutdated` firing on contentVersion 7 vs a
 * review that read version 5, not a flag someone set to make a screenshot.
 */
export default async function DemoOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  const { scenario: raw } = await searchParams;
  const scenario = parseScenario(raw);

  const targetProfile = makeTargetProfile(scenario);
  const cv = makeStructuredCv(scenario);
  const review = makeCvReview(scenario);
  const analysis = makeStatementAnalysis(scenario);

  const reviewOutdated = isReviewOutdated(review, cv, targetProfile);
  const exportOutdated = cv ? isExportOutdated(cv) : false;
  const stmtVersion = statementVersion(scenario);
  const analysisOutdated = isAnalysisOutdated(analysis, stmtVersion);

  const filledFieldCount = targetProfile
    ? [
        targetProfile.careerDirection,
        targetProfile.universityPositioning,
        targetProfile.educationPhilosophy,
        targetProfile.environment,
        targetProfile.programmeObjectives,
        targetProfile.priorityCapabilities,
        targetProfile.careerAlignment,
      ].filter((v) => v !== null && v.trim() !== '').length
    : 0;

  const cvInputs: CvStatusInputs = {
    targetProfile: targetProfile
      ? { generatedAt: targetProfile.generatedAt, filledFieldCount }
      : null,
    cv: cv
      ? {
          sectionCount: cv.sections.length,
          entryCount: cv.sections.reduce((n, s) => n + s.entries.length, 0),
          selectedLayout: cv.selectedLayout,
          hasExport: cv.lastExportedVersion !== null,
          exportOutdated,
        }
      : null,
    review: review
      ? {
          criticalCount: review.missingSignals.filter((s) => s.critical).length,
          outdated: reviewOutdated,
        }
      : null,
  };

  const words = scenario === 'empty' ? 0 : wordCount(DEMO_STATEMENT_DRAFT);

  const statementInputs: StatementStatusInputs = {
    wordCount: words,
    analysis: analysis
      ? {
          outdated: analysisOutdated,
          readiness: analysis.readiness.state,
          unresolvedCriticalCount: analysis.ideasAndStructure.filter(
            (f) => f.severity === 'problem',
          ).length,
        }
      : null,
  };

  const cvValue = cvStatus(cvInputs);
  const statementValue = statementStatus(statementInputs);
  const overall = strategyStatus(cvValue, statementValue);

  const next = nextAction({
    applicationId: DEMO_APPLICATION_ID,
    cv: cvInputs,
    statement: statementInputs,
    cvStatusValue: cvValue,
    statementStatusValue: statementValue,
  });

  /** Rewrite the domain's real hrefs onto the demo routes. */
  const demoHref = (href: string) =>
    `${href.replace(`/ai-strategy/${DEMO_APPLICATION_ID}`, '/demo-throwaway')}${
      href.includes('?') ? '&' : '?'
    }scenario=${scenario}`;

  return (
    <div className="flex flex-col gap-gb-3xl">
      <header className="flex flex-col gap-gb-lg">
        <div className="flex flex-wrap items-center justify-between gap-gb-lg">
          <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
            Application strategy
          </h1>
          <span className="text-gb-sm text-fg-muted">
            Overall: {statusLabel(overall)}
          </span>
        </div>

        {/* Application context. Missing values are omitted with their
            punctuation rather than rendered as an empty gap. */}
        <p className="text-gb-md text-fg-tertiary">
          {[
            DEMO_APPLICATION.universityName,
            DEMO_APPLICATION.courseName,
            DEMO_APPLICATION.degreeLevel,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {DEMO_APPLICATION.deadline ? (
          <p className="text-gb-sm text-fg-muted">
            Deadline{' '}
            {new Date(DEMO_APPLICATION.deadline).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        ) : null}
      </header>

      <OverviewCards
        scenario={scenario}
        cvStatusValue={cvValue}
        statementStatusValue={statementValue}
        cvDetail={{
          targetProfile: targetProfileStatus(cvInputs.targetProfile),
          content: cvContentStatus(cvInputs.cv),
          review: cvReviewStatus(cvInputs.review),
          selectedLayout: cv?.selectedLayout ?? null,
          exportState:
            cv === null || cv.lastExportedVersion === null
              ? 'none'
              : exportOutdated
                ? 'outdated'
                : 'ready',
          updatedAt: cv?.updatedAt ?? null,
          reviewOutdated,
        }}
        statementDetail={{
          wordCount: words,
          wordLimit: DEMO_WORD_LIMIT,
          lastSavedAt: scenario === 'empty' ? null : '2026-07-29T09:41:00.000Z',
          lastAnalyzedAt: analysis?.createdAt ?? null,
          analysisOutdated,
          readiness: analysis?.readiness.state ?? null,
        }}
        cvHref={demoHref(`/ai-strategy/${DEMO_APPLICATION_ID}/cv/target-profile`)}
        statementHref={demoHref(`/ai-strategy/${DEMO_APPLICATION_ID}/statement`)}
      />

      {/* Exactly one visually primary action. */}
      <div className="flex flex-wrap items-center gap-gb-xl rounded-gb-2xl border border-line bg-surface-muted p-gb-2xl">
        <div className="flex min-w-0 flex-1 flex-col gap-gb-xs">
          <span className="text-gb-sm font-semibold text-fg">Next</span>
          <span className="text-gb-sm text-fg-tertiary">
            {overall === 'ready_for_audit'
              ? 'Both documents are ready. The Submit Audit is Feature 4 and is not part of this demo.'
              : 'Resolved by nextAction() from the same inputs as the cards, so the button and the statuses cannot disagree.'}
          </span>
        </div>
        <Link
          href={demoHref(next.href)}
          className="shrink-0 rounded-gb-md bg-brand px-gb-3xl py-gb-lg text-gb-sm font-semibold text-on-brand hover:bg-brand-hover"
        >
          {next.label}
        </Link>
      </div>
    </div>
  );
}
