/**
 * application-strategy — UI.
 *
 * Presentational components. They receive data as props; eslint forbids this
 * slice from importing the feature's api/, so nothing here can reach the
 * database.
 */
export { Panel, PanelHeader, PanelRow } from './panel';
export { StatusPill, StatusText } from './status-pill';
export { StrategyOverviewView } from './strategy-overview';
export type { StrategyOverviewProps } from './strategy-overview';
