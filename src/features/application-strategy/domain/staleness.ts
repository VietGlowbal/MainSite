import type { CvReview, CvTargetProfile, StatementAnalysis, StructuredCv } from './types';

/**
 * Is a stored result still an assessment of what the student currently has?
 *
 * WHY INTEGER VERSIONS AND NOT TIMESTAMPS. Three reasons, and the first is the
 * one that bites:
 *
 *  1. An autosave that changes nothing still moves `updated_at`. With a
 *     timestamp comparison, opening the CV editor and tabbing out of a field
 *     would invalidate a review the student just paid for.
 *  2. `NOW()` in Postgres and `Date.now()` in the app are different clocks. A
 *     row written at the same instant a review completes can compare either
 *     way, so the same state renders as fresh or stale depending on skew.
 *  3. A version is what the review actually recorded about its own inputs, so
 *     the UI can say "this review read version 3 of your CV" rather than
 *     inferring it.
 *
 * The versions only ever increase, so `!==` and `<` agree; `!==` is used so a
 * repaired or rolled-back version still reads as stale rather than as fresh.
 */

/** Just the version fields, so callers can pass a row or a summary. */
type CvVersions = Pick<StructuredCv, 'contentVersion'>;
type TargetProfileVersion = Pick<CvTargetProfile, 'version'>;
type ReviewVersions = Pick<CvReview, 'contentVersion' | 'targetProfileVersion'>;

/**
 * A CV review is outdated when either input has moved on — the CV content or
 * the target profile it was assessed against. Editing the target profile
 * changes what the CV is supposed to prove, which invalidates the verdict just
 * as surely as editing the CV.
 */
export function isReviewOutdated(
  review: ReviewVersions | null | undefined,
  cv: CvVersions | null | undefined,
  targetProfile: TargetProfileVersion | null | undefined,
): boolean {
  // No review is "not analyzed", a distinct state the page renders differently.
  // Saying "outdated" here would offer a re-run of something that never ran.
  if (!review) return false;
  if (cv && review.contentVersion !== cv.contentVersion) return true;
  if (targetProfile && review.targetProfileVersion !== targetProfile.version) return true;
  return false;
}

/**
 * The exported PDF no longer matches the CV.
 *
 * `lastExportedVersion === null` is "never exported", not "outdated" — there is
 * nothing stale to replace, and the page shows `Ready to export` instead.
 */
export function isExportOutdated(cv: CvVersions & Pick<StructuredCv, 'lastExportedVersion'>): boolean {
  if (cv.lastExportedVersion === null) return false;
  return cv.lastExportedVersion !== cv.contentVersion;
}

/** Whether the CV has ever been exported at all. */
export function hasExport(cv: Pick<StructuredCv, 'lastExportedVersion'>): boolean {
  return cv.lastExportedVersion !== null;
}

/**
 * A statement analysis is outdated when the draft has been edited since.
 *
 * `statementVersion` is `personal_statements.version`, which the writer already
 * increments on save — this feature does not add a second counter.
 */
export function isAnalysisOutdated(
  analysis: Pick<StatementAnalysis, 'contentVersion'> | null | undefined,
  statementVersion: number | null | undefined,
): boolean {
  if (!analysis) return false;
  if (statementVersion == null) return false;
  return analysis.contentVersion !== statementVersion;
}

/**
 * Which reviews the student should refresh, named rather than implied.
 *
 * The product rule is that a document is never silently marked incomplete: if
 * something went stale, the student is told which review to re-run. Returning
 * the list here means the overview and the two document pages quote the same
 * one.
 */
export function outdatedReviews(input: {
  review?: ReviewVersions | null;
  cv?: (CvVersions & Pick<StructuredCv, 'lastExportedVersion'>) | null;
  targetProfile?: TargetProfileVersion | null;
  analysis?: Pick<StatementAnalysis, 'contentVersion'> | null;
  statementVersion?: number | null;
}): Array<'cv_review' | 'cv_export' | 'statement_analysis'> {
  const out: Array<'cv_review' | 'cv_export' | 'statement_analysis'> = [];
  if (isReviewOutdated(input.review, input.cv, input.targetProfile)) out.push('cv_review');
  if (input.cv && isExportOutdated(input.cv)) out.push('cv_export');
  if (isAnalysisOutdated(input.analysis, input.statementVersion)) out.push('statement_analysis');
  return out;
}
