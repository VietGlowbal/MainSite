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

export { isOnboardingComplete, nextOnboardingStep, onboardingStepHref } from './onboarding';
export type { OnboardingState, OnboardingStep } from './onboarding';

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
