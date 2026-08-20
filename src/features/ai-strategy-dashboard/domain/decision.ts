import type { AssessmentProvenance, AssessmentResult } from './assessment';

/** Current deterministic state of a decision, not a recommendation or task. */
export type DecisionStatus = 'available' | 'blocked' | 'needs_information' | 'needs_user_choice';

export type DecisionFeasibility = 'feasible' | 'infeasible' | 'uncertain';

/** Preserves the epistemic origin of each assessment used to form a decision. */
export type DecisionReason = {
  assessmentId: string;
  label: string;
  detail: string | null;
  provenance: AssessmentProvenance;
};

export type DecisionOption = {
  id: string;
  label: string;
  feasibility: DecisionFeasibility;
  reasons: DecisionReason[];
};

/**
 * A deterministic choice boundary for downstream Plan work. It intentionally
 * contains no task, sequence, deadline, or planner-write representation.
 */
export type DecisionResult = {
  id: string;
  subject: string;
  status: DecisionStatus;
  title: string;
  summary: string;
  options: DecisionOption[];
  supportingAssessmentIds: string[];
  blockingAssessmentIds: string[];
  mode: 'deterministic' | 'ai' | 'hybrid';
};

export type DecisionAssessment = Pick<AssessmentResult,
  | 'id'
  | 'subject'
  | 'status'
  | 'summary'
  | 'source'
  | 'decisionBasis'
>;
