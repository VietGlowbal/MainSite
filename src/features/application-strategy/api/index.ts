/**
 * application-strategy — the repository layer.
 *
 * The one slice of this feature allowed to reach the database directly. UI
 * components never import from here (eslint enforces it); server components and
 * route handlers read through these functions and pass plain data down.
 */
export { strategyAdminClient } from './admin';
export { assembleStrategyContext } from './context';
export type { StrategyContextResult } from './context';
export { aiFailureResponse, badRequest, migrationAwareError } from './route-errors';
export type { AiFailureReason } from './route-errors';
export {
  countWords,
  getLatestCvReview,
  getLatestStatementAnalysis,
  getOrCreateStrategy,
  getStatementDraft,
  getStatementStrategy,
  getStrategyOverview,
  getStructuredCv,
  getTargetProfile,
  insertCvReview,
  insertStatementAnalysis,
  updateStrategyStatus,
  upsertStatementStrategy,
  upsertStructuredCv,
  upsertTargetProfile,
} from './strategy-repository';
export type { TargetProfilePatch } from './strategy-repository';
