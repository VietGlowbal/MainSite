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
  recommendationFromImprovementAction,
  recommendationFromRow,
  recommendationPatchSchema,
  recommendationStatusPatchSchema,
  sortByPriority,
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

export { APPLICANT_ANALYSIS_SECTIONS, hasSectionContent } from './applicant-analysis';
export type {
  ApplicantAnalysis,
  ApplicantAnalysisInputsPresent,
  ApplicantAnalysisSection,
} from './applicant-analysis';

export { deriveCourseMatchAnalysis } from './course-match';
export type { CourseMatchAnalysis, CourseMatchSubScore } from './course-match';

export { SEEDED_CATEGORIES, categoryByPillar } from './strategy-category';
export type { StrategyCategory } from './strategy-category';

export { COACH_SEED_INTENTS } from './coach';
export type { CoachMessage, CoachRole, CoachSeedIntent, CoachThread } from './coach';

export { isOnboardingComplete, nextOnboardingStep, onboardingStepHref } from './onboarding';
export type { OnboardingState, OnboardingStep } from './onboarding';
