/**
 * @deprecated Compatibility barrel for callers that still use the old module
 * path. University matches are now preference recommendations; this module no
 * longer contains tier or admission semantics.
 */
export {
  normalizeBudget,
  normalizeRecommendationProfile,
  normalizeStudyLevel,
  rankUniversityRecommendations,
  recommendationProfileHasPreferences,
} from './university-recommendation';
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
  RecommendationConfig,
  RecommendationDimension,
  RecommendationProgramme,
  RecommendationProfile,
  RecommendationResponse,
  RecommendationResult,
  RecommendationStatus,
  RecommendationUniversity,
} from './university-recommendation';
