export { StrategyHome } from './strategy-home';
/**
 * `ApplicantAnalysisReport` and `CourseMatchReport` were here. The analysis is
 * now two pages rather than two panels stacked on one — see
 * `applicant-portrait.tsx` and `programme-fit-report.tsx`, both of which render
 * from the shared evaluation engine instead of from their own row shape.
 */
export { ApplicantPortrait } from './applicant-portrait';
export { ProgrammeFitReport } from './programme-fit-report';
export { StrategyRecommendationReport } from './strategy-recommendation-report';
export { StrategyRecommendationWorkspace } from './strategy-recommendation-workspace';
export { StrategyReportV3View } from './strategy-report-v3-view';
export { ReportPanel, ReportTabs, useReportTabs } from './report-chrome';
export type { ReportTab } from './report-chrome';
export { AnalysisWorkspace } from './analysis-workspace';
export { DashboardSummary } from './dashboard-summary';
export { StrategyCategoryBoard } from './strategy-category-board';
/**
 * `RecommendationTable` was here. It is now `ApplicationPlanner`'s list view —
 * same rows, plus search, a status filter, deadlines and the two other views.
 * Deleted rather than kept alongside so there is only one table that can be
 * right.
 */
export { ApplicationPlanner } from './application-planner';
export { HierarchicalApplicationPlanner } from './hierarchical-application-planner';
export { CanonicalMicroStepDetail } from './canonical-micro-step-detail';
export { PlannerHealthBanner } from './planner-health-banner';
export { GenerateCanonicalPlanButton } from './generate-canonical-plan-button';
export { ProgressStatusControl } from './progress-status-control';
export { EvidenceUpload } from './evidence-upload';
export { AiCoachPanel } from './ai-coach-panel';
export { ContentBlockInput } from './content-block';
/**
 * The detail page needs the same category/priority pill mappings the
 * planner table and board already use, so a task's chips can't read
 * differently on its own page than they do everywhere else it's listed.
 *
 * These come from `planner-presentation.ts`, NOT from `planner-shared.tsx`.
 * The detail page is a server component, `planner-shared.tsx` is
 * `'use client'`, and re-exporting a client module's function through this
 * barrel does not make it callable on the server — it made every task detail
 * page 500. See `planner-presentation.ts`'s header and
 * `docs/known-issues.md §5l`.
 */
export {
  PRIORITY_LABEL,
  PRIORITY_VARIANT,
  STATUS_SELECT_CLASS,
  STATUS_VARIANT,
  categoryLabel,
  categoryVariant,
  formatDate,
} from './planner-presentation';
