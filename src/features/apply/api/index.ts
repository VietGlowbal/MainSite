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
  getLatestApplicationMatchingAnalysis,
  getMatchingAnalysisByInputHash,
  getMatchingReportPageData,
  listMatchingApplications,
  saveApplicationMatchingAnalysis,
} from './ai-reports-repository';
export type { MatchingAnalysisRecord } from './ai-reports-repository';
export {
  hashCandidateSnapshotPayload,
  loadCandidateReflection,
  loadResolvedFollowUpAnswers,
} from './candidate-snapshot-repository';
export type { CandidateFollowUpAnswer, CandidateReflectionRecord } from './candidate-snapshot-repository';
export {
  ApplicationLookupError,
  ApplicationNotOwnedError,
  verifiedApplicationId,
} from './verified-application-id';
export { loadApplicationSummary } from './application-summary';
export { loadProfileReview } from './profile-review';
export type {
  CurriculumGradeSummary,
  EnglishTestSummary,
  ProfileReviewData,
  StandardizedTestSummary,
} from './profile-review';
export {
  getApplicationProfileAnalysisVersion,
  getLatestApplicationProfileAnalysis,
  saveApplicationAcademicAssessment,
} from './application-analysis-repository';
export type { StoredApplicationProfileAnalysis } from './application-analysis-repository';
export {
  createPersonalReportV2Version,
  countApplicationReportGenerations,
  getApplicationPersonalReportV2Version,
  getApplicationPersonalReportSupplements,
  getLatestApplicationPersonalReportV2,
  listApplicationPersonalReportV2Versions,
  saveApplicationPersonalReportSupplement,
  getLatestPersonalReportV2,
  getPersonalReportSupplements,
  getPersonalReportV2Version,
  listPersonalReportV2Versions,
  savePersonalReportSupplement,
} from './personal-report-v2-repository';
export type { ApplicationReportScope, PersonalReportV2Record } from './personal-report-v2-repository';
export { regeneratePersonalReport } from './personal-report-generation';
export type { RegeneratePersonalReportResult } from './personal-report-generation';
export {
  blockApplicationPersonalReportGeneration,
  claimApplicationPersonalReportGenerations,
  enqueueApplicationPersonalReportGeneration,
  getApplicationPersonalReportGeneration,
  markApplicationPersonalReportGenerationComplete,
  retryApplicationPersonalReportGeneration,
} from './personal-report-generation-job-queue';
export type { ApplicationPersonalReportGenerationJob } from './personal-report-generation-job-queue';
export {
  DEFAULT_PERSONAL_REPORT_GENERATION_BATCH,
  MAX_PERSONAL_REPORT_GENERATION_BATCH,
  processApplicationPersonalReportGenerations,
} from './personal-report-generation-worker';

export {
  getFinalCheckPageData,
  loadComponentStates,
  loadDocumentTexts,
} from './final-check-repository';
export type { FinalCheckPageData } from './final-check-repository';
