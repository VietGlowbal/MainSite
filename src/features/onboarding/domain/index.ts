/**
 * onboarding — domain logic.
 *
 * Pure functions and types: no I/O, no React, no framework imports. Everything
 * here must be unit-testable without a database or a DOM.
 */
<<<<<<< Updated upstream
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
=======
export * from './answers';
export * from './content';
export * from './mappers';
export * from './types';
>>>>>>> Stashed changes
