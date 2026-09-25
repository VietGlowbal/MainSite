import type {
  BenefitComponent,
  BenefitConfidence,
} from './benefit-types';
import type { PersonalFitReasonCode } from './personal-fit';
import type { RecommendationPolicy } from './recommendation-policy';
import type {
  ScholarshipRecommendationCandidate,
} from './recommendation';
import type { ValueStatus } from './valuation';

export type RecommendationReasonCode =
  | 'target-country-match'
  | 'target-university-match'
  | 'programme-match'
  | 'subject-match'
  | 'study-level-match'
  | 'intake-match'
  | 'funding-preference-match'
  | 'budget-aligned'
  | 'study-mode-match'
  | 'personal-fit-match'
  | 'strong-financial-value'
  | 'full-tuition'
  | 'exact-award-value'
  | 'mixed-award-value'
  | 'estimated-award-value'
  | 'incomplete-eligibility'
  | 'incomplete-evidence'
  | 'no-comparable-value'
  | 'hard-ineligible';

export type RecommendationWarningCode =
  | 'eligibility-unknown'
  | 'hard-ineligible'
  | 'fit-unknown'
  | 'no-comparable-value'
  | 'estimated-value'
  | 'low-value-evidence'
  | 'not-top-k';

export type RecommendationWarning = {
  code: RecommendationWarningCode;
  message: string;
};

export type RecommendationReasonData = {
  eligibilityStatus: 'ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN';
  fitStatus: 'SCORED' | 'UNKNOWN' | 'INELIGIBLE' | null;
  fitScore: number | null;
  fitConfidence: number | null;
  comparableValueScore: number | null;
  valueScore: number | null;
  valueAmount: number | null;
  valueUpperBound: number | null;
  valueCurrency: string | null;
  valueStatus: ValueStatus | null;
  valueQualityScore: number | null;
  evidenceConfidence: BenefitConfidence | null;
  evidenceScore: number | null;
  contributions: {
    fit: number | null;
    value: number | null;
    evidence: number | null;
  };
  fitReasonCodes: readonly PersonalFitReasonCode[];
  missingSignals: readonly string[];
};

export type RecommendationReasonResult = {
  reasonCodes: readonly RecommendationReasonCode[];
  reasonData: RecommendationReasonData;
  warnings: readonly RecommendationWarning[];
};

const FIT_REASON_MAP: Readonly<Partial<Record<PersonalFitReasonCode, RecommendationReasonCode>>> = {
  'preferred-country-match': 'target-country-match',
  'selected-university-match': 'target-university-match',
  'saved-university-match': 'target-university-match',
  'selected-programme-match': 'programme-match',
  'selected-programme-discovery-match': 'programme-match',
  'subject-match': 'subject-match',
  'subject-discovery-match': 'subject-match',
  'study-level-match': 'study-level-match',
  'study-level-discovery-match': 'study-level-match',
  'intake-match': 'intake-match',
  'intake-discovery-match': 'intake-match',
  'funding-preference-match': 'funding-preference-match',
  'budget-aligned': 'budget-aligned',
  'study-mode-match': 'study-mode-match',
  'study-mode-discovery-match': 'study-mode-match',
};

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function addReason(
  reasons: RecommendationReasonCode[],
  code: RecommendationReasonCode,
): void {
  if (!reasons.includes(code)) reasons.push(code);
}

function fullTuitionEvidence(
  benefits: readonly BenefitComponent[],
  value: ScholarshipRecommendationCandidate['value'],
): boolean {
  return benefits.some((component, index) => {
    const valuationComponent = value?.components[index];
    if (valuationComponent && !valuationComponent.included) return false;
    return component.type === 'tuition'
      && (
        component.coverage === 'full'
        || (component.percentage?.min === 100 && (component.percentage.max ?? 100) === 100)
      );
  });
}

function confidenceFor(
  value: ScholarshipRecommendationCandidate['value'],
): BenefitConfidence | null {
  const confidences = value?.components
    .filter((component) => component.included && component.totalValue !== null)
    .map((component) => component.confidence)
    .filter((confidence): confidence is BenefitConfidence => confidence !== null);
  if (!confidences || confidences.length === 0) return null;
  const quality: Readonly<Record<BenefitConfidence, number>> = { high: 3, medium: 2, low: 1 };
  return confidences.reduce((lowest, current) =>
    quality[current] < quality[lowest] ? current : lowest,
  );
}

function warning(
  code: RecommendationWarningCode,
  message: string,
): RecommendationWarning {
  return { code, message };
}

/**
 * Convert deterministic fit/value facts into stable reason codes and data for
 * the later UI. This module never calls an LLM and never labels 100% tuition
 * as full ride.
 */
export function deriveRecommendationReasons(args: {
  candidate: ScholarshipRecommendationCandidate;
  policy: RecommendationPolicy;
  fitScore: number | null;
  comparableValueScore: number | null;
  valueScore: number | null;
  valueQualityScore: number | null;
  evidenceScore: number | null;
  contributions: RecommendationReasonData['contributions'];
}): RecommendationReasonResult {
  const { candidate } = args;
  const eligibilityStatus = candidate.eligibility?.scholarshipId === candidate.id
    ? candidate.eligibility.status
    : 'UNKNOWN';
  const fitStatus = candidate.fit?.scholarshipId === candidate.id
    ? candidate.fit.fitStatus
    : null;
  const value = candidate.value;
  const comparable = value?.comparableTotalValue ?? null;
  const total = value?.totalValue ?? null;
  const evidenceConfidence = confidenceFor(value);
  const reasonCodes: RecommendationReasonCode[] = [];
  const warnings: RecommendationWarning[] = [];

  const fitMatchesCandidate = candidate.fit?.scholarshipId === candidate.id;
  if (fitMatchesCandidate) {
    for (const fitReason of candidate.fit?.reasonCodes ?? []) {
      const mapped = FIT_REASON_MAP[fitReason];
      if (mapped) addReason(reasonCodes, mapped);
    }
  }
  if ((args.fitScore ?? 0) > 0 && fitStatus === 'SCORED') {
    addReason(reasonCodes, 'personal-fit-match');
  }

  if (eligibilityStatus === 'INELIGIBLE') {
    addReason(reasonCodes, 'hard-ineligible');
    warnings.push(warning('hard-ineligible', 'Hard eligibility failed; this scholarship cannot be recommended.'));
  } else if (eligibilityStatus === 'UNKNOWN') {
    addReason(reasonCodes, 'incomplete-eligibility');
    warnings.push(warning('eligibility-unknown', 'Eligibility is incomplete; this scholarship is not canonically recommended.'));
  }

  if (fitStatus === null || fitStatus === 'UNKNOWN') {
    addReason(reasonCodes, 'incomplete-evidence');
    warnings.push(warning('fit-unknown', 'Personal fit could not be scored from the available context.'));
  } else if (fitStatus === 'INELIGIBLE') {
    addReason(reasonCodes, 'incomplete-eligibility');
    warnings.push(warning('fit-unknown', 'The fit result is not rankable because its eligibility gate is not satisfied.'));
  }

  if (value?.status === 'EXACT') addReason(reasonCodes, 'exact-award-value');
  if (value?.status === 'MIXED') addReason(reasonCodes, 'mixed-award-value');
  if (value?.status === 'ESTIMATED') {
    addReason(reasonCodes, 'estimated-award-value');
    warnings.push(warning('estimated-value', 'The monetary value includes estimated evidence and is not an official amount.'));
  }
  if (fullTuitionEvidence(candidate.benefits, value)) addReason(reasonCodes, 'full-tuition');

  if (args.comparableValueScore === null || comparable === null) {
    addReason(reasonCodes, 'no-comparable-value');
    warnings.push(warning('no-comparable-value', 'No defensible comparable monetary value is available for ranking.'));
  } else if (args.comparableValueScore >= args.policy.strongValueThreshold) {
    addReason(reasonCodes, 'strong-financial-value');
  }
  if (evidenceConfidence === 'low') {
    addReason(reasonCodes, 'incomplete-evidence');
    warnings.push(warning('low-value-evidence', 'The value source has low evidence confidence.'));
  }

  const reasonData: RecommendationReasonData = {
    eligibilityStatus,
    fitStatus,
    fitScore: args.fitScore,
    fitConfidence: fitMatchesCandidate ? candidate.fit?.confidence ?? null : null,
    comparableValueScore: args.comparableValueScore,
    valueScore: args.valueScore,
    valueAmount: comparable?.amount ?? null,
    valueUpperBound: total && comparable && total.currency?.toUpperCase() === comparable.currency.toUpperCase()
      ? total.max
      : null,
    valueCurrency: comparable?.currency ?? null,
    valueStatus: value?.status ?? null,
    valueQualityScore: args.valueQualityScore,
    evidenceConfidence,
    evidenceScore: args.evidenceScore,
    contributions: args.contributions,
    fitReasonCodes: fitMatchesCandidate ? candidate.fit?.reasonCodes ?? [] : [],
    missingSignals: unique([
      ...(eligibilityStatus === 'UNKNOWN' ? candidate.eligibility?.missingSignals ?? [] : []),
      ...(fitMatchesCandidate ? candidate.fit?.missingSignals ?? [] : []),
    ]),
  };

  return {
    reasonCodes: unique(reasonCodes),
    reasonData,
    warnings: uniqueWarnings(warnings),
  };
}

function uniqueWarnings(
  warnings: readonly RecommendationWarning[],
): RecommendationWarning[] {
  return warnings.filter((item, index, all) =>
    all.findIndex((candidate) => candidate.code === item.code && candidate.message === item.message) === index,
  );
}
