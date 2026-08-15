/**
 * universities — domain logic.
 *
 * Pure functions and types: no I/O, no React, no framework imports. Everything
 * here must be unit-testable without a database or a DOM.
 */
export {
  formatAcceptanceForCard,
  formatDeadlineLabel,
  formatTuitionForCard,
  formatUsdCompact,
  formatUsdOne,
  parseAcceptanceRate,
  parseDeadline,
  parseTuition,
  parseTuitionRange,
} from './formatting';

export { leadFragment, splitList } from './highlights';

export {
  attachedOptions,
  bestCoveragePercent,
  scholarshipCandidates,
  scholarshipLabel,
} from './saved-list';
export type {
  CoverageLike,
  SavedListScholarship,
  SavedListUniversity,
  ScholarshipCandidate,
} from './saved-list';

export { filterOptions, isCourseUrl, optionsForGroup, programChoices } from './programs';
export type {
  CatalogueEntry,
  ProgramChoices,
  ProgramGroup,
  ProgramOption,
} from './programs';

export {
  amountToUsd,
  computeNetTuition,
  parseCoveragePercent,
  type NetTuition,
  type ScholarshipLike,
} from './pricing';

export { countriesMatch, normalizeCountryName } from './country';

export { officialWebsite } from './websites';

export {
  normaliseUniversityName,
  pickBestMatch,
  registrableDomain,
  sameDomain,
} from './match-university';
export type {
  MatchQuery,
  MatchReason,
  UniversityCandidate,
  UniversityMatch,
} from './match-university';

export { evaluateUniversityMatch, rankUniversityMatches } from './university-matching';
export {
  DEFAULT_UNIVERSITY_MATCH_TIER_POLICY,
  universityMatchTierCounts,
} from './university-matching';
export { demoUniversityMatches } from './university-matching-demo';
export type {
  RankedUniversityMatch,
  UniversityMatchEvaluation,
  UniversityMatchTierCounts,
  UniversityMatchTierPolicy,
  UniversityMatchTierV1,
  UniversityMatchingCandidate,
} from './university-matching';
