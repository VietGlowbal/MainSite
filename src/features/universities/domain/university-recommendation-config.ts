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
  // Product heuristics, not calibrated probabilities. These absolute gates
  // keep a result's presentation band stable when unrelated universities are
  // added to the catalogue.
  recommendationBands: {
    topPick: {
      minActiveDimensions: 3,
      minRankingScore: 0.65,
      minPositiveEvidence: 0.65,
      maxNegativeEvidence: 0.15,
    },
    goodFit: {
      minActiveDimensions: 2,
      minRankingScore: 0.4,
      minPositiveEvidence: 0.4,
      maxNegativeEvidence: 0.35,
    },
    worthExploring: {
      minActiveDimensions: 1,
      minPositiveEvidence: 0.15,
      maxNegativeEvidence: 0.65,
    },
  },
  // Conservative, general-admissions context only. Values are acceptance-rate
  // percentages, not estimates of an individual student's admission chance.
  selectivity: {
    highlySelectiveMaxAcceptanceRate: 10,
    selectiveMaxAcceptanceRate: 35,
  },
} as const;

export type RecommendationConfig = typeof RECOMMENDATION_CONFIG;

export const RECOMMENDATION_UI_CONFIG = {
  initialVisibleResults: 12,
  loadMoreIncrement: 12,
} as const;
