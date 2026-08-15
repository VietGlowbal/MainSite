/**
 * Custom SVG chart primitives for the Personal Report redesign.
 *
 * Deliberately not a charting library: every chart here is small, static
 * (no zoom/pan/tooltip interaction), and needs to render identically in
 * print — a dependency built for interactive dashboards would bring far
 * more than this needs. See `src/features/apply/domain/personal-report-analytics.ts`
 * for the deterministic data these are fed from.
 */
export { DonutChart } from './donut-chart';
export type { DonutChartSegment } from './donut-chart';
export { HorizontalBarChart } from './horizontal-bar-chart';
export type { HorizontalBarChartDatum } from './horizontal-bar-chart';
export { MetricBar } from './metric-bar';
export type { MetricBarTone } from './metric-bar';
export { RadarChart } from './radar-chart';
export type { RadarChartDatum } from './radar-chart';
