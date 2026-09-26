import {
  normalizeSupportedCurrency,
  type SupportedCurrency,
} from './currency';

/** Bump whenever the target currency or its interpretation changes. */
export const SCHOLARSHIP_COMPARISON_POLICY_VERSION = 'scholarship-comparison-v1';

export type ScholarshipComparisonPolicy = {
  version: string;
  currency: SupportedCurrency;
};

/** USD is explicit product policy, never an inference for an unknown source. */
export const DEFAULT_SCHOLARSHIP_COMPARISON_POLICY: ScholarshipComparisonPolicy = {
  version: SCHOLARSHIP_COMPARISON_POLICY_VERSION,
  currency: 'USD',
};

export type ComparisonPolicyInput = {
  comparisonPolicy?: ScholarshipComparisonPolicy | null;
  /** Compatibility input for existing callers; production uses comparisonPolicy. */
  comparisonCurrency?: string | null;
};

export function validateScholarshipComparisonPolicy(
  policy: ScholarshipComparisonPolicy,
): ScholarshipComparisonPolicy {
  if (!policy.version.trim()) throw new Error('Scholarship comparison policy version is required.');
  const currency = normalizeSupportedCurrency(policy.currency);
  if (!currency) throw new Error(`Unsupported scholarship comparison currency: ${String(policy.currency)}.`);
  return { ...policy, currency };
}

export function resolveScholarshipComparisonPolicy(
  input?: ComparisonPolicyInput | null,
): ScholarshipComparisonPolicy {
  if (input?.comparisonCurrency !== undefined && input.comparisonCurrency !== null) {
    const currency = normalizeSupportedCurrency(input.comparisonCurrency);
    if (!currency) throw new Error(`Unsupported scholarship comparison currency: ${input.comparisonCurrency}.`);
    return {
      version: `${SCHOLARSHIP_COMPARISON_POLICY_VERSION}-compat-${currency.toLowerCase()}`,
      currency,
    };
  }
  return validateScholarshipComparisonPolicy(
    input?.comparisonPolicy ?? DEFAULT_SCHOLARSHIP_COMPARISON_POLICY,
  );
}
