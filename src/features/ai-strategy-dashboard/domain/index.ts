/**
 * ai-strategy-dashboard — domain logic.
 *
 * Pure functions and types: no I/O, no React, no framework imports. Everything
 * here must be unit-testable without a database or a DOM.
 */
export {
  PROGRESS_STATUS,
  PROGRESS_STATUS_LABEL,
  RECOMMENDATION_PRIORITIES,
  completionPercent,
  contentValueSchema,
  isCompleteContentValue,
  parseContentBlock,
  parseContentBlockValue,
  groupByCategory,
  nextPriority,
  reconcileRecommendations,
  reconcileSeeds,
  recommendationFromImprovementAction,
  recommendationFromRow,
  recommendationPatchSchema,
  recommendationStatusPatchSchema,
  recommendationsFromRoadmap,
  sortByPriority,
  taskCounts,
} from './recommendation';
export type {
  ExistingRecommendation,
  ProgressStatus,
  ReconcilePlan,
  Recommendation,
  RecommendationPatch,
  RecommendationPriority,
  RecommendationSeed,
  RecommendationStatusPatch,
  RecommendationUpdate,
} from './recommendation';

export {
  KANBAN_COLUMNS,
  KANBAN_COLUMN_LABEL,
  PLANNER_VIEWS,
  PLANNER_VIEW_LABEL,
  PLANNER_VIEW_PARAM,
  parsePlannerView,
  plannerViewHref,
  calendarMonthGrid,
  daysRemaining,
  dueLabel,
  dueTone,
  groupByStatus,
  matchesQuery,
  monthLabel,
  parseIsoDate,
  scheduledByDay,
  shiftMonth,
  toIsoDate,
  unscheduled,
} from './planner';
export type { CalendarDay, DueTone, PlannerView } from './planner';

export { applicantAnalysisFromRow, narrativeFromRow } from './applicant-analysis';
export type {
  ApplicantAnalysisInputsPresent,
  ApplicantAnalysisRecord,
} from './applicant-analysis';

/**
 * The Shared Evaluation Engine (F1–F6). One evaluation every AI surface reads
 * from, so the Report, Feedback, Strategy and Breakdown cannot disagree about
 * the same student. See evaluation/framework.ts.
 */
export * from './evaluation';

export { deriveCourseMatchAnalysis } from './course-match';
export type { CourseMatchAnalysis, CourseMatchSubScore } from './course-match';

export { SEEDED_CATEGORIES, categoryByPillar } from './strategy-category';
export type { StrategyCategory } from './strategy-category';

export {
  STRATEGY_TOOLS,
  recommendationHelp,
  strategyToolHref,
  toolForRecommendation,
} from './strategy-tool';
export type { RecommendationLink, StrategyTool, StrategyToolKey } from './strategy-tool';

export { COACH_SEED_INTENTS } from './coach';
export type { CoachMessage, CoachRole, CoachSeedIntent, CoachThread } from './coach';

export {
  confirmedReflectionContinueHref,
  isOnboardingComplete,
  nextOnboardingStep,
  onboardingStepHref,
} from './onboarding';
export type { OnboardingState, OnboardingStep } from './onboarding';
export { candidateInformationStepperSteps } from './candidate-information-steps';

export {
  directionOptionSchema,
  portfolioOpportunitySchema,
  portfolioOpportunitySourceSchema,
  portfolioRecommendationSchema,
  strategyRecommendationFromRow,
  strategyRecommendationSchema,
  strategyRoadmapSchema,
} from './strategy-recommendation';
export type {
  DirectionOption,
  PortfolioOpportunity,
  PortfolioOpportunitySource,
  PortfolioRecommendation,
  StrategyRecommendation,
  StrategyRecommendationRecord,
  StrategyRoadmap,
} from './strategy-recommendation';

// ─── Core 1 Gate 1 — Planning Context domain contract (types only) ───────────
export type {
  // Source metadata
  SourceStatus,
  SourceDiagnostic,
  SourceProvenance,
  StalenessState,
  // Programme
  PlanningProgrammeSummary,
  // Requirements
  RequirementGap,
  UnresolvedRequirement,
  // Constraints
  HardConstraintKind,
  HardConstraint,
  // Gaps
  PlanningGapSource,
  PlanningGap,
  // Interventions
  F5ImprovementCandidate,
  F7RoadmapCandidate,
  InterventionCandidate,
  // Evidence
  ExistingEvidenceByTier,
  EvidenceNeedsProof,
  MissingEvidenceItem,
  MissingInputSignal,
  PlanningEvidenceDocument,
  PlanningEvidenceInventory,
  // Deadlines
  PlanningDeadlineSource,
  DeadlineCandidate,
  DeadlinePrecedence,
  DeadlineAuthority,
  PlanningDeadline,
  // User constraints
  UserConstraintKind,
  UserConstraint,
  // Strategy
  AiProposedPortfolioOpportunity,
  PlanningStrategy,
  // Provenance
  PlanningProvenance,
  // Top-level
  PlanningContext,
  PlanningContextSources,
} from './planning-context';

// Core 1 Assess -- deterministic current-state findings only.
export { compilePlanningContext } from './compile-planning-context';
export { compileAssessments } from './compile-assessments';
export { compileDecisions } from './compile-decisions';
export { compilePlan } from './compile-plan';
export { CORE3_PLAN_PRODUCER, reconcilePlan } from './plan-persistence';
export { plannerMicroStepExecutionPatchSchema } from './planner-micro-step-execution';
export {
  buildPlannerReadModel,
  applyPlannerMicroStepExecution,
  getCalendarMicroSteps,
  getKanbanMicroSteps,
  getPlannerMicroSteps,
} from './build-planner-read-model';
export {
  ASSESSMENT_MODES,
  ASSESSMENT_SEVERITIES,
  ASSESSMENT_STATUSES,
} from './assessment';
export type {
  AssessmentDecisionBasis,
  AssessmentEvidence,
  AssessmentKind,
  AssessmentMode,
  AssessmentProvenance,
  AssessmentResult,
  AssessmentSeverity,
  AssessmentSource,
  AssessmentStatus,
} from './assessment';
export type {
  DecisionAssessment,
  DecisionFeasibility,
  DecisionOption,
  DecisionReason,
  DecisionResult,
  DecisionStatus,
} from './decision';
export type {
  PlanMicroStep,
  PlanNodeReadiness,
  PlanPhase,
  PlanReadiness,
  PlanResult,
  PlanStep,
} from './plan';
export type {
  ExistingPersistedPlan,
  PersistedPlan,
  PersistedPlanMicroStep,
  PersistedPlanPhase,
  PersistedPlanStep,
  PlanPersistenceOperation,
  PlanPersistenceOperations,
} from './plan-persistence';
export type {
  PlannerMicroStep,
  PlannerMicroStepProjection,
  PlannerPhase,
  PlannerPlan,
  PlannerLifecycle,
  PlannerProgress,
  PlannerReadDiagnostic,
  PlannerReadModel,
  PlannerReadModelInput,
  PlannerStep,
} from './planner-read-model';
export type { PlannerMicroStepExecutionPatch, PlannerMicroStepExecutionState } from './planner-micro-step-execution';
