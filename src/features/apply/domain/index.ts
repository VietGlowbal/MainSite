/**
 * apply â€” domain logic.
 *
 * Pure functions and types: no I/O, no React, no framework imports. Everything
 * here must be unit-testable without a database or a DOM.
 */
export {
  ACHIEVEMENT_CATEGORIES,
  ACTIVITY_CATEGORIES,
  EDUCATION_LEVELS,
  EDUCATION_LEVEL_META,
  INTAKE_TERMS,
  INTENDED_LEVELS,
  REVIEW_STATUSES,
  TUITION_BUDGETS_USD,
  VND_PER_USD,
  aboutYouSchema,
  achievementSchema,
  activitySchema,
  aspirationsSchema,
  evidenceSchema,
  evidenceSourceSchema,
  parseBudgetBand,
  personalReflectionSectionSchema,
  profileUpdateFromReflection,
  reflectionCompleteness,
  reflectionFromProfile,
  reflectionSchema,
  usdBandFromVndRange,
  vndRangeFromUsdBand,
} from './reflection';
export {
  STUDY_LEVELS,
  STUDY_LEVEL_LABELS,
  studyLevelFromStored,
  studyLevelLabel,
} from './study-level';
export type { StudyLevel } from './study-level';
export {
  DIMENSION_LABELS,
  EXPERIENCE_CATEGORIES,
  EXPERIENCE_CATEGORY_META,
  EXPERIENCE_SUBTYPES,
  OTHER_EXPERIENCE_CATEGORY,
  REFLECTION_DIMENSIONS,
  REFLECTION_DIMENSION_COUNT,
  REFLECTION_CARD_STATUSES,
  activityReflectionAnsweredCount,
  activityReflectionProgress,
  activityReflectionSchema,
  experienceCategoryFor,
  firstUnansweredDimension,
  isReflectionCardEmpty,
  reflectionCardSchema,
  reflectionCardSkillSchema,
  reflectionQuestion,
} from './activity-reflection';
export type {
  ActivityReflectionValues,
  ExperienceCategory,
  ExperienceSubtype,
  ReflectionCardStatus,
  ReflectionCardValues,
  ReflectionDimension,
  TopLevelExperienceCategory,
} from './activity-reflection';
export {
  PERSONAL_REFLECTION_QUESTIONS,
  PERSONAL_REFLECTION_QUESTION_COUNT,
  personalReflectionAnsweredCount,
  personalReflectionComplete,
  personalReflectionProgress,
  personalReflectionQuestion,
  personalReflectionSchema,
} from './personal-reflection';
export type { PersonalReflectionKey, PersonalReflectionValues } from './personal-reflection';
export {
  ADMISSIONS_TESTS,
  ENGLISH_TESTS,
  GPA_SCALE,
  IELTS_SCALE,
  SCORE_METHODS,
  admissionsTestScale,
  englishTest,
  englishTestScale,
  formatScore,
  ieltsFromEnglishTest,
  validateGpa,
  validateIelts,
  validateScore,
} from './academic-scores';
export type {
  AdmissionsTestId,
  EnglishTestId,
  IeltsEstimate,
  ScoreMethod,
  ScoreScale,
  StoredScores,
} from './academic-scores';
export {
  OTHER_SUBJECT_ID,
  SELECTABLE_SUBJECTS,
  SUBJECTS,
  normaliseQuery,
  searchSubjects,
  subjectById,
} from './subject-catalog';
export type { SubjectGroup, SubjectOption } from './subject-catalog';
export {
  DESTINATIONS,
  POPULAR_DESTINATIONS,
  destinationById,
  destinationFlag,
  destinationIdsFromStored,
  destinationLabel,
  searchDestinations,
} from './destination-catalog';
export type { DestinationOption } from './destination-catalog';
export {
  generateIntakeOptions,
  intakeDisplayLabel,
  intakeLabel,
  intakeOptionId,
  intakeOptionsWith,
  intakeStartMonth,
  parseIntake,
  serialiseIntake,
} from './intake';
export type { IntakeChoice, IntakeOption, IntakeSeason } from './intake';
export {
  FUNDING_SOURCE_CATALOG,
  FUNDING_SOURCE_IDS,
  fundingSource,
  fundingSourceFromStored,
  fundingSourceLabel,
} from './funding-catalog';
export type { FundingSource, FundingSourceId } from './funding-catalog';
export {
  ALL_CURRENCIES,
  PRIMARY_CURRENCIES,
  convertAmount,
  convertBudget,
  currencyMeta,
  defaultBudget,
  formatAmount,
  formatBudgetRange,
  isCompleteBudget,
  parseBudget,
  reBase,
  serialiseBudget,
} from './tuition-budget';
export type { CurrencyCode, CurrencyMeta, TuitionBudget } from './tuition-budget';
export { AI_JOURNEY, AI_JOURNEY_STEPS, aiJourneySteps } from './ai-journey';
export type { AiJourneyStep } from './ai-journey';
export {
  ABOUT_QUESTIONS,
  ABOUT_QUESTION_COUNT,
  REFLECTION_STEPS,
  REFLECTION_STEP_COUNT,
  aboutQuestionProgress,
  reflectionBlockingIssues,
  reflectionProgress,
  reflectionStep,
} from './reflection-steps';
export type { AboutQuestionKey, BlockingIssue, ReflectionStepKey } from './reflection-steps';
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
  EvidenceSource,
  ReflectionProfileRow,
  ReflectionValues,
  ReviewStatus,
  TuitionBudgetUsd,
} from './reflection';
export {
  applyEvidenceCandidates,
  evidenceCandidateSchema,
  evidenceCandidateToItem,
  evidenceExtractionResponseSchema,
  mergeDuplicate,
  validateEvidenceExtraction,
} from './reflection-extraction';
export type {
  EvidenceCandidate,
  EvidenceDuplicate,
  EvidenceExtractionResponse,
  EvidenceSourcePage,
} from './reflection-extraction';
export {
  ACHIEVEMENT_CATEGORY_ICON,
  ACTIVITY_CATEGORY_ICON,
  LEVEL_SUGGESTIONS,
} from './achievement-catalog';
export {
  candidateReadiness,
  candidateSnapshotPayloadSchema,
} from './confirmation';
export type {
  CandidateReadiness,
  CandidateSnapshotDocument,
  CandidateSnapshotPayload,
} from './confirmation';
export {
  MATCH_PROMPT_VERSION_V2,
  candidateConfidence,
  canonicalize,
  enforceFitClassification,
  fitScoreToPercent,
  programmeFitSchema,
} from './ai-reports';
export type {
  CandidateContext,
  EvidenceKind,
  EvidenceRef,
  ProgrammeFit,
  MatchingAnalysisView,
  MatchingApplicationSummary,
  MatchingReportPageData,
} from './ai-reports';
export {
  buildPersonalReport,
  STUDY_MOTIVATION_SUPPLEMENT_KEY,
  themeMaturityResults,
} from './personal-report';
export type {
  CoreIdentitySection,
  DrivingForceSection,
  EmergingTheme,
  EmergingThemesSection,
  EmergingThemeStatus,
  IntakeAction,
  IntakeActionKind,
  InsufficientData,
  PersonalPositioningSection,
  PersonalReportTrigger,
  PersonalReportV2,
  PersonalReportVersionSummary,
  PositioningDimensionKey,
  ProofCard,
  ProofOfMeSection,
  ReportConfidence,
  ReportOverallSummary,
  ReportOverview,
  SignaturePatternSection,
  SignaturePatternStep,
  SignaturePatternStepKey,
} from './personal-report';
export type {
  PersonalReportAnalytics,
  PositioningDimension,
  ReportChartMetric,
  SignaturePatternSupportItem,
  ThemeChartItem,
} from './personal-report-analytics';

export { academicBandClassification } from './ai-reports';

export {
  CLASSIFICATION_META,
  DIMENSION_META,
  DIMENSION_ORDER,
  MATCH_SCORE_DISCLAIMER,
  alignmentLevel,
  eligibilityRows,
  fitRows,
  matchSummary,
  overallMatchPercent,
  readinessPercent,
  tieredGaps,
} from './matching-report-presentation';
export type {
  AlignmentLevel,
  ClassificationTone,
  DimensionKey,
  EligibilityRow,
  FitRow,
  GapEntry,
  GapTier,
  MatchSummary,
} from './matching-report-presentation';

export {
  ACTION_TIER_LABELS,
  ACTION_TIER_MEANINGS,
  COMPONENT_KEYS,
  COMPONENT_LABELS,
  COMPONENT_WEIGHTS,
  CONSISTENCY_CHECK_KEYS,
  CONSISTENCY_CHECK_LABELS,
  CRITICAL_ACTION_PENALTY,
  MAX_CRITICAL_PENALTY,
  READINESS_DISCLAIMER,
  READINESS_STATE_LABELS,
  canRunFinalCheck,
  computeReadiness,
  finalCheckGenerationSchema,
  orderedReviews,
  parseFinalCheckRow,
  readinessState,
  unsupportedPillars,
} from './final-check';
export type {
  ActionTier,
  ComponentKey,
  ComponentState,
  ComponentStatus,
  ConsistencyCheck,
  ConsistencyCheckKey,
  DocumentReview,
  FinalCheckGeneration,
  FinalCheckRecord,
  NarrativeAudit,
  NarrativePillar,
  Readiness,
  ReadinessState,
} from './final-check';
