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
  recommendationStatusPatchSchema,
  sortByPriority,
} from './recommendation';
export type {
  ProgressStatus,
  Recommendation,
  RecommendationPriority,
  RecommendationStatusPatch,
} from './recommendation';

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
