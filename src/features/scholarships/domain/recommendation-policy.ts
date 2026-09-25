import type { BenefitConfidence } from './benefit-types';
import type { ValueStatus } from './valuation';

/**
 * Versioned configuration for the canonical GlowBal recommendation pass.
 *
 * These weights are defaults, not product truth. Callers can inject a
 * reviewed policy and the policy version is returned with every result so a
 * ranking can be reproduced and invalidated safely.
 */
export const GLOWBAL_RECOMMENDATION_POLICY_VERSION = 'glowbal-recommendation-v1';

export type RecommendationPolicyWeights = {
  fit: number;
  value: number;
  evidence: number;
};

export type RecommendationPolicy = {
  version: string;
  topK: number;
  /** Optional target for already-converted T2A comparable values. */
  comparisonCurrency?: string | null;
  weights: Readonly<RecommendationPolicyWeights>;
  /** Quality multiplier applied to a comparable value before weighting it. */
  valueQuality: Readonly<Record<ValueStatus, number>>;
  /** Source/evidence confidence is a separate scoring dimension. */
  confidenceQuality: Readonly<Record<BenefitConfidence, number>>;
  /** Normalized value at or above this threshold gets a financial-value reason. */
  strongValueThreshold: number;
};

export const DEFAULT_RECOMMENDATION_POLICY: RecommendationPolicy = {
  version: GLOWBAL_RECOMMENDATION_POLICY_VERSION,
  topK: 3,
  comparisonCurrency: null,
  weights: {
    fit: 0.55,
    value: 0.25,
    evidence: 0.2,
  },
  valueQuality: {
    EXACT: 1,
    MIXED: 0.75,
    ESTIMATED: 0.5,
  },
  confidenceQuality: {
    high: 1,
    medium: 0.65,
    low: 0.35,
  },
  strongValueThreshold: 0.75,
};

function finiteBetween(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

/** Validate an injected policy before it can affect canonical ordering. */
export function validateRecommendationPolicy(
  policy: RecommendationPolicy,
): RecommendationPolicy {
  if (!policy.version.trim()) {
    throw new Error('Recommendation policy version must not be empty.');
  }
  if (!Number.isInteger(policy.topK) || policy.topK < 0) {
    throw new Error('Recommendation policy topK must be a non-negative integer.');
  }

  const weights = Object.values(policy.weights);
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new Error('Recommendation policy weights must be finite and non-negative.');
  }
  if (weights.every((weight) => weight === 0)) {
    throw new Error('Recommendation policy must have at least one positive weight.');
  }

  const valueQuality = [
    policy.valueQuality.EXACT,
    policy.valueQuality.MIXED,
    policy.valueQuality.ESTIMATED,
  ];
  if (valueQuality.some((quality) => !finiteBetween(quality, 0, 1))) {
    throw new Error('Recommendation value-quality multipliers must be between 0 and 1.');
  }
  if (
    policy.valueQuality.EXACT < policy.valueQuality.MIXED
    || policy.valueQuality.MIXED < policy.valueQuality.ESTIMATED
  ) {
    throw new Error('Recommendation value quality must not reward estimates above exact values.');
  }

  const confidenceQuality = [
    policy.confidenceQuality.high,
    policy.confidenceQuality.medium,
    policy.confidenceQuality.low,
  ];
  if (confidenceQuality.some((quality) => !finiteBetween(quality, 0, 1))) {
    throw new Error('Recommendation confidence multipliers must be between 0 and 1.');
  }
  if (
    policy.confidenceQuality.high < policy.confidenceQuality.medium
    || policy.confidenceQuality.medium < policy.confidenceQuality.low
  ) {
    throw new Error('Recommendation confidence quality must be monotonic.');
  }
  if (!finiteBetween(policy.strongValueThreshold, 0, 1)) {
    throw new Error('Recommendation strong-value threshold must be between 0 and 1.');
  }

  return policy;
}

export function resolveRecommendationPolicy(
  policy: RecommendationPolicy | undefined,
): RecommendationPolicy {
  return validateRecommendationPolicy(policy ?? DEFAULT_RECOMMENDATION_POLICY);
}
