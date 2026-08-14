/**
 * The GlowBal Shared Evaluation Engine (F1-F6).
 */

export {
  FRAMEWORKS,
  confidenceFromCoverage,
  lowestConfidence,
  makeInsight,
} from './types';
export type { Confidence, EvidenceRef, FrameworkId, Insight, ObservationKind } from './types';

export { weightedScore } from './weighted-score';
export type { WeightedMetric, WeightedScoreResult } from './weighted-score';

export { VAGUENESS_REASON_LABEL, runVaguenessGate } from './f6-vagueness';
export type {
  VaguenessField,
  VaguenessFinding,
  VaguenessReason,
  VaguenessReport,
  VaguenessSeverity,
} from './f6-vagueness';

export {
  EMPTY_CMCAITF,
  REFLECTION_METRIC_WEIGHTS,
  buildReflectionProfile,
  scoreReflection,
} from './f1-reflection';
export type {
  CmcaitfFields,
  ReflectionMetricKey,
  ReflectionProfile,
  ReflectionRecord,
  ReflectionScore,
} from './f1-reflection';

export {
  COMPETENCY_TYPE_WEIGHT,
  buildCompetencyProfile,
  scoreCompetencyClaim,
} from './f2-competency';
export type {
  CompetencyCategoryResult,
  CompetencyClaim,
  CompetencyProfile,
  CompetencyScore,
  CompetencyType,
} from './f2-competency';

export {
  EVIDENCE_METRIC_WEIGHTS,
  EVIDENCE_REACH_LABEL,
  EVIDENCE_TIER_LABEL,
  buildEvidenceProfile,
  parseReach,
  scoreEvidenceItem,
  tierFor,
} from './f3-evidence';
export type {
  EvidenceItem,
  EvidenceItemInput,
  EvidenceMetricKey,
  EvidenceProfile,
  EvidenceReach,
  EvidenceSourceKind,
  EvidenceTier,
} from './f3-evidence';

export {
  NARRATIVE_METRIC_WEIGHTS,
  THEME_MATURITY_LABEL,
  assessApplicantPositioning,
  assessMotivationConsistency,
  assessThemeMaturity,
  buildEvidenceToIdentityMap,
  extractBehavioralPattern,
  scoreNarrativeBase,
  synthesisReadiness,
  synthesizeIdentity,
} from './f4-narrative-identity';
export type {
  ApplicantPositioning,
  BehavioralPatternResult,
  EvidenceStrength,
  IdentityProof,
  IdentitySynthesis,
  MotivationConsistency,
  MotivationStatus,
  NarrativeActivity,
  NarrativeBaseMetrics,
  NarrativeMetricKey,
  PositioningStatus,
  SignaturePattern,
  SynthesisReadiness,
  ThemeMaturityResult,
  ThemeMaturityStatus,
} from './f4-narrative-identity';

export { scoreNarrativeBaseFaithful } from './f4-quality';
export { assessMotivationConsistencyWithProfile } from './profile-motivation';
export type { ProfileMotivation } from './profile-motivation';

export { F5_DIMENSION_KEYS, buildProgrammeFitPlaceholder } from './f5-programme-fit';
export type {
  F5Dimension,
  F5DimensionKey,
  F5DimensionStatus,
  ProgrammeFitClassification,
  ProgrammeFitEligibility,
  ProgrammeFitResult,
} from './f5-programme-fit';

export { runProfileEvaluation } from './engine';
export type { F4Result, ProfileEvaluation, ProfileEvaluationInput } from './engine';

export { ENGINE_VERSION, shouldRegenerate } from './versioning';
export type { StoredEvaluationStamp } from './versioning';
