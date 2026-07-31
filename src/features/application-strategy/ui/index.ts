/**
 * application-strategy — UI.
 *
 * Presentational components. They receive data as props; eslint forbids this
 * slice from importing the feature's api/, so nothing here can reach the
 * database.
 */
export { PanelRow, StrategyPanel } from './panel';
export { StatusPill, StatusText } from './status-pill';
export { StrategyOverviewView } from './strategy-overview';
export type { StrategyOverviewProps } from './strategy-overview';

export { AutosaveStatus } from './autosave-status';
export { SuggestionCard } from './suggestion-card';
export { CvSteps } from './cv-steps';
export {
  AnalysisFailedState,
  AnalysisNotRunState,
  EmptyStatementState,
  ExportFailedState,
  ExportOutdatedState,
  GeneratingState,
  MissingCvContentState,
  NoCvUploadedState,
  NoProgrammeDataState,
  OutdatedAnalysisState,
  OutdatedReviewState,
  ProviderUnavailableState,
  StateBlock,
  UnreadableCvState,
} from './states';
export type { StateAction, StateTone } from './states';
export { OriginBadge } from './origin-badge';
export { CheckMark } from './check-mark';
