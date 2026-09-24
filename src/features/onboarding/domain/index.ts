/**
 * onboarding — domain logic.
 *
 * Pure functions and types: no I/O, no React, no framework imports. Everything
 * here must be unit-testable without a database or a DOM.
 */
export {
  CURRICULUM_GRADE_FORMATS,
  ENGLISH_TEST_FORMATS,
  PG_GRADE_FORMATS,
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
  EMPTY_PG_ACADEMIC,
  EMPTY_PHD_ACADEMIC,
  EMPTY_TESTS,
  academicComplete,
  academicFromProfile,
  collectCurriculumGrades,
  keepScores,
  pgAcademicComplete,
  pgAcademicFromProfile,
  phdAcademicComplete,
  phdAcademicFromProfile,
  readAcademicDraft,
  readPgAcademicDraft,
  readPhdAcademicDraft,
  readTestsDraft,
  resetInactiveLevelDrafts,
  testScoresValid,
  toCurriculumList,
} from './draft';
export type {
  Academic,
  AcademicProfileSource,
  PgAcademic,
  PhdAcademic,
  Tests,
} from './draft';
