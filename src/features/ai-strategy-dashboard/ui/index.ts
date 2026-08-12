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
export { ProgressStatusControl } from './progress-status-control';
export { EvidenceUpload } from './evidence-upload';
export { AiCoachPanel } from './ai-coach-panel';
export { ContentBlockInput } from './content-block';
/**
 * The detail page needs the same category/priority pill mappings the
 * planner table and board already use, so a task's chips can't read
 * differently on its own page than they do everywhere else it's listed —
 * see `planner-shared.tsx`'s own header comment.
 */
export { PRIORITY_LABEL, PRIORITY_VARIANT, categoryLabel, categoryVariant, formatDate } from './planner-shared';
