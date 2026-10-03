/**
 * Public API of the scholarships feature.
 *
 * Everything another slice is allowed to use is re-exported here. Deep imports
 * past this barrel are a lint error — see eslint.config.mjs.
 */
export * from './api';
export {
  parseScholarshipSearchParams,
  scholarshipSearchParams,
  SCHOLARSHIP_DEGREES,
  SCHOLARSHIP_DEADLINE_FILTERS,
  SCHOLARSHIP_FUNDING,
  SCHOLARSHIP_MAJORS,
  SCHOLARSHIP_SORTS,
  SCHOLARSHIP_VIEWS,
} from './domain/query-state';
export type {
  ScholarshipDeadlineFilter,
  ScholarshipDegree,
  ScholarshipFunding,
  ScholarshipMajor,
  ScholarshipQueryState,
  ScholarshipSort,
  ScholarshipView,
} from './domain/query-state';
export {
  evaluateScholarshipEligibility,
  matchScholarshipDirectoryFilters,
  SCHOLARSHIP_ELIGIBILITY_POLICY_VERSION,
} from './domain/eligibility';
export {
  normalizeScholarshipDirectoryFilters,
  normalizeScholarshipEligibility,
  SCHOLARSHIP_ELIGIBILITY_NORMALIZER_VERSION,
} from './domain/eligibility-normalization';
export { scorePersonalFit } from './domain/personal-fit';
export { recommendScholarships } from './domain/recommendation';
export {
  DEFAULT_RECOMMENDATION_POLICY,
  GLOWBAL_RECOMMENDATION_POLICY_VERSION,
  resolveRecommendationPolicy,
  validateRecommendationPolicy,
} from './domain/recommendation-policy';
export {
  paginateRanked,
  rankScholarships,
  scholarshipRankingCacheKey,
  SCHOLARSHIP_BENEFIT_NORMALIZER_VERSION,
  SCHOLARSHIP_QUERY_VERSION,
  SCHOLARSHIP_RANKING_VERSION,
  SCHOLARSHIP_VALUATION_VERSION,
} from './domain/ranking';
export {
  commonComparableCurrency,
  compareScholarshipValues,
  valueSortInputFromResult,
  SCHOLARSHIP_VALUE_SORT_VERSION,
} from './domain/value-sort';
export {
  DEFAULT_PERSONAL_FIT_POLICY,
  PERSONAL_FIT_POLICY_VERSION,
  resolvePersonalFitPolicy,
  validatePersonalFitPolicy,
} from './domain/personal-fit-policy';
export type {
  EligibilityCheck,
  EligibilityCheckStatus,
  EligibilityEvidence,
  EligibilityReasonCode,
  EligibilityRequirementState,
  EligibilitySignal,
  EligibilityStatus,
  EligibilityWarning,
  EligibilityWarningCode,
  EvaluateScholarshipEligibilityInput,
  ScholarshipDirectoryCandidate,
  ScholarshipDirectoryFilterInput,
  ScholarshipDirectoryFilterMatch,
  ScholarshipDirectoryFilters,
  ScholarshipEligibilityPolicy,
  ScholarshipEligibilityResult,
} from './domain/eligibility';
export type {
  DirectoryDeadlineFilter,
  DirectoryValueFilter,
  EligibilityEvidenceField,
  EligibilityNormalizationWarning,
  EligibilityNormalizationWarningCode,
  IntakeSeason,
  NormalizedAcademicRequirement,
  NormalizedAcademicTestRequirement,
  NormalizedDeadlineRequirement,
  NormalizedInstitutionRequirement,
  NormalizedIntakeRequirement,
  NormalizedNationalityRequirement,
  NormalizedScholarshipEligibility,
  NormalizedTextRequirement,
} from './domain/eligibility-normalization';
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
} from './domain/personal-fit';
export type {
  PersonalFitPolicy,
  PersonalFitPolicyWeights,
} from './domain/personal-fit-policy';
export type {
  RecommendationEligibility,
  RecommendationFit,
  ScholarshipRecommendation,
  ScholarshipRecommendationCandidate,
  ScholarshipRecommendationResult,
  ScholarshipRecommendationSet,
} from './domain/recommendation';
export type {
  RecommendationPolicy,
  RecommendationPolicyWeights,
} from './domain/recommendation-policy';
export type {
  RecommendationReasonCode,
  RecommendationReasonData,
  RecommendationReasonResult,
  RecommendationWarning,
  RecommendationWarningCode,
} from './domain/recommendation-reasons';
export type {
  RankedPage,
  ScholarshipRankingCacheKeyInput,
  ScholarshipRankingCandidate,
  ScholarshipRankingPolicy,
  ScholarshipRankingSort,
} from './domain/ranking';
export type {
  ScholarshipValueSortInput,
  ValueSortCandidate,
  ValueSortDirection,
} from './domain/value-sort';
export {
  scholarshipSaveDestination,
  type ScholarshipSaveDestination,
} from './domain/save-destination';
export {
  normalizeScholarshipBenefits,
} from './domain/benefit-normalization';
export {
  calculateScholarshipValue,
} from './domain/valuation';
export {
  durationInMonths,
  periodMultiplier,
  resolveScholarshipDuration,
} from './domain/duration';
export {
  COST_REFERENCE_LEVELS,
  createCostReferenceProvider,
  parseCostReferenceDataset,
} from './domain/cost-reference';
export {
  createFxReferenceProvider,
  parseFxReferenceDataset,
} from './domain/fx-reference';
export {
  aggregateFrequentlyPicked,
  DEFAULT_FREQUENTLY_PICKED_POLICY,
  DEFAULT_FREQUENTLY_PICKED_THRESHOLD,
  FREQUENTLY_PICKED_POLICY_VERSION,
  normalizeFrequentlyPickedScholarshipIds,
  validateFrequentlyPickedPolicy,
} from './domain/frequently-picked';
export type {
  FrequentlyPickedAggregate,
  FrequentlyPickedPolicy,
  FrequentlyPickedRow,
  FrequentlyPickedSummary,
} from './domain/frequently-picked';
export {
  buildScholarshipMatchingContext,
  scholarshipMatchingContextCacheKey,
  SCHOLARSHIP_MATCHING_CONTEXT_VERSION,
} from './domain/matching-context';
export {
  BENEFIT_PERIODS,
  BENEFIT_TYPES,
} from './domain/benefit-types';
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
} from './domain/benefit-types';
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
} from './domain/valuation';
export type {
  DurationContext,
  DurationInput,
  DurationSource,
  DurationValue,
  ResolvedDuration,
} from './domain/duration';
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
} from './domain/cost-reference';
export type {
  FxRateRecord,
  FxRateResolution,
  FxReferenceCoverage,
  FxReferenceDataset,
  FxReferenceDiagnostic,
  FxReferenceDiagnosticCode,
  FxReferenceProvider,
} from './domain/fx-reference';
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
} from './domain/matching-context';
