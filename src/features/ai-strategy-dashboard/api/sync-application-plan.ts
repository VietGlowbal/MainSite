import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CORE3_PLAN_PRODUCER,
  reconcilePlan,
  type ExistingPersistedPlan,
  type PersistedPlan,
  type PersistedPlanMicroStep,
  type PersistedPlanPhase,
  type PersistedPlanStep,
  type PlanPersistenceOperation,
} from '../domain';
import { getApplicationPlan } from './get-application-plan';

export type SyncApplicationPlanResult = {
  inserted: number;
  updated: number;
  restored: number;
  archived: number;
};

/** Raised when a scoped read or write fails; callers must not treat it as an empty plan. */
export class PlanPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanPersistenceError';
  }
}

/**
 * Persists Core 3's plan in its own hierarchy. The user-scoped client and the
 * explicit application ownership check make every mutation application-local.
 *
 * Supabase's browser/server JS client has no multi-statement transaction API,
 * so this applies dependency-ordered, individually atomic writes. Re-running
 * the deterministic reconcile after a partial failure is safe and convergent.
 */
export async function syncApplicationPlan(
  supabase: SupabaseClient,
  applicationId: string,
  userId: string,
): Promise<SyncApplicationPlanResult> {
  const ownership = await supabase
    .from('course_applications')
    .select('id')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (ownership.error) throw new PlanPersistenceError(`Could not verify application ownership: ${ownership.error.message}`);
  if (!ownership.data) throw new PlanPersistenceError('Application was not found for this user.');

  const [plan, existing] = await Promise.all([
    getApplicationPlan(supabase, applicationId, userId),
    loadExistingPlan(supabase, applicationId),
  ]);
  const operations = reconcilePlan(applicationId, plan, existing).operations;
  return applyPlanOperations(supabase, operations, existing);
}

async function loadExistingPlan(supabase: SupabaseClient, applicationId: string): Promise<ExistingPersistedPlan> {
  const planResult = await supabase
    .from('application_plans')
    .select('id, application_id, producer, domain_plan_id, readiness, archived_at')
    .eq('application_id', applicationId)
    .eq('producer', CORE3_PLAN_PRODUCER)
    .is('archived_at', null)
    .maybeSingle();
  if (planResult.error) throw new PlanPersistenceError(`Could not load the Core 3 plan: ${planResult.error.message}`);
  if (!planResult.data) return { plan: null, phases: [], steps: [], microSteps: [] };

  const plan = planFromRow(planResult.data);
  const phasesResult = await supabase
    .from('application_plan_phases')
    .select('id, plan_id, domain_node_id, title, objective, sort_order, source_decision_ids, source_provenances, archived_at')
    .eq('plan_id', plan.id);
  if (phasesResult.error) throw new PlanPersistenceError(`Could not load plan phases: ${phasesResult.error.message}`);
  const phases = (phasesResult.data ?? []).map(phaseFromRow);

  const stepsResult = phases.length === 0
    ? { data: [], error: null }
    : await supabase
      .from('application_plan_steps')
      .select('id, phase_id, domain_node_id, title, objective, sort_order, source_decision_ids, source_provenances, archived_at')
      .in('phase_id', phases.map((phase) => phase.id));
  if (stepsResult.error) throw new PlanPersistenceError(`Could not load plan steps: ${stepsResult.error.message}`);
  const steps = (stepsResult.data ?? []).map(stepFromRow.bind(null, plan.id));

  const microStepsResult = steps.length === 0
    ? { data: [], error: null }
    : await supabase
      .from('application_plan_micro_steps')
      .select('id, step_id, domain_node_id, title, sort_order, readiness, content_schema, source_decision_ids, source_provenances, status, deadline, content_value, execution_evidence, archived_at')
      .in('step_id', steps.map((step) => step.id));
  if (microStepsResult.error) throw new PlanPersistenceError(`Could not load plan micro-steps: ${microStepsResult.error.message}`);

  return { plan, phases, steps, microSteps: (microStepsResult.data ?? []).map((row) => microStepFromRow(plan.id, row)) };
}

async function applyPlanOperations(
  supabase: SupabaseClient,
  operations: readonly PlanPersistenceOperation[],
  existing: ExistingPersistedPlan,
): Promise<SyncApplicationPlanResult> {
  const ids = {
    planId: existing.plan?.id,
    phases: new Map(existing.phases.map((phase) => [phase.domainNodeId, phase.id])),
    steps: new Map(existing.steps.map((step) => [step.domainNodeId, step.id])),
  };
  const result: SyncApplicationPlanResult = { inserted: 0, updated: 0, restored: 0, archived: 0 };
  const now = new Date().toISOString();

  for (const operation of operations) {
    switch (operation.kind) {
      case 'insert_plan': {
        const response = await supabase.from('application_plans').insert({
          application_id: operation.applicationId, producer: operation.producer,
          domain_plan_id: operation.fields.domainPlanId, readiness: operation.fields.readiness,
        }).select('id').single();
        ids.planId = rowId(response, 'insert Core 3 plan');
        result.inserted += 1;
        break;
      }
      case 'update_plan':
        await updateById(supabase, 'application_plans', operation.id, { domain_plan_id: operation.fields.domainPlanId, readiness: operation.fields.readiness, updated_at: now }, 'update Core 3 plan');
        result.updated += 1;
        break;
      case 'insert_phase': {
        const response = await supabase.from('application_plan_phases').insert({ plan_id: requiredId(ids.planId, 'plan'), ...phasePayload(operation.fields) }).select('id').single();
        ids.phases.set(operation.fields.domainNodeId, rowId(response, 'insert plan phase'));
        result.inserted += 1;
        break;
      }
      case 'update_phase':
        await updateById(supabase, 'application_plan_phases', operation.id, { ...phasePayload(operation.fields), updated_at: now }, 'update plan phase');
        result.updated += 1;
        break;
      case 'restore_phase':
        await updateById(supabase, 'application_plan_phases', operation.id, { ...phasePayload(operation.fields), archived_at: null, updated_at: now }, 'restore plan phase');
        ids.phases.set(operation.fields.domainNodeId, operation.id);
        result.restored += 1;
        break;
      case 'archive_phase':
        await updateById(supabase, 'application_plan_phases', operation.id, { archived_at: now, updated_at: now }, 'archive plan phase');
        result.archived += 1;
        break;
      case 'insert_step': {
        const response = await supabase.from('application_plan_steps').insert({ phase_id: requiredId(ids.phases.get(operation.phaseDomainNodeId), 'phase'), ...stepPayload(operation.fields) }).select('id').single();
        ids.steps.set(operation.fields.domainNodeId, rowId(response, 'insert plan step'));
        result.inserted += 1;
        break;
      }
      case 'update_step':
        await updateById(supabase, 'application_plan_steps', operation.id, { ...stepPayload(operation.fields), updated_at: now }, 'update plan step');
        result.updated += 1;
        break;
      case 'restore_step':
        await updateById(supabase, 'application_plan_steps', operation.id, { ...stepPayload(operation.fields), archived_at: null, updated_at: now }, 'restore plan step');
        ids.steps.set(operation.fields.domainNodeId, operation.id);
        result.restored += 1;
        break;
      case 'archive_step':
        await updateById(supabase, 'application_plan_steps', operation.id, { archived_at: now, updated_at: now }, 'archive plan step');
        result.archived += 1;
        break;
      case 'insert_micro_step':
        await insertMicroStep(supabase, requiredId(ids.steps.get(operation.stepDomainNodeId), 'step'), microStepPayload(operation.fields), 'insert plan micro-step');
        result.inserted += 1;
        break;
      case 'update_micro_step':
        await updateById(supabase, 'application_plan_micro_steps', operation.id, { ...microStepPayload(operation.fields), updated_at: now }, 'update plan micro-step');
        result.updated += 1;
        break;
      case 'restore_micro_step':
        await updateById(supabase, 'application_plan_micro_steps', operation.id, { ...microStepPayload(operation.fields), archived_at: null, updated_at: now }, 'restore plan micro-step');
        result.restored += 1;
        break;
      case 'archive_micro_step':
        await updateById(supabase, 'application_plan_micro_steps', operation.id, { archived_at: now, updated_at: now }, 'archive plan micro-step');
        result.archived += 1;
        break;
    }
  }
  return result;
}

function phasePayload(fields: Extract<PlanPersistenceOperation, { kind: 'insert_phase' }>['fields']) {
  return { domain_node_id: fields.domainNodeId, title: fields.title, objective: fields.objective, sort_order: fields.order, source_decision_ids: fields.sourceDecisionIds, source_provenances: fields.sourceProvenances };
}

function stepPayload(fields: Extract<PlanPersistenceOperation, { kind: 'insert_step' }>['fields']) {
  return { domain_node_id: fields.domainNodeId, title: fields.title, objective: fields.objective, sort_order: fields.order, source_decision_ids: fields.sourceDecisionIds, source_provenances: fields.sourceProvenances };
}

function microStepPayload(fields: Extract<PlanPersistenceOperation, { kind: 'insert_micro_step' }>['fields']) {
  return { domain_node_id: fields.domainNodeId, title: fields.title, sort_order: fields.order, readiness: fields.readiness, content_schema: fields.contentSchema, source_decision_ids: fields.sourceDecisionIds, source_provenances: fields.sourceProvenances };
}

async function insertMicroStep(supabase: SupabaseClient, stepId: string, fields: ReturnType<typeof microStepPayload>, action: string) {
  const response = await supabase.from('application_plan_micro_steps').insert({ step_id: stepId, ...fields });
  if (response.error) throw new PlanPersistenceError(`Could not ${action}: ${response.error.message}`);
}

async function updateById(supabase: SupabaseClient, table: string, id: string, fields: Record<string, unknown>, action: string) {
  const response = await supabase.from(table).update(fields).eq('id', id);
  if (response.error) throw new PlanPersistenceError(`Could not ${action}: ${response.error.message}`);
}

function rowId(response: { data: unknown; error: { message: string } | null }, action: string): string {
  if (response.error) throw new PlanPersistenceError(`Could not ${action}: ${response.error.message}`);
  const id = (response.data as { id?: unknown } | null)?.id;
  if (typeof id !== 'string') throw new PlanPersistenceError(`Could not ${action}: database returned no ID.`);
  return id;
}

function requiredId(value: string | undefined, parent: string): string {
  if (!value) throw new PlanPersistenceError(`Cannot persist a node without its ${parent} ID.`);
  return value;
}

function planFromRow(row: Record<string, unknown>): PersistedPlan {
  return { id: text(row.id), applicationId: text(row.application_id), producer: text(row.producer), domainPlanId: text(row.domain_plan_id), readiness: planReadiness(row.readiness), archivedAt: nullableText(row.archived_at) };
}

function phaseFromRow(row: Record<string, unknown>): PersistedPlanPhase {
  return { id: text(row.id), planId: text(row.plan_id), domainNodeId: text(row.domain_node_id), title: text(row.title), objective: text(row.objective), order: number(row.sort_order), sourceDecisionIds: texts(row.source_decision_ids), sourceProvenances: provenances(row.source_provenances), archivedAt: nullableText(row.archived_at) };
}

function stepFromRow(planId: string, row: Record<string, unknown>): PersistedPlanStep {
  return { id: text(row.id), planId, phaseId: text(row.phase_id), domainNodeId: text(row.domain_node_id), title: text(row.title), objective: text(row.objective), order: number(row.sort_order), sourceDecisionIds: texts(row.source_decision_ids), sourceProvenances: provenances(row.source_provenances), archivedAt: nullableText(row.archived_at) };
}

function microStepFromRow(planId: string, row: Record<string, unknown>): PersistedPlanMicroStep {
  return { id: text(row.id), planId, stepId: text(row.step_id), domainNodeId: text(row.domain_node_id), title: text(row.title), order: number(row.sort_order), readiness: nodeReadiness(row.readiness), contentSchema: (row.content_schema ?? null) as PersistedPlanMicroStep['contentSchema'], sourceDecisionIds: texts(row.source_decision_ids), sourceProvenances: provenances(row.source_provenances), status: text(row.status), deadline: nullableText(row.deadline), contentValue: (row.content_value ?? null) as PersistedPlanMicroStep['contentValue'], executionEvidence: Array.isArray(row.execution_evidence) ? row.execution_evidence : [], archivedAt: nullableText(row.archived_at) };
}

function text(value: unknown): string { return typeof value === 'string' ? value : ''; }
function nullableText(value: unknown): string | null { return typeof value === 'string' ? value : null; }
function number(value: unknown): number { return typeof value === 'number' ? value : 0; }
function texts(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
function provenances(value: unknown): PersistedPlanPhase['sourceProvenances'] { return texts(value).filter((value): value is PersistedPlanPhase['sourceProvenances'][number] => ['database_factual', 'ai_generated', 'user_provided', 'derived'].includes(value)); }
function planReadiness(value: unknown): PersistedPlan['readiness'] { return value === 'empty' || value === 'requires_user_input' || value === 'requires_enrichment' ? value : 'empty'; }
function nodeReadiness(value: unknown): PersistedPlanMicroStep['readiness'] { return value === 'requires_user_input' || value === 'requires_enrichment' ? value : 'requires_enrichment'; }
