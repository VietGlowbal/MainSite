import { PROGRESS_STATUS, type ProgressStatus } from './recommendation';
import type {
  PlannerMicroStep,
  PlannerMicroStepProjection,
  PlannerPhase,
  PlannerProgress,
  PlannerReadDiagnostic,
  PlannerReadModel,
  PlannerReadModelInput,
  PlannerStep,
} from './planner-read-model';
import type { PlanReadiness } from './plan';
import type { PlannerMicroStepExecutionPatch } from './planner-micro-step-execution';

const EMPTY_PROGRESS: PlannerProgress = { total: 0, completed: 0, percentage: 0 };

/**
 * Converts persisted Core 3 hierarchy rows into Core 4's canonical read model.
 * It is defensive by design: archived ancestors, duplicates, and orphans are
 * excluded rather than being attached to an arbitrary visible node.
 */
export function buildPlannerReadModel(input: PlannerReadModelInput): PlannerReadModel {
  const diagnostics: PlannerReadDiagnostic[] = [];
  const plan = input.plan;
  if (!plan) return { plan: null, phases: [], lifecycle: 'empty', diagnostics };
  if (plan.archivedAt !== null) {
    return {
      plan: null,
      phases: [],
      lifecycle: 'empty',
      diagnostics: [{ kind: 'archived_plan', nodeId: plan.id, parentId: null }],
    };
  }

  const phaseRows = uniqueActive(
    input.phases.filter((phase) => {
      if (phase.planId === plan.id) return true;
      diagnostics.push({ kind: 'foreign_phase', nodeId: phase.id, parentId: phase.planId });
      return false;
    }),
    'phase',
    diagnostics,
  );
  const phaseById = new Map(phaseRows.map((phase) => [phase.id, phase]));

  const stepRows = uniqueActive(
    input.steps.filter((step) => {
      if (step.planId !== plan.id) {
        diagnostics.push({ kind: 'foreign_step', nodeId: step.id, parentId: step.planId });
        return false;
      }
      if (phaseById.has(step.phaseId)) return true;
      diagnostics.push({ kind: 'orphan_step', nodeId: step.id, parentId: step.phaseId });
      return false;
    }),
    'step',
    diagnostics,
  );
  const stepById = new Map(stepRows.map((step) => [step.id, step]));

  const microStepRows = uniqueActive(
    input.microSteps.filter((microStep) => {
      if (microStep.planId !== plan.id) {
        diagnostics.push({ kind: 'foreign_micro_step', nodeId: microStep.id, parentId: microStep.planId });
        return false;
      }
      if (stepById.has(microStep.stepId)) return true;
      diagnostics.push({ kind: 'orphan_micro_step', nodeId: microStep.id, parentId: microStep.stepId });
      return false;
    }),
    'micro_step',
    diagnostics,
  );

  const microsByStep = new Map<string, PlannerMicroStep[]>();
  for (const row of microStepRows) {
    const status = normaliseStatus(row.status, row.id, diagnostics);
    const phaseId = stepById.get(row.stepId)?.phaseId;
    if (!phaseId) continue; // Guard retained if data is mutated between maps.
    const microStep: PlannerMicroStep = {
      id: row.id,
      domainNodeId: row.domainNodeId,
      stepId: row.stepId,
      phaseId,
      title: row.title,
      order: row.order,
      readiness: row.readiness,
      contentSchema: row.contentSchema,
      sourceDecisionIds: [...row.sourceDecisionIds],
      sourceProvenances: [...row.sourceProvenances],
      status,
      deadline: row.deadline,
      contentValue: row.contentValue,
      executionEvidence: [...row.executionEvidence],
    };
    const current = microsByStep.get(row.stepId) ?? [];
    current.push(microStep);
    microsByStep.set(row.stepId, current);
  }

  const stepsByPhase = new Map<string, PlannerStep[]>();
  for (const row of stepRows) {
    const microSteps = sortNodes(microsByStep.get(row.id) ?? []);
    const step: PlannerStep = {
      id: row.id,
      domainNodeId: row.domainNodeId,
      phaseId: row.phaseId,
      title: row.title,
      objective: row.objective,
      order: row.order,
      sourceDecisionIds: [...row.sourceDecisionIds],
      sourceProvenances: [...row.sourceProvenances],
      progress: progress(microSteps),
      microSteps,
    };
    const current = stepsByPhase.get(row.phaseId) ?? [];
    current.push(step);
    stepsByPhase.set(row.phaseId, current);
  }

  const phases = sortNodes(phaseRows).map((row): PlannerPhase => {
    const steps = sortNodes(stepsByPhase.get(row.id) ?? []);
    const microSteps = steps.flatMap((step) => step.microSteps);
    return {
      id: row.id,
      domainNodeId: row.domainNodeId,
      title: row.title,
      objective: row.objective,
      order: row.order,
      sourceDecisionIds: [...row.sourceDecisionIds],
      sourceProvenances: [...row.sourceProvenances],
      progress: progress(microSteps),
      steps,
    };
  });

  return {
    plan: {
      id: plan.id,
      applicationId: plan.applicationId,
      producer: plan.producer,
      domainPlanId: plan.domainPlanId,
      readiness: plan.readiness,
    },
    phases,
    lifecycle: lifecycle(plan.readiness, phases),
    diagnostics: sortDiagnostics(diagnostics),
  };
}

function lifecycle(readiness: PlanReadiness, phases: readonly PlannerPhase[]): PlannerReadModel['lifecycle'] {
  const micros = phases.flatMap((phase) => phase.steps.flatMap((step) => step.microSteps));
  if (micros.length === 0) return readiness === 'empty' ? 'complete' : 'empty';
  if (micros.every((micro) => micro.status === 'completed')) return 'complete';
  return micros.some((micro) => micro.readiness === 'requires_user_input' && micro.status !== 'completed') ? 'waiting_for_input' : 'active';
}

/** Stable hierarchy order, flattened only as an execution projection. */
export function getPlannerMicroSteps(model: PlannerReadModel): PlannerMicroStepProjection[] {
  return model.phases.flatMap((phase) => phase.steps.flatMap((step) =>
    step.microSteps.map((microStep) => ({ ...microStep, phaseTitle: phase.title, stepTitle: step.title })),
  ));
}

/** Calendar displays only executable micro-steps that have a PostgreSQL DATE deadline. */
export function getCalendarMicroSteps(model: PlannerReadModel): PlannerMicroStepProjection[] {
  return getPlannerMicroSteps(model).filter((microStep) => microStep.deadline !== null);
}

/** Kanban groups only executable micro-step statuses; parents remain context. */
export function getKanbanMicroSteps(model: PlannerReadModel): PlannerMicroStepProjection[] {
  return getPlannerMicroSteps(model);
}

/** Recomputes ancestor progress from a single optimistic Micro-step execution edit. */
export function applyPlannerMicroStepExecution(
  model: PlannerReadModel,
  microStepId: string,
  patch: PlannerMicroStepExecutionPatch,
): PlannerReadModel {
  const phases = model.phases.map((phase) => {
    const steps = phase.steps.map((step) => {
      const microSteps = step.microSteps.map((microStep) => microStep.id === microStepId ? {
        ...microStep,
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.deadline !== undefined ? { deadline: patch.deadline } : {}),
        ...(patch.contentValue !== undefined ? { contentValue: patch.contentValue } : {}),
      } : microStep);
      return { ...step, microSteps, progress: progress(microSteps) };
    });
    return { ...phase, steps, progress: progress(steps.flatMap((step) => step.microSteps)) };
  });
  return { ...model, phases };
}

function uniqueActive<T extends { id: string; domainNodeId: string; order: number; archivedAt: string | null }>(
  rows: readonly T[],
  kind: 'phase' | 'step' | 'micro_step',
  diagnostics: PlannerReadDiagnostic[],
): T[] {
  const ids = new Set<string>();
  const domainIds = new Set<string>();
  const active: T[] = [];
  for (const row of sortNodes(rows)) {
    if (row.archivedAt !== null) continue;
    if (ids.has(row.id) || domainIds.has(row.domainNodeId)) {
      diagnostics.push({ kind: `duplicate_${kind}` as PlannerReadDiagnostic['kind'], nodeId: row.id, parentId: null });
      continue;
    }
    ids.add(row.id);
    domainIds.add(row.domainNodeId);
    active.push(row);
  }
  return active;
}

function normaliseStatus(value: string, nodeId: string, diagnostics: PlannerReadDiagnostic[]): ProgressStatus {
  if ((PROGRESS_STATUS as readonly string[]).includes(value)) return value as ProgressStatus;
  diagnostics.push({ kind: 'invalid_execution_status', nodeId, parentId: null });
  return 'not_started';
}

function progress(microSteps: readonly PlannerMicroStep[]): PlannerProgress {
  if (microSteps.length === 0) return { ...EMPTY_PROGRESS };
  const completed = microSteps.filter((microStep) => microStep.status === 'completed').length;
  return { total: microSteps.length, completed, percentage: Math.round((completed / microSteps.length) * 100) };
}

function sortNodes<T extends { id: string; order: number }>(nodes: readonly T[]): T[] {
  return [...nodes].sort((left, right) => left.order - right.order || compare(left.id, right.id));
}

function sortDiagnostics(diagnostics: readonly PlannerReadDiagnostic[]): PlannerReadDiagnostic[] {
  return [...diagnostics].sort((left, right) => compare(left.kind, right.kind) || compare(left.nodeId, right.nodeId));
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
