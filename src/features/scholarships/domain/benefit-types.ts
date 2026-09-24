/**
 * Evidence-bearing scholarship benefit contracts.
 *
 * These types describe what the source says. They intentionally do not
 * calculate a total value or convert currencies; those rules belong to the
 * valuation domain. A component can therefore carry a percentage, a money
 * range, or a coverage fact without pretending that a comparable amount is
 * already known.
 */

export const BENEFIT_TYPES = [
  'tuition',
  'living',
  'accommodation',
  'stipend',
  'meals',
  'travel',
  'insurance',
  'books-materials',
  'other',
] as const;

export type BenefitType = (typeof BENEFIT_TYPES)[number];

export const BENEFIT_PERIODS = [
  'unspecified',
  'one-time',
  'monthly',
  'annual',
  'term',
] as const;

export type BenefitPeriod = (typeof BENEFIT_PERIODS)[number];

export type BenefitDurationUnit = 'month' | 'year' | 'term';

export type BenefitDuration = {
  count: number;
  unit: BenefitDurationUnit;
  /** T1 only accepts duration stated in the benefit evidence. */
  basis: 'explicit';
  rawText: string;
};

export type BenefitCoverage = 'full' | 'partial' | 'included' | 'unspecified';

export type BenefitValueKind = 'fixed' | 'range' | 'percentage' | 'coverage' | 'unknown';

export type BenefitCurrencyStatus = 'known' | 'unknown';

export type BenefitAmount = {
  min: number;
  max: number | null;
  /** Unknown currencies are retained here and are never replaced with USD. */
  currency: string | null;
  currencyStatus: BenefitCurrencyStatus;
};

export type BenefitPercentage = {
  min: number;
  max: number | null;
};

export type BenefitConfidence = 'high' | 'medium' | 'low';

export type BenefitEvidenceSourceField =
  | 'coverage'
  | 'amount'
  | 'funding_type'
  | 'conditions'
  | 'insight'
  | 'raw';

export type BenefitEvidence = {
  sourceType: 'catalogue-field';
  sourceField: BenefitEvidenceSourceField;
  /** The smallest source excerpt that supports this component. */
  excerpt: string;
  sourceUrl: string | null;
};

export type BenefitComponent = {
  type: BenefitType;
  coverage: BenefitCoverage;
  valueKind: BenefitValueKind;
  amount: BenefitAmount | null;
  percentage: BenefitPercentage | null;
  period: BenefitPeriod;
  duration: BenefitDuration | null;
  /** Null means this component is not part of an exclusive scenario. */
  scenarioKey: string | null;
  mutuallyExclusive: boolean;
  evidence: BenefitEvidence[];
  confidence: BenefitConfidence;
};

export type BenefitScenario = {
  key: string;
  label: string;
  mutuallyExclusive: true;
  evidence: BenefitEvidence[];
};

export type FullRideStatus = 'supported' | 'claimed-unverified' | 'not-claimed';

export type ScholarshipBenefitClassification = {
  /** A supported full-ride claim or complete component set; never inferred from 100% tuition alone. */
  label: 'full-ride' | 'full-ride-claim' | 'tuition-only' | 'fully-funded' | 'partial' | 'mixed' | 'unknown';
  tuitionCoverage: 'full' | 'partial' | 'unspecified' | 'none';
  fullRideStatus: FullRideStatus;
  fullRideClaimed: boolean;
  fullyFundedClaimed: boolean;
  nonTuitionTypes: BenefitType[];
};

export type BenefitNormalizationWarningCode =
  | 'full-ride-unverified'
  | 'fully-funded-ambiguous'
  | 'unknown-currency'
  | 'ambiguous-amount'
  | 'mutually-exclusive-scenarios';

export type BenefitNormalizationWarning = {
  code: BenefitNormalizationWarningCode;
  message: string;
};

/** Raw values are retained alongside normalized components for auditability. */
export type ScholarshipBenefitRaw = {
  coverage: string | null;
  amountMin: number | null;
  amountMax: number | null;
  amountCurrency: string | null;
  fundingType: string[];
  sourceUrl: string | null;
  fields: Record<string, unknown>;
};

export type NormalizedScholarshipBenefits = {
  components: BenefitComponent[];
  scenarios: BenefitScenario[];
  classification: ScholarshipBenefitClassification;
  raw: ScholarshipBenefitRaw;
  warnings: BenefitNormalizationWarning[];
};

/**
 * Accept both the camel-case domain adapter shape and the existing persisted
 * scholarship field names. This lets callers normalize a DB row without
 * changing the DB contract or copying raw values into a new schema column.
 */
export type ScholarshipBenefitNormalizationInput = {
  coverage?: string | null;
  amountMin?: number | null;
  amountMax?: number | null;
  amountCurrency?: string | null;
  fundingType?: readonly string[] | null;
  sourceUrl?: string | null;
  raw?: Record<string, unknown> | null;

  amount_min?: number | null;
  amount_max?: number | null;
  amount_currency?: string | null;
  funding_type?: readonly string[] | null;
  source_url?: string | null;
};
