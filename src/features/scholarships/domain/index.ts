/**
 * scholarships — domain logic.
 *
 * Pure functions and types: no I/O, no React, no framework imports. Everything
 * here must be unit-testable without a database or a DOM.
 */
export { scorePersonalMatch } from './personal-match';
export { scholarshipSaveDestination } from './save-destination';
export { normalizeScholarshipBenefits } from './benefit-normalization';
export { calculateScholarshipValue } from './valuation';
export { durationInMonths, periodMultiplier, resolveScholarshipDuration } from './duration';
export { BENEFIT_PERIODS, BENEFIT_TYPES } from './benefit-types';
export type {
  BenefitAmount,
  BenefitComponent,
  BenefitConfidence,
  BenefitCoverage,
  BenefitCurrencyStatus,
  BenefitDuration,
  BenefitDurationUnit,
  BenefitEvidence,
  BenefitEvidenceSourceField,
  BenefitNormalizationWarning,
  BenefitNormalizationWarningCode,
  BenefitPercentage,
  BenefitPeriod,
  BenefitScenario,
  BenefitType,
  BenefitValueKind,
  FullRideStatus,
  NormalizedScholarshipBenefits,
  ScholarshipBenefitClassification,
  ScholarshipBenefitNormalizationInput,
  ScholarshipBenefitRaw,
} from './benefit-types';
export type { ScholarshipSaveDestination } from './save-destination';
export type {
  CalculateScholarshipValueInput,
  ComparableTotalValue,
  CostSource,
  CostSourceResolver,
  FxProvider,
  MonetaryValue,
  ScholarshipValueResult,
  SourceValueStatus,
  TuitionSource,
  ValuedBenefitComponent,
  ValuationPeriod,
  ValuationPolicy,
  ValueStatus,
} from './valuation';
export type {
  DurationContext,
  DurationInput,
  DurationSource,
  DurationValue,
  ResolvedDuration,
} from './duration';
