import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildPlannerReadModel,
  CORE3_PLAN_PRODUCER,
  type ExistingPersistedPlan,
  type PersistedPlan,
  type PersistedPlanMicroStep,
  type PersistedPlanPhase,
  type PersistedPlanStep,
  type PlannerReadModel,
} from '../domain';

/** A hierarchy read failure is never represented as an empty Planner. */
export class PlannerReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlannerReadError';
  }
}

/**
 * Core 4's canonical, read-only boundary. It reads only the persisted Core 3
 * hierarchy, never legacy application_recommendations, and uses a bounded five
 * queries for a populated plan (ownership, root, phases, steps, micro-steps).
 */
export async function getApplicationPlanner(
  supabase: SupabaseClient,
  applicationId: string,
  userId: string,
): Promise<PlannerReadModel> {
  const ownership = await supabase
    .from('course_applications')
    .select('id')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (ownership.error) throw new PlannerReadError(`Could not verify application ownership: ${ownership.error.message}`);
  if (!ownership.data) throw new PlannerReadError('Application was not found for this user.');

  const root = await supabase
    .from('application_plans')
    .select('id, application_id, producer, domain_plan_id, readiness, archived_at')
    .eq('application_id', applicationId)
    .eq('producer', CORE3_PLAN_PRODUCER)
    .is('archived_at', null)
    .maybeSingle();
  if (root.error) throw new PlannerReadError(`Could not load the Core 3 plan: ${root.error.message}`);

  // Strategy A: no legacy fallback. Existing apps with no persisted Core 3
  // plan receive an empty canonical model while their current legacy Planner
  // continues unchanged until a deliberate UI migration/backfill is chosen.
  if (!root.data) return buildPlannerReadModel({ plan: null, phases: [], steps: [], microSteps: [] });

  const rows = await loadHierarchyRows(supabase, planFromRow(root.data));
  return buildPlannerReadModel(rows);
}

async function loadHierarchyRows(supabase: SupabaseClient, plan: PersistedPlan): Promise<ExistingPersistedPlan> {
  const phasesResult = await supabase
    .from('application_plan_phases')
    .select('id, plan_id, domain_node_id, title, objective, sort_order, source_decision_ids, source_provenances, archived_at')
    .eq('plan_id', plan.id);
  if (phasesResult.error) throw new PlannerReadError(`Could not load plan phases: ${phasesResult.error.message}`);
  const phases = (phasesResult.data ?? []).map(phaseFromRow);

  const stepsResult = phases.length === 0
    ? { data: [], error: null }
    : await supabase
      .from('application_plan_steps')
      .select('id, phase_id, domain_node_id, title, objective, sort_order, source_decision_ids, source_provenances, archived_at')
      .in('phase_id', phases.map((phase) => phase.id));
  if (stepsResult.error) throw new PlannerReadError(`Could not load plan steps: ${stepsResult.error.message}`);
  const steps = (stepsResult.data ?? []).map((row) => stepFromRow(plan.id, row));

  const microStepsResult = steps.length === 0
    ? { data: [], error: null }
    : await supabase
      .from('application_plan_micro_steps')
      .select('id, step_id, domain_node_id, title, sort_order, readiness, content_schema, source_decision_ids, source_provenances, status, deadline, content_value, execution_evidence, archived_at')
      .in('step_id', steps.map((step) => step.id));
  if (microStepsResult.error) throw new PlannerReadError(`Could not load plan micro-steps: ${microStepsResult.error.message}`);

  return { plan, phases, steps, microSteps: (microStepsResult.data ?? []).map((row) => microStepFromRow(plan.id, row)) };
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
function provenances(value: unknown): PersistedPlanPhase['sourceProvenances'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string' && ['database_factual', 'deterministically_derived', 'ai_generated', 'user_provided', 'unknown'].includes(item)) return [item as PersistedPlanPhase['sourceProvenances'][number]];
    if (item && typeof item === 'object' && (item as Record<string, unknown>).kind === 'ai_planning') return [item as PersistedPlanPhase['sourceProvenances'][number]];
    return [];
  });
}
function planReadiness(value: unknown): PersistedPlan['readiness'] { return value === 'empty' || value === 'requires_user_input' || value === 'requires_enrichment' ? value : 'empty'; }
function nodeReadiness(value: unknown): PersistedPlanMicroStep['readiness'] { return value === 'requires_user_input' || value === 'requires_enrichment' ? value : 'requires_enrichment'; }
