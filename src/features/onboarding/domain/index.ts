/**
 * onboarding — domain logic.
 *
 * Pure functions and types: no I/O, no React, no framework imports. Everything
 * here must be unit-testable without a database or a DOM.
 */
export {
  CURRICULUM_GRADE_FORMATS,
  ENGLISH_TEST_FORMATS,
  STANDARDIZED_TEST_FORMATS,
  defaultScaleFor,
  gradeFormatFor,
  scalesFor,
  toCurriculumGrades,
} from './academic-grading';
export type { CurriculumGrade, GradeFormat, GradeProblem } from './academic-grading';
export { onboardingIsComplete } from './completion';
export type { OnboardingAnswers } from './completion';
export {
  EMPTY_ACADEMIC,
  EMPTY_TESTS,
  academicComplete,
  collectCurriculumGrades,
  keepScores,
  readAcademicDraft,
  readTestsDraft,
  testScoresValid,
  toCurriculumList,
} from './draft';
export type { Academic, Tests } from './draft';
