/**
 * apply — data access (server-only).
 *
 * Exposes repository ports and their adapters. This is the ONLY slice in the
 * feature permitted to reach the database. Consumers import the port type, not
 * the adapter, so the implementation stays swappable (and fake-able in tests).
 */
export {};
export {
  candidateContextHash,
  contextForModel,
  loadCandidateContext,
  stableHash,
} from './candidate-context';
export {
  getMatchingReportPageData,
  listMatchingApplications,
} from './ai-reports-repository';
export { loadCandidateReflection } from './candidate-snapshot-repository';
export type { CandidateReflectionRecord } from './candidate-snapshot-repository';
export { verifiedApplicationId } from './verified-application-id';
export {
  getPersonalReportSupplements,
  getPersonalReportV2Record,
  savePersonalReportSupplement,
  savePersonalReportV2,
} from './personal-report-v2-repository';
export type { PersonalReportV2Record } from './personal-report-v2-repository';
