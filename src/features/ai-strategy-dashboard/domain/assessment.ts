/**
 * Core 1 Assess -- domain model.
 *
 * An assessment is a finding about the applicant's current situation. It is
 * deliberately not a recommendation, task, phase, or scheduling instruction.
 */

export const ASSESSMENT_MODES = ['deterministic', 'ai', 'hybrid'] as const;
export type AssessmentMode = (typeof ASSESSMENT_MODES)[number];

export const ASSESSMENT_STATUSES = [
  'meets',
  'gap',
  'unknown',
  'needs_attention',
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const ASSESSMENT_SEVERITIES = ['info', 'low', 'medium', 'high'] as const;
export type AssessmentSeverity = (typeof ASSESSMENT_SEVERITIES)[number];

/** The kind of fact or uncertainty an assessment records. */
export type AssessmentKind =
  | 'requirement'
  | 'identified_gap'
  | 'evidence'
  | 'deadline'
  | 'constraint'
  | 'missing_information';

/**
 * Epistemic origin of an assessment input. The compiler's own deterministic
 * conclusion never changes the origin of the upstream evidence it relied on.
 */
export type AssessmentProvenance =
  | 'user_provided'
  | 'database_factual'
  | 'deterministically_derived'
  | 'ai_generated'
  | 'unknown';

/**
 * The decision-relevant semantic of a finding. This is set by Assess from
 * structured source data so Decide never has to infer it from prose or severity.
 */
export type AssessmentDecisionBasis =
  | 'hard_constraint'
  | 'soft_signal'
  | 'information_gap'
  | 'user_constraint'
  | 'neutral';

export type AssessmentSource = {
  kind: AssessmentKind;
  /** Stable upstream identifier when one exists. */
  sourceId: string | null;
  provenance: AssessmentProvenance;
};

export type AssessmentEvidence = {
  id: string;
  label: string;
  detail: string | null;
  provenance: AssessmentProvenance;
  sourceId: string | null;
  sourceUrl: string | null;
  confidence: number | null;
};

/**
 * A stable, current-state finding for downstream Decide and Plan work.
 * `mode` describes how this result was compiled, not the provenance of its
 * evidence. This first compiler always emits `deterministic`.
 */
export type AssessmentResult = {
  id: string;
  kind: AssessmentKind;
  subject: string;
  currentState: string;
  status: AssessmentStatus;
  severity: AssessmentSeverity;
  title: string;
  summary: string;
  evidence: AssessmentEvidence[];
  source: AssessmentSource;
  decisionBasis: AssessmentDecisionBasis;
  confidence: number | null;
  mode: AssessmentMode;
};
