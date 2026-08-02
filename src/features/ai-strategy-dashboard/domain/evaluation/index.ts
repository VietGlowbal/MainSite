/**
 * The Shared Evaluation Engine (F1–F6).
 *
 * One evaluation of a student that every AI surface reads from, so the Report,
 * the Feedback, the Strategy and the Breakdown cannot contradict each other
 * about the same profile. See `framework.ts` for the pipeline and for which
 * frameworks need a model and which are derived.
 */

export {
  CONFIDENCE_LABEL,
  FRAMEWORKS,
  FRAMEWORK_META,
  confidenceFromCoverage,
} from './framework';
export type { Confidence, FrameworkId, FrameworkMeta } from './framework';

export {
  ACTIVITY_EVIDENCE_UNSUPPORTED,
  EVIDENCE_REACH_LABEL,
  EVIDENCE_TIER_LABEL,
  buildEvidenceProfile,
  parseReach,
  tierFor,
} from './evidence';
export type {
  EvidenceInput,
  EvidenceItem,
  EvidenceProfile,
  EvidenceReach,
  EvidenceTier,
} from './evidence';

export { VAGUENESS_REASON_LABEL, runVaguenessGate } from './vagueness';
export type {
  VaguenessField,
  VaguenessFinding,
  VaguenessReason,
  VaguenessReport,
  VaguenessSeverity,
} from './vagueness';

export { COMPETENCY_ORDER, buildCompetencyProfile } from './competency';
export type { Competency, CompetencyKey, CompetencyProfile } from './competency';

export { buildProgrammeFit } from './programme-fit';
export type {
  ProgrammeFacts,
  ProgrammeFit,
  RequirementRow,
  UniversityFacts,
} from './programme-fit';

export {
  EMPTY_NARRATIVE,
  PORTRAIT_SECTIONS,
  availablePortraitSections,
  sectionHasContent,
} from './reflection';
export type { NarrativeProfile, PortraitSectionKey, PortraitSectionMeta } from './reflection';

export { lowestConfidence, runEvaluation } from './engine';
export type { EvaluationInput, EvaluationResult } from './engine';
