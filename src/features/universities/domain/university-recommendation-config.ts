export const RECOMMENDATION_CONFIG = {
  version: 'university-rec-v1',
  weights: {
    subject: 0.4,
    destination: 0.2,
    studyLevel: 0.15,
    budget: 0.15,
    campus: 0.1,
  },
  dataQuality: {
    high: 0.8,
    medium: 0.5,
  },
  maxProgrammeMatches: 3,
  // V1 does not have a repository-backed freshness SLA. Missing/invalid
  // timestamps are surfaced as unknown instead of being classified with an
  // arbitrary age threshold.
  staleAfterDays: null,
  programmeEvidenceMultipliers: {
    trusted: 1,
    review: 0.85,
    unknown: 0.7,
  },
} as const;

export type RecommendationConfig = typeof RECOMMENDATION_CONFIG;
