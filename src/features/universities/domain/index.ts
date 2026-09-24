/**
 * universities — domain logic.
 *
 * Pure functions and types: no I/O, no React, no framework imports. Everything
 * here must be unit-testable without a database or a DOM.
 */
export {
  formatAcceptanceForCard,
  formatDeadlineLabel,
  formatTuitionForCard,
  formatUsdCompact,
  formatUsdOne,
  parseAcceptanceRate,
  parseDeadline,
  parseTuition,
  parseTuitionRange,
} from './formatting';

export { leadFragment, splitList } from './highlights';

export {
  attachedOptions,
  bestCoveragePercent,
  scholarshipCandidates,
  scholarshipLabel,
} from './saved-list';
export type {
  CoverageLike,
  SavedListScholarship,
  SavedListUniversity,
  ScholarshipCandidate,
} from './saved-list';

export { courseNameFromUrl, filterOptions, isCourseUrl, optionsForGroup, programChoices } from './programs';
export type {
  CatalogueEntry,
  ProgramChoices,
  ProgramGroup,
  ProgramOption,
} from './programs';

export {
  amountToUsd,
  computeNetTuition,
  parseCoveragePercent,
  type NetTuition,
  type ScholarshipLike,
} from './pricing';

export { countriesMatch, normalizeCountryName } from './country';

export { officialWebsite } from './websites';

export {
  normaliseUniversityName,
  pickBestMatch,
  registrableDomain,
  sameDomain,
} from './match-university';
export type {
  MatchQuery,
  MatchReason,
  UniversityCandidate,
  UniversityMatch,
} from './match-university';

export {
  deriveRecommendationBand,
  deriveSelectivityContext,
  isMeaningfulRecommendation,
  normalizeBudget,
  normalizeRecommendationProfile,
  normalizeStudyLevel,
  programmeVerificationConfidence,
  rankUniversityRecommendations,
  recommendationProfileHasPreferences,
} from './university-recommendation';
export { RECOMMENDATION_CONFIG, RECOMMENDATION_UI_CONFIG } from './university-recommendation-config';
export { demoUniversityMatches } from './university-matching-demo';
export type {
  CanonicalStudyLevel,
  DataQuality,
  DimensionEvaluation,
  EvidenceState,
  RecommendationReason,
  MatchReasonCode,
  MatchWarning,
  MatchWarningCode,
  NormalizedBudget,
  ProgrammeMatch,
  ProgrammeVerificationConfidence,
  RecommendationConfig,
  RecommendationBand,
  RecommendationBandInput,
  RecommendationDimension,
  RecommendationProgramme,
  RecommendationProfile,
  RecommendationResponse,
  RecommendationResult,
  RecommendationStatus,
  RecommendationUniversity,
  SelectivityContext,
} from './university-recommendation';
