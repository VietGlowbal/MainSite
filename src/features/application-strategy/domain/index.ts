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

export {
  CV_SECTION_KINDS,
  CV_STEPS,
  DEFAULT_SECTION_KINDS,
  OPTIONAL_SECTIONS,
  RENAMEABLE_SECTIONS,
  SECTION_FIELDS,
  SECTION_LABEL,
  countEntries,
  defaultSections,
  emptyEntry,
  emptySection,
  essentialGaps,
  hasAnyContent,
  isOptionalSection,
  isRenameableSection,
  newEntryId,
  reorder,
  sectionFields,
  sectionTitle,
  sectionUsesField,
  structuredCvPatchSchema,
} from './cv-sections';
export type { CvEntryField, CvStepKey, StructuredCvPatch } from './cv-sections';

export {
  ORIGIN_LABEL,
  TARGET_PROFILE_FIELD_DEFS,
  filledFieldCount,
  isNoopPatch,
  isTargetProfileComplete,
  targetProfileField,
  targetProfilePatchSchema,
} from './target-profile';
export type { TargetProfileFieldDef, TargetProfilePatchInput } from './target-profile';

export {
  CV_LAYOUTS,
  applyLayoutOrder,
  canExport,
  cvLayout,
  isEmphasised,
  recommendLayout,
} from './cv-layouts';
export type { CvLayoutDef, LayoutRecommendation } from './cv-layouts';

export {
  AACC_PILLAR_DESCRIPTION,
  AACC_PILLAR_LABEL,
  AACC_SCORE_FRAMING,
  READINESS_LABEL,
  READINESS_ORDER,
  STATEMENT_SECTIONS,
  countStatementWords,
  emptyAacc,
  hasAacc,
  parseStatementSection,
  scoreWording,
  statementSectionLabel,
  wordLimitState,
} from './statement-sections';
export type { StatementSectionKey, WordLimitState } from './statement-sections';

export { buildHighlightRuns, matchQuote } from './quote-match';
export type { HighlightRun, QuoteMatch, QuotedItem } from './quote-match';

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
