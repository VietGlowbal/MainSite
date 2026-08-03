/**
 * apply — domain logic.
 *
 * Pure functions and types: no I/O, no React, no framework imports. Everything
 * here must be unit-testable without a database or a DOM.
 */
export {
  ACHIEVEMENT_CATEGORIES,
  ACTIVITY_CATEGORIES,
  EDUCATION_LEVELS,
  FUNDING_SOURCES,
  INTENDED_LEVELS,
  TUITION_BUDGETS_USD,
  aboutYouSchema,
  achievementSchema,
  activitySchema,
  aspirationsSchema,
  evidenceSchema,
  profileUpdateFromReflection,
  reflectionCompleteness,
  reflectionFromProfile,
  reflectionSchema,
} from './reflection';
export { AI_JOURNEY, AI_JOURNEY_STEPS, aiJourneySteps } from './ai-journey';
export type { AiJourneyStep } from './ai-journey';
export {
  REFLECTION_STEPS,
  REFLECTION_STEP_COUNT,
  reflectionProgress,
  reflectionStep,
} from './reflection-steps';
export type { ReflectionStepKey } from './reflection-steps';
export {
  courseUrlLabel,
  displayCourseName,
  displayUniversityName,
  isParsePending,
} from './course-name';
export { activeStageIndex, stageProgressLabel, summariseTasks } from './progress';
export type { TaskCounts } from './progress';
export { deadlineUrgency } from './deadline';
export type { DeadlineTone, DeadlineUrgency } from './deadline';
export type {
  AboutYouValues,
  AchievementCategory,
  AchievementValues,
  ActivityCategory,
  ActivityValues,
  AspirationsValues,
  ReflectionProfileRow,
  ReflectionValues,
} from './reflection';
export {
  applyEvidenceCandidates,
  evidenceCandidateSchema,
  evidenceExtractionResponseSchema,
  validateEvidenceExtraction,
} from './reflection-extraction';
export type {
  EvidenceCandidate,
  EvidenceExtractionResponse,
  EvidenceSourcePage,
} from './reflection-extraction';
export {
  MATCH_PROMPT_VERSION_V2,
  REPORT_PROMPT_VERSION,
  candidateConfidence,
  canonicalize,
  enforceFitClassification,
  hydratePersonalReport,
  personalReportDraftSchema,
  personalReportSchema,
  programmeFitSchema,
} from './ai-reports';
export type {
  CandidateContext,
  EvidenceKind,
  EvidenceRef,
  PersonalReport,
  PersonalReportDraft,
  ProgrammeFit,
  MatchingAnalysisView,
  MatchingApplicationSummary,
  MatchingReportPageData,
} from './ai-reports';
