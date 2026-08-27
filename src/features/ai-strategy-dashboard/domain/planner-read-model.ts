import type { ContentBlock, ContentBlockValue } from '@/lib/match-insights';
import type { PlanNodeProvenance } from './plan';
import type {
  PersistedPlan,
  PersistedPlanMicroStep,
  PersistedPlanPhase,
  PersistedPlanStep,
} from './plan-persistence';
import type { PlanNodeReadiness, PlanReadiness } from './plan';
import type { ProgressStatus } from './recommendation';

/** Active Core 4 execution progress; never persisted on Phase or Step. */
export type PlannerProgress = {
  total: number;
  completed: number;
  percentage: number;
};

export type PlannerPlan = {
  id: string;
  applicationId: string;
  producer: string;
  domainPlanId: string;
  readiness: PlanReadiness;
};

/** Runtime state derived from the persisted hierarchy and execution state. */
export type PlannerLifecycle = 'active' | 'waiting_for_input' | 'complete' | 'empty';

export type PlannerPhase = {
  id: string;
  domainNodeId: string;
  title: string;
  objective: string;
  order: number;
  sourceDecisionIds: string[];
  sourceProvenances: PlanNodeProvenance[];
  progress: PlannerProgress;
  steps: PlannerStep[];
};

export type PlannerStep = {
  id: string;
  domainNodeId: string;
  phaseId: string;
  title: string;
  objective: string;
  order: number;
  sourceDecisionIds: string[];
  sourceProvenances: PlanNodeProvenance[];
  progress: PlannerProgress;
  microSteps: PlannerMicroStep[];
};

/** Micro-step is the only execution entity in the canonical hierarchy. */
export type PlannerMicroStep = {
  id: string;
  domainNodeId: string;
  stepId: string;
  phaseId: string;
  title: string;
  guidance?: string;
  order: number;
  readiness: PlanNodeReadiness;
  contentSchema: ContentBlock | null;
  sourceDecisionIds: string[];
  sourceProvenances: PlanNodeProvenance[];
  status: ProgressStatus;
  /** A PostgreSQL DATE represented as its timezone-free YYYY-MM-DD value. */
  deadline: string | null;
  contentValue: ContentBlockValue | null;
  executionEvidence: unknown[];
};

export type PlannerReadDiagnostic = {
  kind:
    | 'archived_plan'
    | 'foreign_phase'
    | 'foreign_step'
    | 'foreign_micro_step'
    | 'duplicate_phase'
    | 'duplicate_step'
    | 'duplicate_micro_step'
    | 'orphan_step'
    | 'orphan_micro_step'
    | 'invalid_execution_status';
  nodeId: string;
  parentId: string | null;
};

export type PlannerReadModel = {
  plan: PlannerPlan | null;
  phases: PlannerPhase[];
  lifecycle: PlannerLifecycle;
  diagnostics: PlannerReadDiagnostic[];
};

/** Explicit persistence input keeps the pure builder independent of Supabase. */
export type PlannerReadModelInput = {
  plan: PersistedPlan | null;
  phases: readonly PersistedPlanPhase[];
  steps: readonly PersistedPlanStep[];
  microSteps: readonly PersistedPlanMicroStep[];
};

/** A micro-step with its immutable hierarchy context for flat execution views. */
export type PlannerMicroStepProjection = PlannerMicroStep & {
  phaseTitle: string;
  stepTitle: string;
};
