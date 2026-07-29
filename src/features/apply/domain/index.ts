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
export { displayCourseName, isParsePending } from './course-name';
export { activeStageIndex, stageProgressLabel, summariseTasks } from './progress';
export type { TaskCounts } from './progress';
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
