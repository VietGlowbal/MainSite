/**
 * application-strategy — domain logic.
 *
 * Pure functions and types: no I/O, no React, no framework imports. Everything
 * here must be unit-testable without a database or a DOM.
 *
 * This barrel is the only entry point. eslint's NO_DEEP_FEATURE_IMPORT pattern
 * forbids reaching three levels into a feature, so a consumer importing
 * `domain/status` directly is a lint error rather than a quiet coupling to a
 * file layout.
 */
export {
  MIN_ANALYSABLE_WORDS,
  canAnalyseStatement,
  cvActionHref,
  cvActionLabel,
  cvContentStatus,
  cvReviewStatus,
  cvStatus,
  nextAction,
  statementActionHref,
  statementActionLabel,
  statementStatus,
  statusLabel,
  strategyStatus,
  targetProfileStatus,
} from './status';
export type { CvStatusInputs, NextAction, StatementStatusInputs } from './status';

export {
  hasExport,
  isAnalysisOutdated,
  isExportOutdated,
  isReviewOutdated,
  outdatedReviews,
} from './staleness';

export { AACC_PILLARS, TARGET_PROFILE_FIELDS } from './types';
export type {
  AaccAssessment,
  AaccPillar,
  AaccPillarKey,
  ApplicationStrategy,
  ApplicationStrategyContext,
  CvEntry,
  CvLayoutKey,
  CvMissingSignal,
  CvReview,
  CvSection,
  CvSectionKind,
  CvStrength,
  CvTargetProfile,
  CvWorkspaceSummary,
  DataOrigin,
  FindingSeverity,
  ReadinessCheck,
  ReadinessCheckKey,
  StatementAnalysis,
  StatementBrief,
  StatementFinding,
  StatementOverview,
  StatementReadiness,
  StatementStrategy,
  StatementWorkspaceSummary,
  StrategyOverview,
  StrategySource,
  StructuredCv,
  TargetProfileField,
  TargetProfileGeneration,
  WorkspaceStatus,
} from './types';
