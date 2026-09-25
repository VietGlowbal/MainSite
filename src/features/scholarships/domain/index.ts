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
export {
  COST_REFERENCE_LEVELS,
  createCostReferenceProvider,
  parseCostReferenceDataset,
} from './cost-reference';
export { createFxReferenceProvider, parseFxReferenceDataset } from './fx-reference';
export {
  buildScholarshipMatchingContext,
  scholarshipMatchingContextCacheKey,
  SCHOLARSHIP_MATCHING_CONTEXT_VERSION,
} from './matching-context';
export {
  evaluateScholarshipEligibility,
  matchScholarshipDirectoryFilters,
  SCHOLARSHIP_ELIGIBILITY_POLICY_VERSION,
} from './eligibility';
export {
  normalizeScholarshipDirectoryFilters,
  normalizeScholarshipEligibility,
  SCHOLARSHIP_ELIGIBILITY_NORMALIZER_VERSION,
} from './eligibility-normalization';
export { scorePersonalFit } from './personal-fit';
export {
  DEFAULT_PERSONAL_FIT_POLICY,
  PERSONAL_FIT_POLICY_VERSION,
  resolvePersonalFitPolicy,
  validatePersonalFitPolicy,
} from './personal-fit-policy';
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
export type {
  CostReferenceAttempt,
  CostReferenceContext,
  CostReferenceCoverage,
  CostReferenceDataset,
  CostReferenceDiagnostic,
  CostReferenceDiagnosticCode,
  CostReferenceLevel,
  CostReferenceLookup,
  CostReferenceProvider,
  CostReferenceRecord,
  CostReferenceResolution,
} from './cost-reference';
export type {
  FxRateRecord,
  FxRateResolution,
  FxReferenceCoverage,
  FxReferenceDataset,
  FxReferenceDiagnostic,
  FxReferenceDiagnosticCode,
  FxReferenceProvider,
} from './fx-reference';
export type {
  AcademicAchievementSource,
  AcademicActivitySource,
  EnglishTestSource,
  MatchingAcademicEvidence,
  MatchingApplicationContext,
  MatchingApplicationSource,
  MatchingContextDiagnostic,
  MatchingContextRequest,
  MatchingContextSources,
  MatchingProgrammeContext,
  MatchingProgrammeSource,
  MatchingProfileSource,
  MatchingProvenance,
  MatchingRead,
  MatchingReadStatus,
  MatchingSavedUniversityContext,
  MatchingScholarshipContext,
  MatchingScholarshipSource,
  MatchingSourceKind,
  MatchingStudentContext,
  MatchingUniversityContext,
  MatchingUniversitySource,
  ScholarshipMatchingContext,
  SavedUniversitySource,
  StandardizedTestSource,
} from './matching-context';
export type {
  EligibilityCheck,
  EligibilityCheckStatus,
  EligibilityReasonCode,
  EligibilitySignal,
  EligibilityStatus,
  EligibilityWarning,
  EligibilityWarningCode,
  EvaluateScholarshipEligibilityInput,
  ScholarshipDirectoryCandidate,
  ScholarshipDirectoryFilterMatch,
  ScholarshipDirectoryFilters,
  ScholarshipEligibilityPolicy,
  ScholarshipEligibilityResult,
} from './eligibility';
export type {
  DirectoryDeadlineFilter,
  DirectoryValueFilter,
  EligibilityEvidence,
  EligibilityEvidenceField,
  EligibilityNormalizationWarning,
  EligibilityNormalizationWarningCode,
  EligibilityRequirementState,
  IntakeSeason,
  NormalizedAcademicRequirement,
  NormalizedAcademicTestRequirement,
  NormalizedDeadlineRequirement,
  NormalizedInstitutionRequirement,
  NormalizedIntakeRequirement,
  NormalizedNationalityRequirement,
  NormalizedScholarshipEligibility,
  NormalizedTextRequirement,
  ScholarshipDirectoryFilterInput,
} from './eligibility-normalization';
export type {
  PersonalFitReasonCode,
  PersonalFitReasonData,
  PersonalFitResult,
  PersonalFitSignal,
  PersonalFitStatus,
  PersonalFitValue,
  PersonalFitWarning,
  PersonalFitWarningCode,
  ScorePersonalFitInput,
} from './personal-fit';
export type {
  PersonalFitPolicy,
  PersonalFitPolicyWeights,
} from './personal-fit-policy';
