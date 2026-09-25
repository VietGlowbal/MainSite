/**
 * Versioned configuration for deterministic scholarship personal-fit scoring.
 * The policy is an input to the scorer so a score can be reproduced and
 * invalidated when weights or interpretation change.
 */

export const PERSONAL_FIT_POLICY_VERSION = 'scholarship-personal-fit-v1';

export type PersonalFitPolicyWeights = {
  preferredCountry: number;
  universityPreference: number;
  selectedProgramme: number;
  subject: number;
  studyLevel: number;
  intake: number;
  fundingPreference: number;
  budget: number;
  studyMode: number;
};

export type PersonalFitPolicy = {
  version: string;
  weights: Readonly<PersonalFitPolicyWeights>;
  /** Maximum contribution from a free-text/discovery-only signal. */
  discoveryMultiplier: number;
};

export const DEFAULT_PERSONAL_FIT_POLICY: PersonalFitPolicy = {
  version: PERSONAL_FIT_POLICY_VERSION,
  weights: {
    preferredCountry: 15,
    universityPreference: 22,
    selectedProgramme: 12,
    subject: 14,
    studyLevel: 10,
    intake: 8,
    fundingPreference: 5,
    budget: 5,
    studyMode: 4,
  },
  discoveryMultiplier: 0.25,
};

export function validatePersonalFitPolicy(policy: PersonalFitPolicy): PersonalFitPolicy {
  if (!policy.version.trim()) {
    throw new Error('Personal-fit policy version must not be empty.');
  }

  const weights = Object.values(policy.weights);
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new Error('Personal-fit policy weights must be finite and non-negative.');
  }
  if (weights.every((weight) => weight === 0)) {
    throw new Error('Personal-fit policy must have at least one positive weight.');
  }
  if (
    !Number.isFinite(policy.discoveryMultiplier)
    || policy.discoveryMultiplier < 0
    || policy.discoveryMultiplier > 1
  ) {
    throw new Error('Personal-fit discovery multiplier must be between 0 and 1.');
  }

  return policy;
}

export function resolvePersonalFitPolicy(
  policy: PersonalFitPolicy | undefined,
): PersonalFitPolicy {
  return validatePersonalFitPolicy(policy ?? DEFAULT_PERSONAL_FIT_POLICY);
}
