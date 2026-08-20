import type { AssessmentProvenance } from './assessment';
import type { ContentBlock, ContentBlockValue } from '@/lib/match-insights';
import type { PlanMicroStep, PlanNodeReadiness, PlanPhase, PlanReadiness, PlanResult, PlanStep } from './plan';

/** The dedicated hierarchy is intentionally not a producer in the legacy recommendations table. */
export const CORE3_PLAN_PRODUCER = 'core3_deterministic' as const;

export type PersistedPlan = {
  id: string;
  applicationId: string;
  producer: string;
  domainPlanId: string;
  readiness: PlanReadiness;
  archivedAt: string | null;
};

type PersistedPlanningFields = {
  id: string;
  planId: string;
  domainNodeId: string;
  title: string;
  order: number;
  sourceDecisionIds: string[];
  sourceProvenances: AssessmentProvenance[];
  archivedAt: string | null;
};

export type PersistedPlanPhase = PersistedPlanningFields & {
  objective: string;
};

export type PersistedPlanStep = PersistedPlanningFields & {
  phaseId: string;
  objective: string;
};

/** Execution fields are read for preservation but never written by reconciliation. */
export type PersistedPlanMicroStep = PersistedPlanningFields & {
  stepId: string;
  readiness: PlanNodeReadiness;
  contentSchema: ContentBlock | null;
  status: string;
  deadline: string | null;
  contentValue: ContentBlockValue | null;
  executionEvidence: unknown[];
};

export type ExistingPersistedPlan = {
  plan: PersistedPlan | null;
  phases: PersistedPlanPhase[];
  steps: PersistedPlanStep[];
  microSteps: PersistedPlanMicroStep[];
};

type PlanFields = Pick<PersistedPlan, 'domainPlanId' | 'readiness'>;
type PhaseFields = Pick<PersistedPlanPhase, 'domainNodeId' | 'title' | 'objective' | 'order' | 'sourceDecisionIds' | 'sourceProvenances'>;
type StepFields = Pick<PersistedPlanStep, 'domainNodeId' | 'title' | 'objective' | 'order' | 'sourceDecisionIds' | 'sourceProvenances'>;
type MicroStepFields = Pick<PersistedPlanMicroStep, 'domainNodeId' | 'title' | 'order' | 'readiness' | 'contentSchema' | 'sourceDecisionIds' | 'sourceProvenances'>;

export type PlanPersistenceOperation =
  | { kind: 'insert_plan'; applicationId: string; producer: typeof CORE3_PLAN_PRODUCER; fields: PlanFields }
  | { kind: 'update_plan'; id: string; fields: PlanFields }
  | { kind: 'insert_phase'; fields: PhaseFields }
  | { kind: 'update_phase'; id: string; fields: PhaseFields }
  | { kind: 'restore_phase'; id: string; fields: PhaseFields }
  | { kind: 'archive_phase'; id: string }
  | { kind: 'insert_step'; phaseDomainNodeId: string; fields: StepFields }
  | { kind: 'update_step'; id: string; fields: StepFields }
  | { kind: 'restore_step'; id: string; fields: StepFields }
  | { kind: 'archive_step'; id: string }
  | { kind: 'insert_micro_step'; stepDomainNodeId: string; fields: MicroStepFields }
  | { kind: 'update_micro_step'; id: string; fields: MicroStepFields }
  | { kind: 'restore_micro_step'; id: string; fields: MicroStepFields }
  | { kind: 'archive_micro_step'; id: string };

export type PlanPersistenceOperations = {
  operations: PlanPersistenceOperation[];
};

/**
 * Pure, deterministic reconciliation from Core 3's hierarchy to the dedicated
 * persistence model. Node IDs are the only match key; title/category matching
 * is forbidden because generated wording can change between runs.
 */
export function reconcilePlan(
  applicationId: string,
  plan: PlanResult,
  existing: ExistingPersistedPlan,
): PlanPersistenceOperations {
  if (existing.plan && existing.plan.producer !== CORE3_PLAN_PRODUCER) {
    throw new Error('Existing plan belongs to a different producer.');
  }

  const phases = sorted(plan.phases);
  const steps = phases.flatMap((phase) => sorted(phase.steps).map((step) => ({ ...step, phase })));
  const microSteps = steps.flatMap((step) =>
    sorted(step.microSteps).map((microStep) => ({ ...microStep, step })),
  );
  assertUniqueNodeIds(phases.map((phase) => phase.id), 'phase');
  assertUniqueNodeIds(steps.map((step) => step.id), 'step');
  assertUniqueNodeIds(microSteps.map((microStep) => microStep.id), 'micro-step');

  const operations: PlanPersistenceOperation[] = [];
  const planFields = { domainPlanId: plan.id, readiness: plan.readiness };
  if (!existing.plan) {
    operations.push({ kind: 'insert_plan', applicationId, producer: CORE3_PLAN_PRODUCER, fields: planFields });
  } else if (!same(existing.plan, planFields, ['domainPlanId', 'readiness'])) {
    operations.push({ kind: 'update_plan', id: existing.plan.id, fields: planFields });
  }

  reconcileNodes(phases, existing.phases, phaseFields, (phase) => ({ kind: 'insert_phase', fields: phaseFields(phase) }), (id, fields) => ({ kind: 'update_phase', id, fields }), (id, fields) => ({ kind: 'restore_phase', id, fields }), (id) => ({ kind: 'archive_phase', id }), operations);
  reconcileNodes(steps, existing.steps, stepFields, (step) => ({ kind: 'insert_step', phaseDomainNodeId: step.phase.id, fields: stepFields(step) }), (id, fields) => ({ kind: 'update_step', id, fields }), (id, fields) => ({ kind: 'restore_step', id, fields }), (id) => ({ kind: 'archive_step', id }), operations);
  reconcileNodes(microSteps, existing.microSteps, microStepFields, (microStep) => ({ kind: 'insert_micro_step', stepDomainNodeId: microStep.step.id, fields: microStepFields(microStep) }), (id, fields) => ({ kind: 'update_micro_step', id, fields }), (id, fields) => ({ kind: 'restore_micro_step', id, fields }), (id) => ({ kind: 'archive_micro_step', id }), operations);

  return { operations };
}

function reconcileNodes<TTarget extends { id: string }, TPersisted extends PersistedPlanningFields, TFields extends object>(
  targets: readonly TTarget[],
  persisted: readonly TPersisted[],
  toFields: (target: TTarget) => TFields,
  insert: (target: TTarget) => PlanPersistenceOperation,
  update: (id: string, fields: TFields) => PlanPersistenceOperation,
  restore: (id: string, fields: TFields) => PlanPersistenceOperation,
  archive: (id: string) => PlanPersistenceOperation,
  operations: PlanPersistenceOperation[],
) {
  const existingByNodeId = new Map(persisted.map((node) => [node.domainNodeId, node]));
  const targetIds = new Set(targets.map((target) => target.id));

  for (const target of targets) {
    const current = existingByNodeId.get(target.id);
    const fields = toFields(target);
    if (!current) operations.push(insert(target));
    else if (current.archivedAt !== null) operations.push(restore(current.id, fields));
    else if (!same(current, fields, Object.keys(fields))) operations.push(update(current.id, fields));
  }

  for (const node of [...persisted].filter((item) => item.archivedAt === null && !targetIds.has(item.domainNodeId)).sort((left, right) => compare(left.domainNodeId, right.domainNodeId))) {
    operations.push(archive(node.id));
  }
}

function phaseFields(phase: PlanPhase): PhaseFields {
  return { ...planningFields(phase), objective: phase.objective };
}

function stepFields(step: PlanStep): StepFields {
  return { ...planningFields(step), objective: step.objective };
}

function microStepFields(microStep: PlanMicroStep): MicroStepFields {
  return { ...planningFields(microStep), readiness: microStep.readiness, contentSchema: microStep.contentSchema ?? null };
}

function planningFields(node: Pick<PlanPhase, 'id' | 'title' | 'order' | 'sourceDecisionIds' | 'sourceProvenances'>): Omit<PhaseFields, 'objective'> {
  return {
    domainNodeId: node.id,
    title: node.title,
    order: node.order,
    sourceDecisionIds: [...node.sourceDecisionIds].sort(compare),
    sourceProvenances: [...node.sourceProvenances].sort(compare),
  };
}

function sorted<T extends { id: string; order: number }>(nodes: readonly T[]): T[] {
  return [...nodes].sort((left, right) => left.order - right.order || compare(left.id, right.id));
}

function assertUniqueNodeIds(ids: readonly string[], type: string) {
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${type} deterministic ID.`);
}

function same(left: object, right: object, keys: readonly string[]): boolean {
  return keys.every((key) => canonical((left as Record<string, unknown>)[key as string]) === canonical((right as Record<string, unknown>)[key as string]));
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort(compare).map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
