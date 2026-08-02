import type { CvLayoutKey, WorkspaceStatus } from './types';

/**
 * The four-value status vocabulary, derived in exactly one place.
 *
 * WHY THIS FILE EXISTS. Three surfaces report the same fact: the two workspace
 * cards on the overview, the `application_strategies.status` column the
 * applications list reads, and the Submit Audit handoff. If each computed it,
 * the overview would eventually say "ready for audit" on a card whose button
 * said "review feedback" — the same class of bug as the reflection mockups
 * badging one flow "1/2" and "2/3".
 *
 * WHAT IS DELIBERATELY NOT HERE. No score, no percentage, no weighting. The
 * status is a category, and the product rule is that no aggregate number is
 * displayed for a document. `needs_attention` outranks progress because an
 * outdated review is worse than an unfinished one: the student would otherwise
 * act on feedback about a draft they no longer have.
 */

// ── CV ────────────────────────────────────────────────────────────────────

export type CvStatusInputs = {
  targetProfile: {
    generatedAt: string | null;
    /** How many of the seven fields have content. */
    filledFieldCount: number;
  } | null;
  cv: {
    sectionCount: number;
    entryCount: number;
    selectedLayout: CvLayoutKey | null;
    hasExport: boolean;
    exportOutdated: boolean;
  } | null;
  review: {
    /** Missing signals flagged critical by the reviewer. */
    criticalCount: number;
    outdated: boolean;
  } | null;
};

export function targetProfileStatus(tp: CvStatusInputs['targetProfile']): WorkspaceStatus {
  if (!tp) return 'not_started';
  // Generated but every field empty is not progress — the generator is required
  // to return empty fields rather than invent, so this is a real outcome and it
  // needs the student to add information, not to continue.
  if (tp.filledFieldCount === 0) return tp.generatedAt ? 'needs_attention' : 'not_started';
  return 'in_progress';
}

export function cvContentStatus(cv: CvStatusInputs['cv']): WorkspaceStatus {
  if (!cv || cv.sectionCount === 0) return 'not_started';
  // Sections with no entries at all is a skeleton, not content.
  if (cv.entryCount === 0) return 'in_progress';
  return 'in_progress';
}

export function cvReviewStatus(review: CvStatusInputs['review']): WorkspaceStatus {
  if (!review) return 'not_started';
  if (review.outdated) return 'needs_attention';
  if (review.criticalCount > 0) return 'needs_attention';
  return 'ready_for_audit';
}

export function cvStatus(i: CvStatusInputs): WorkspaceStatus {
  const nothingStarted =
    !i.targetProfile && (!i.cv || i.cv.sectionCount === 0) && !i.review;
  if (nothingStarted) return 'not_started';

  // Attention first. An outdated review or a critical gap has to win over
  // "in progress", or the card invites the student to continue past the thing
  // that needs fixing.
  if (i.review?.outdated) return 'needs_attention';
  if ((i.review?.criticalCount ?? 0) > 0) return 'needs_attention';
  if (i.cv?.exportOutdated) return 'needs_attention';

  const ready =
    i.review != null &&
    !i.review.outdated &&
    i.review.criticalCount === 0 &&
    i.cv != null &&
    i.cv.selectedLayout !== null &&
    i.cv.hasExport &&
    !i.cv.exportOutdated;

  return ready ? 'ready_for_audit' : 'in_progress';
}

// ── Statement ─────────────────────────────────────────────────────────────

export type StatementStatusInputs = {
  wordCount: number;
  analysis: {
    outdated: boolean;
    readiness: 'needs_attention' | 'ready';
    /** Findings the student has neither accepted nor dismissed. */
    unresolvedCriticalCount: number;
  } | null;
};

/**
 * Below this a draft is a fragment, and analysing it produces feedback about
 * length rather than about the statement. The existing AACC route uses 200
 * characters for the same reason; this is the word-count equivalent.
 */
export const MIN_ANALYSABLE_WORDS = 40;

export function statementStatus(i: StatementStatusInputs): WorkspaceStatus {
  if (i.wordCount === 0) return 'not_started';
  if (!i.analysis) return 'in_progress';
  if (i.analysis.outdated) return 'needs_attention';
  if (i.analysis.unresolvedCriticalCount > 0) return 'needs_attention';
  if (i.analysis.readiness === 'ready') return 'ready_for_audit';
  return 'needs_attention';
}

export function canAnalyseStatement(wordCount: number): boolean {
  return wordCount >= MIN_ANALYSABLE_WORDS;
}

// ── Roll-up ───────────────────────────────────────────────────────────────

/**
 * The strategy is only as done as its least done document, and any attention
 * anywhere surfaces at the top.
 */
export function strategyStatus(cv: WorkspaceStatus, statement: WorkspaceStatus): WorkspaceStatus {
  if (cv === 'needs_attention' || statement === 'needs_attention') return 'needs_attention';
  if (cv === 'ready_for_audit' && statement === 'ready_for_audit') return 'ready_for_audit';
  if (cv === 'not_started' && statement === 'not_started') return 'not_started';
  return 'in_progress';
}

// ── Actions ───────────────────────────────────────────────────────────────

/**
 * The label on a workspace card's primary action, by status.
 *
 * Pinned here rather than in the card component because the copy is specified
 * per status and the two cards must not paraphrase it differently.
 */
const CV_ACTION_LABEL: Record<WorkspaceStatus, string> = {
  not_started: 'Start CV strategy',
  in_progress: 'Continue CV',
  needs_attention: 'Review CV',
  ready_for_audit: 'View or download CV',
};

const STATEMENT_ACTION_LABEL: Record<WorkspaceStatus, string> = {
  not_started: 'Start statement',
  in_progress: 'Continue writing',
  needs_attention: 'Review feedback',
  ready_for_audit: 'View statement',
};

export function cvActionLabel(status: WorkspaceStatus): string {
  return CV_ACTION_LABEL[status];
}

export function statementActionLabel(status: WorkspaceStatus): string {
  return STATEMENT_ACTION_LABEL[status];
}

export function cvActionHref(applicationId: string, i: CvStatusInputs): string {
  const base = `/ai-strategy/${applicationId}/cv`;
  if (!i.targetProfile) return `${base}/target-profile`;
  if (!i.cv || i.cv.sectionCount === 0) return `${base}/content`;
  if (!i.review || i.review.outdated) return `${base}/review`;
  if (i.review.criticalCount > 0) return `${base}/review`;
  return `${base}/layout`;
}

export function statementActionHref(applicationId: string, i: StatementStatusInputs): string {
  const base = `/ai-strategy/${applicationId}/statement`;
  if (i.wordCount === 0) return base;
  if (!i.analysis || i.analysis.outdated) return `${base}?section=overview`;
  if (i.analysis.readiness !== 'ready') return `${base}?section=readiness`;
  return base;
}

export type NextAction = { href: string; label: string };

/**
 * The ONE action the overview leads with.
 *
 * Requirement: exactly one action is visually primary, and in a partial state it
 * points at the highest-priority unfinished item. Returned as a single value
 * rather than a list precisely so two primary buttons cannot be rendered.
 *
 * Priority: something needing attention, then the document that has not been
 * started, then whichever is mid-flight, CV first — the statement brief is
 * built partly from what the CV already covers, so the CV leading produces a
 * better brief.
 */
export function nextAction(args: {
  applicationId: string;
  cv: CvStatusInputs;
  statement: StatementStatusInputs;
  cvStatusValue: WorkspaceStatus;
  statementStatusValue: WorkspaceStatus;
}): NextAction {
  const { applicationId, cv, statement, cvStatusValue, statementStatusValue } = args;

  if (cvStatusValue === 'needs_attention') {
    return { href: cvActionHref(applicationId, cv), label: cvActionLabel(cvStatusValue) };
  }
  if (statementStatusValue === 'needs_attention') {
    return {
      href: statementActionHref(applicationId, statement),
      label: statementActionLabel(statementStatusValue),
    };
  }
  if (cvStatusValue === 'ready_for_audit' && statementStatusValue === 'ready_for_audit') {
    return { href: `/ai-strategy/${applicationId}/audit`, label: 'Continue to Submit Audit' };
  }
  if (cvStatusValue !== 'ready_for_audit') {
    return { href: cvActionHref(applicationId, cv), label: cvActionLabel(cvStatusValue) };
  }
  return {
    href: statementActionHref(applicationId, statement),
    label: statementActionLabel(statementStatusValue),
  };
}

// ── Display ───────────────────────────────────────────────────────────────

/**
 * The student-facing wording. Status is conveyed as text plus an icon, never by
 * colour, so this string always renders.
 */
const STATUS_LABEL: Record<WorkspaceStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  needs_attention: 'Needs attention',
  ready_for_audit: 'Ready for audit',
};

export function statusLabel(status: WorkspaceStatus): string {
  return STATUS_LABEL[status];
}
