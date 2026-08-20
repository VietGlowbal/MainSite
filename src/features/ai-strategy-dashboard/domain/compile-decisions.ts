/** Core 2 Decide: pure, conservative decisions over Core 1 findings. */

import type { AssessmentResult } from './assessment';
import type { DecisionOption, DecisionReason, DecisionResult } from './decision';

const DECISION_ORDER: Record<DecisionResult['status'], number> = {
  blocked: 0,
  needs_information: 1,
  needs_user_choice: 2,
  available: 3,
};

/**
 * Compile decision boundaries from Assess findings only. It never re-evaluates
 * raw context, makes an AI call, or converts a decision into a planner task.
 */
export function compileDecisions(assessments: readonly AssessmentResult[]): DecisionResult[] {
  const normalized = uniqueSortedAssessments(assessments);
  return [
    applicationEligibilityDecision(normalized),
    attentionFocusDecision(normalized),
    constraintContextDecision(normalized),
  ]
    .filter((decision): decision is DecisionResult => decision !== null)
    .sort((left, right) => DECISION_ORDER[left.status] - DECISION_ORDER[right.status] || compareText(left.id, right.id));
}

function applicationEligibilityDecision(assessments: readonly AssessmentResult[]): DecisionResult {
  const hasRequirementFinding = assessments.some((assessment) => assessment.kind === 'requirement');
  const blockers = assessments.filter((assessment) =>
    assessment.decisionBasis === 'hard_constraint'
    && (assessment.status === 'gap' || assessment.status === 'needs_attention'),
  );
  const informationGaps = assessments.filter((assessment) =>
    assessment.decisionBasis === 'information_gap'
    && (assessment.status === 'unknown' || assessment.status === 'needs_attention'),
  );
  const supporting = assessments.filter((assessment) =>
    assessment.decisionBasis === 'hard_constraint' && assessment.status === 'meets',
  );

  if (!hasRequirementFinding) {
    return decision({
      id: 'decision:application-eligibility',
      subject: 'Current application',
      status: 'needs_information',
      title: 'Current application feasibility needs requirement information',
      summary: 'No programme requirement assessment is available, so feasibility cannot be determined.',
      options: [option('option:current-application', 'Current application', 'uncertain', [])],
      supporting: [],
      blocking: [],
    });
  }

  if (blockers.length > 0) {
    return decision({
      id: 'decision:application-eligibility',
      subject: 'Current application',
      status: 'blocked',
      title: 'Current application is blocked by confirmed requirements',
      summary: 'At least one confirmed hard requirement or required artifact is not currently satisfied.',
      options: [option('option:current-application', 'Current application', 'infeasible', blockers)],
      supporting: [...supporting, ...informationGaps],
      blocking: blockers,
    });
  }

  if (informationGaps.length > 0) {
    return decision({
      id: 'decision:application-eligibility',
      subject: 'Current application',
      status: 'needs_information',
      title: 'Current application feasibility needs more information',
      summary: 'No confirmed hard blocker is present, but required information is unresolved or unavailable.',
      options: [option('option:current-application', 'Current application', 'uncertain', informationGaps)],
      supporting,
      blocking: informationGaps,
    });
  }

  return decision({
    id: 'decision:application-eligibility',
    subject: 'Current application',
    status: 'available',
    title: 'Current application has no confirmed hard blocker',
    summary: 'Available means no deterministic hard blocker was found; it is not a recommendation or competitiveness claim.',
    options: [option('option:current-application', 'Current application', 'feasible', supporting)],
    supporting,
    blocking: [],
  });
}

function attentionFocusDecision(assessments: readonly AssessmentResult[]): DecisionResult | null {
  const signals = assessments.filter((assessment) =>
    assessment.decisionBasis === 'soft_signal'
    && (assessment.status === 'gap' || assessment.status === 'needs_attention'),
  );
  if (signals.length === 0) return null;

  const options = signals.map((signal) => option(
    `option:attention:${stableKey(signal.id)}`,
    signal.subject,
    'uncertain',
    [signal],
  ));
  const multipleOptions = options.length > 1;
  return decision({
    id: 'decision:attention-focus',
    subject: 'Application attention focus',
    status: multipleOptions ? 'needs_user_choice' : 'available',
    title: multipleOptions ? 'Multiple non-blocking attention directions are available' : 'A non-blocking attention direction is available',
    summary: multipleOptions
      ? 'No deterministic rule chooses among these soft signals.'
      : 'This signal is available for later planning but does not block the application.',
    options,
    supporting: signals,
    blocking: [],
  });
}

function constraintContextDecision(assessments: readonly AssessmentResult[]): DecisionResult | null {
  const constraints = assessments.filter((assessment) => assessment.decisionBasis === 'user_constraint');
  if (constraints.length === 0) return null;
  return decision({
    id: 'decision:constraint-context',
    subject: 'Recorded student constraints',
    status: 'available',
    title: 'Student constraints are available for later option comparison',
    summary: 'No candidate option is supplied at this boundary, so recorded constraints do not independently establish feasibility or a blocker.',
    options: constraints.map((constraint) => option(
      `option:constraint:${stableKey(constraint.id)}`,
      constraint.subject,
      'uncertain',
      [constraint],
    )),
    supporting: constraints,
    blocking: [],
  });
}

function decision(input: {
  id: string;
  subject: string;
  status: DecisionResult['status'];
  title: string;
  summary: string;
  options: DecisionOption[];
  supporting: readonly AssessmentResult[];
  blocking: readonly AssessmentResult[];
}): DecisionResult {
  return {
    id: input.id,
    subject: input.subject,
    status: input.status,
    title: input.title,
    summary: input.summary,
    options: input.options,
    supportingAssessmentIds: ids(input.supporting),
    blockingAssessmentIds: ids(input.blocking),
    mode: 'deterministic',
  };
}

function option(id: string, label: string, feasibility: DecisionOption['feasibility'], assessments: readonly AssessmentResult[]): DecisionOption {
  return { id, label, feasibility, reasons: assessments.map(reason) };
}

function reason(assessment: AssessmentResult): DecisionReason {
  return {
    assessmentId: assessment.id,
    label: assessment.subject,
    detail: assessment.summary,
    provenance: assessment.source.provenance,
  };
}

function uniqueSortedAssessments(assessments: readonly AssessmentResult[]): AssessmentResult[] {
  const seen = new Set<string>();
  return [...assessments]
    .sort((left, right) => compareText(left.id, right.id))
    .filter((assessment) => {
      if (seen.has(assessment.id)) return false;
      seen.add(assessment.id);
      return true;
    });
}

function ids(assessments: readonly AssessmentResult[]): string[] {
  return assessments.map((assessment) => assessment.id).sort(compareText);
}

function stableKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
