/**
 * Public API of the scholarships feature.
 *
 * Everything another slice is allowed to use is re-exported here. Deep imports
 * past this barrel are a lint error — see eslint.config.mjs.
 */
export * from './api';
export {
  parseScholarshipSearchParams,
  scholarshipSearchParams,
  SCHOLARSHIP_DEGREES,
  SCHOLARSHIP_FUNDING,
  SCHOLARSHIP_MAJORS,
  SCHOLARSHIP_SORTS,
  SCHOLARSHIP_VIEWS,
} from './domain/query-state';
export type {
  ScholarshipDegree,
  ScholarshipFunding,
  ScholarshipMajor,
  ScholarshipQueryState,
  ScholarshipSort,
  ScholarshipView,
} from './domain/query-state';
