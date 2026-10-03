import type { BenefitComponent, BenefitConfidence } from './benefit-types';
import type { ScholarshipEligibilityResult } from './eligibility';
import type { PersonalFitResult } from './personal-fit';
import {
  DEFAULT_RECOMMENDATION_POLICY,
  resolveRecommendationPolicy,
  type RecommendationPolicy,
} from './recommendation-policy';
import {
  deriveRecommendationReasons,
  type RecommendationReasonCode,
  type RecommendationReasonData,
  type RecommendationWarning,
} from './recommendation-reasons';
import type { ScholarshipValueResult, ValueStatus } from './valuation';
import { resolveScholarshipComparisonPolicy } from './comparison-policy';

export type RecommendationEligibility = Pick<
  ScholarshipEligibilityResult,
  'scholarshipId' | 'status' | 'reasonCodes' | 'warnings' | 'missingSignals'
>;

export type RecommendationFit = Pick<
  PersonalFitResult,
  | 'scholarshipId'
  | 'fitStatus'
  | 'score'
  | 'confidence'
  | 'reasonCodes'
  | 'warnings'
  | 'missingSignals'
>;

/**
 * Complete-set input for recommendation. The caller must provide all
 * filtered candidates before pagination so value normalization and top-K are
 * global. Neither LLM scores nor Home editorial fields belong in this type.
 */
export type ScholarshipRecommendationCandidate<T = unknown> = {
  id: number;
  name: string;
  deadline: string | number | null;
  benefits: readonly BenefitComponent[];
  eligibility: RecommendationEligibility | null;
  fit: RecommendationFit | null;
  value: ScholarshipValueResult | null;
  item: T;
};

export type ScholarshipRecommendationResult = {
  scholarshipId: number;
  recommended: boolean;
  recommendationScore: number | null;
  rank: number | null;
  reasonCodes: readonly RecommendationReasonCode[];
  reasonData: RecommendationReasonData;
  warnings: readonly RecommendationWarning[];
  policyVersion: string;
};

export type ScholarshipRecommendation<T = unknown> = {
  candidate: ScholarshipRecommendationCandidate<T>;
  result: ScholarshipRecommendationResult;
};

export type ScholarshipRecommendationSet<T = unknown> = {
  policyVersion: string;
  topK: number;
  recommendations: readonly ScholarshipRecommendation<T>[];
};

type CandidateScore = {
  candidate: ScholarshipRecommendationCandidate;
  fitScore: number | null;
  comparableValueScore: number | null;
  valueScore: number | null;
  valueQualityScore: number | null;
  evidenceScore: number | null;
  contributions: {
    fit: number | null;
    value: number | null;
    evidence: number | null;
  };
  recommendationScore: number | null;
};

function finite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function normalizedCurrency(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? '';
  return normalized || null;
}

function comparableCurrency(
  policy: RecommendationPolicy,
): string {
  return resolveScholarshipComparisonPolicy(policy).currency;
}

function evidenceConfidence(
  value: ScholarshipValueResult | null,
): BenefitConfidence | null {
  const included = value?.components
    .filter((component) => component.included && component.totalValue !== null)
    .map((component) => component.confidence)
    .filter((confidence): confidence is BenefitConfidence => confidence !== null) ?? [];
  if (included.length === 0) return null;
  const quality: Readonly<Record<BenefitConfidence, number>> = { high: 3, medium: 2, low: 1 };
  return included.reduce((lowest, current) =>
    quality[current] < quality[lowest] ? current : lowest,
  );
}

function rawValueScore(
  candidate: ScholarshipRecommendationCandidate,
  eligibleValues: readonly ScholarshipRecommendationCandidate[],
  currency: string | null,
): number | null {
  const comparable = candidate.value?.comparableTotalValue;
  if (!comparable || currency === null || normalizedCurrency(comparable.currency) !== currency) return null;
  const amounts = eligibleValues
    .map((item) => item.value?.comparableTotalValue)
    .filter((value): value is NonNullable<typeof value> =>
      value != null
      && normalizedCurrency(value.currency) === currency
      && finite(value.amount)
      && value.amount >= 0,
    )
    .map((value) => value.amount);
  if (amounts.length === 0 || !finite(comparable.amount) || comparable.amount < 0) return null;
  const maximum = Math.max(...amounts);
  return maximum === 0 ? 1 : round(clamp(comparable.amount / maximum));
}

function weightedScore(args: {
  fitScore: number | null;
  valueScore: number | null;
  evidenceScore: number | null;
  policy: RecommendationPolicy;
}): {
  score: number | null;
  contributions: CandidateScore['contributions'];
} {
  const dimensions = [
    { key: 'fit' as const, value: args.fitScore, weight: args.policy.weights.fit },
    { key: 'value' as const, value: args.valueScore, weight: args.policy.weights.value },
    { key: 'evidence' as const, value: args.evidenceScore, weight: args.policy.weights.evidence },
  ].filter((dimension) => dimension.value !== null);
  const denominator = dimensions.reduce((total, dimension) => total + dimension.weight, 0);
  if (denominator === 0) {
    return {
      score: null,
      contributions: { fit: null, value: null, evidence: null },
    };
  }

  const contributions: CandidateScore['contributions'] = {
    fit: null,
    value: null,
    evidence: null,
  };
  let total = 0;
  for (const dimension of dimensions) {
    const contribution = (dimension.weight / denominator) * dimension.value!;
    contributions[dimension.key] = round(contribution);
    total += contribution;
  }
  return { score: round(clamp(total) * 100), contributions };
}

function compareDeadline(left: string | number | null, right: string | number | null): number {
  const leftValue = typeof left === 'number' ? left : left ? Date.parse(left) : Infinity;
  const rightValue = typeof right === 'number' ? right : right ? Date.parse(right) : Infinity;
  const safeLeft = Number.isFinite(leftValue) ? leftValue : Infinity;
  const safeRight = Number.isFinite(rightValue) ? rightValue : Infinity;
  if (safeLeft === safeRight) return 0;
  if (safeLeft === Infinity) return 1;
  if (safeRight === Infinity) return -1;
  return safeLeft - safeRight;
}

function compareName(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' }) || left.localeCompare(right);
}

function compareScored(left: CandidateScore, right: CandidateScore): number {
  if (left.recommendationScore !== right.recommendationScore) {
    if (left.recommendationScore === null) return 1;
    if (right.recommendationScore === null) return -1;
    return right.recommendationScore - left.recommendationScore;
  }
  if (left.fitScore !== right.fitScore) {
    if (left.fitScore === null) return 1;
    if (right.fitScore === null) return -1;
    return right.fitScore - left.fitScore;
  }
  if (left.comparableValueScore !== right.comparableValueScore) {
    if (left.comparableValueScore === null) return 1;
    if (right.comparableValueScore === null) return -1;
    return right.comparableValueScore - left.comparableValueScore;
  }
  if (left.evidenceScore !== right.evidenceScore) {
    if (left.evidenceScore === null) return 1;
    if (right.evidenceScore === null) return -1;
    return right.evidenceScore - left.evidenceScore;
  }
  return compareDeadline(left.candidate.deadline, right.candidate.deadline)
    || compareName(left.candidate.name, right.candidate.name)
    || left.candidate.id - right.candidate.id;
}

function resultFor(
  scored: CandidateScore,
  policy: RecommendationPolicy,
): ScholarshipRecommendationResult {
  const reasons = deriveRecommendationReasons({
    candidate: scored.candidate,
    policy,
    fitScore: scored.fitScore,
    comparableValueScore: scored.comparableValueScore,
    valueScore: scored.valueScore,
    valueQualityScore: scored.valueQualityScore,
    evidenceScore: scored.evidenceScore,
    contributions: scored.contributions,
  });
  return {
    scholarshipId: scored.candidate.id,
    recommended: false,
    recommendationScore: scored.recommendationScore,
    rank: null,
    reasonCodes: reasons.reasonCodes,
    reasonData: reasons.reasonData,
    warnings: reasons.warnings,
    policyVersion: policy.version,
  };
}

function gatedResult(
  candidate: ScholarshipRecommendationCandidate,
  policy: RecommendationPolicy,
): CandidateScore {
  const fitScore = candidate.fit?.fitStatus === 'SCORED' && finite(candidate.fit.score)
    ? round(clamp(candidate.fit.score / 100))
    : null;
  const weighted = weightedScore({ fitScore, valueScore: null, evidenceScore: null, policy });
  return {
    candidate,
    fitScore,
    comparableValueScore: null,
    valueScore: null,
    valueQualityScore: null,
    evidenceScore: null,
    contributions: weighted.contributions,
    recommendationScore: null,
  };
}

function scoreCandidate(
  candidate: ScholarshipRecommendationCandidate,
  eligibleValues: readonly ScholarshipRecommendationCandidate[],
  currency: string | null,
  policy: RecommendationPolicy,
): CandidateScore {
  if (
    candidate.eligibility?.scholarshipId !== candidate.id
    || candidate.eligibility.status !== 'ELIGIBLE'
    || candidate.fit?.scholarshipId !== candidate.id
    || candidate.fit.fitStatus !== 'SCORED'
    || !finite(candidate.fit.score)
  ) {
    return gatedResult(candidate, policy);
  }

  const fitScore = round(clamp(candidate.fit.score / 100));
  const comparableValueScore = rawValueScore(candidate, eligibleValues, currency);
  const valueQualityScore = candidate.value?.status == null
    || comparableValueScore === null
    ? null
    : policy.valueQuality[candidate.value.status as ValueStatus];
  const valueScore = comparableValueScore === null || valueQualityScore === null
    ? null
    : round(comparableValueScore * valueQualityScore);
  const confidence = evidenceConfidence(candidate.value);
  const evidenceScore = confidence === null ? null : policy.confidenceQuality[confidence];
  const weighted = weightedScore({ fitScore, valueScore, evidenceScore, policy });
  return {
    candidate,
    fitScore,
    comparableValueScore,
    valueScore,
    valueQualityScore,
    evidenceScore,
    contributions: weighted.contributions,
    recommendationScore: weighted.score,
  };
}

function addWarning(
  result: ScholarshipRecommendationResult,
  warning: RecommendationWarning,
): ScholarshipRecommendationResult {
  if (result.warnings.some((item) => item.code === warning.code)) return result;
  return { ...result, warnings: [...result.warnings, warning] };
}

/**
 * Score and select recommendations from the complete filtered candidate set.
 * The returned array is in deterministic recommendation order and retains a
 * result for every candidate so uncertain and ineligible rows can remain
 * visible without entering the canonical top-K.
 */
export function recommendScholarships<T>(
  candidates: readonly ScholarshipRecommendationCandidate<T>[],
  policyInput: RecommendationPolicy = DEFAULT_RECOMMENDATION_POLICY,
): ScholarshipRecommendationSet<T> {
  const policy = resolveRecommendationPolicy(policyInput);
  const eligibleValues = candidates.filter((candidate) =>
    candidate.eligibility?.scholarshipId === candidate.id
    && candidate.eligibility.status === 'ELIGIBLE',
  );
  const currency = comparableCurrency(policy);
  const scored = candidates.map((candidate) =>
    scoreCandidate(candidate, eligibleValues, currency, policy),
  );
  const rankable = scored
    .filter((candidate) => candidate.recommendationScore !== null)
    .sort(compareScored);
  const recommended = rankable
    .filter((candidate) => candidate.recommendationScore! > 0)
    .slice(0, policy.topK);
  const ranks = new Map(recommended.map((candidate, index) => [candidate.candidate.id, index + 1]));

  const recommendations = [...scored].sort(compareScored).map((candidate) => {
    let result = resultFor(candidate, policy);
    const rank = ranks.get(candidate.candidate.id) ?? null;
    if (rank !== null) {
      result = { ...result, recommended: true, rank };
    } else if (candidate.recommendationScore !== null && candidate.recommendationScore > 0) {
      result = addWarning(result, {
        code: 'not-top-k',
        message: 'This candidate scored positively but fell outside the configured recommendation top-K.',
      });
    }
    return { candidate: candidate.candidate as ScholarshipRecommendationCandidate<T>, result };
  });

  return {
    policyVersion: policy.version,
    topK: policy.topK,
    recommendations,
  };
}
