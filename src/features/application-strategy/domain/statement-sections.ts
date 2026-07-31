import { AACC_PILLARS, type AaccAssessment, type AaccPillarKey, type ReadinessCheckKey, type StatementAnalysis } from './types';

/**
 * The five statement analysis sections, the four AACC pillars, and the readiness
 * checklist.
 *
 * Sections are `?section=` query state rather than routes, because they are views
 * of one analysis of one draft — the editor stays mounted and the student's cursor
 * position and scroll survive moving between them. Five routes would remount the
 * editor each time.
 */

export const STATEMENT_SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'ideas', label: 'Ý tưởng và Cấu trúc' },
  { key: 'opening', label: 'Mở bài và sức hút' },
  { key: 'aacc', label: 'Đánh giá AACC' },
  { key: 'readiness', label: 'Statement Readiness' },
] as const;

export type StatementSectionKey = (typeof STATEMENT_SECTIONS)[number]['key'];

const SECTION_KEYS = STATEMENT_SECTIONS.map((s) => s.key);

/**
 * Coerce whatever arrived in the query string.
 *
 * Defaults to `overview` rather than 404ing: a mistyped or stale `?section=` should
 * land the student on the statement, not on an error page.
 */
export function parseStatementSection(value: string | string[] | undefined): StatementSectionKey {
  const first = Array.isArray(value) ? value[0] : value;
  if (first && (SECTION_KEYS as readonly string[]).includes(first)) {
    return first as StatementSectionKey;
  }
  return 'overview';
}

export function statementSectionLabel(key: StatementSectionKey): string {
  return STATEMENT_SECTIONS.find((s) => s.key === key)?.label ?? 'Overview';
}

// ── AACC ──────────────────────────────────────────────────────────────────

export const AACC_PILLAR_LABEL: Record<AaccPillarKey, string> = {
  academic: 'Academic',
  activities: 'Activities',
  character: 'Character',
  contribution: 'Contribution',
};

export const AACC_PILLAR_DESCRIPTION: Record<AaccPillarKey, string> = {
  academic: 'What the statement shows about how you think and what you have studied.',
  activities: 'What it shows about what you have done outside the classroom.',
  character: 'What it shows about who you are and how you respond to difficulty.',
  contribution: 'What it shows about what you would add to this programme.',
};

/**
 * The framing sentence, displayed wherever a pillar score is.
 *
 * Fixed here rather than written per screen because the whole point is that it
 * never gets paraphrased into something weaker. A score next to a university name
 * reads as an admission chance unless it is explicitly denied, and this is the
 * denial.
 */
export const AACC_SCORE_FRAMING =
  'This score measures how clearly the current draft demonstrates this area. It is not an admission probability.';

/** An empty assessment, for a draft that has not been analysed. */
export function emptyAacc(): AaccAssessment {
  return AACC_PILLARS.reduce((acc, key) => {
    acc[key] = {
      score: 0,
      explanation: '',
      evidence: [],
      missingEvidence: [],
      recommendedImprovement: '',
    };
    return acc;
  }, {} as AaccAssessment);
}

export function hasAacc(analysis: Pick<StatementAnalysis, 'aacc'> | null | undefined): boolean {
  if (!analysis) return false;
  return AACC_PILLARS.some((key) => (analysis.aacc[key]?.explanation ?? '').trim().length > 0);
}

/**
 * How a score is described in words.
 *
 * Words rather than a bar or a ring, and never a percentage: the requirement is
 * that the score stays visually secondary to the explanation, and a filled ring is
 * the most prominent thing on any card it appears on.
 */
export function scoreWording(score: number): string {
  if (score >= 75) return 'Clearly demonstrated';
  if (score >= 50) return 'Partly demonstrated';
  if (score >= 25) return 'Barely demonstrated';
  return 'Not demonstrated yet';
}

// ── Readiness ─────────────────────────────────────────────────────────────

export const READINESS_LABEL: Record<ReadinessCheckKey, string> = {
  promptAnswered: 'Answers the essay prompt',
  wordLimit: 'Within the word limit',
  placeholderText: 'No placeholder text left',
  incompleteSentences: 'No incomplete sentences',
  unsupportedClaims: 'No unsupported claims',
  profileContradictions: 'Consistent with your profile',
  repeatedSections: 'No repeated passages',
  programmeReferences: 'Refers to this programme',
  unresolvedFeedback: 'No unresolved critical feedback',
};

export const READINESS_ORDER: readonly ReadinessCheckKey[] = [
  'promptAnswered',
  'wordLimit',
  'placeholderText',
  'incompleteSentences',
  'unsupportedClaims',
  'profileContradictions',
  'repeatedSections',
  'programmeReferences',
  'unresolvedFeedback',
];

// ── Word counting ─────────────────────────────────────────────────────────

/**
 * The word count shown to the student.
 *
 * Whitespace-split, which is what a word processor does and therefore what the
 * student will have compared against. A hyphenated word counts once; that matches
 * UCAS and every admissions office's own counter.
 */
export function countStatementWords(text: string | null | undefined): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

export type WordLimitState = 'unknown' | 'under' | 'near' | 'over';

/** `near` starts at 90% — enough warning to cut a sentence rather than a paragraph. */
export function wordLimitState(count: number, limit: number | null): WordLimitState {
  if (limit == null || limit <= 0) return 'unknown';
  if (count > limit) return 'over';
  if (count >= limit * 0.9) return 'near';
  return 'under';
}
