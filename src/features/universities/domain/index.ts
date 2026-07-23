/**
 * universities — domain logic.
 *
 * Pure functions and types: no I/O, no React, no framework imports. Everything
 * here must be unit-testable without a database or a DOM.
 */
export {
  formatAcceptanceForCard,
  formatTuitionForCard,
  formatUsdCompact,
  formatUsdOne,
  parseAcceptanceRate,
  parseDeadline,
  parseTuition,
  parseTuitionRange,
} from './formatting';

export {
  amountToUsd,
  computeNetTuition,
  parseCoveragePercent,
  type NetTuition,
  type ScholarshipLike,
} from './pricing';

export { countriesMatch, normalizeCountryName } from './country';
