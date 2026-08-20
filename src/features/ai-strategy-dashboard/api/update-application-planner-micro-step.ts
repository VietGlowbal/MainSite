import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CORE3_PLAN_PRODUCER,
  PROGRESS_STATUS,
  type PlannerMicroStepExecutionPatch,
  type PlannerMicroStepExecutionState,
} from '../domain';

export class PlannerMicroStepUpdateError extends Error {
  constructor(readonly code: 'not_found' | 'read_failed' | 'update_failed') {
    super(code === 'not_found' ? 'Micro-step is not available.' : 'Could not save this task.');
    this.name = 'PlannerMicroStepUpdateError';
  }
}

/**
 * Updates only Core 4-owned execution fields after walking the ownership
 * chain. It intentionally cannot write title, hierarchy, provenance, order,
 * readiness, or content_schema.
 */
export async function updateApplicationPlannerMicroStep(
  supabase: SupabaseClient,
  applicationId: string,
  userId: string,
  microStepId: string,
  patch: PlannerMicroStepExecutionPatch,
): Promise<PlannerMicroStepExecutionState> {
  const ownership = await supabase.from('course_applications').select('id')
    .eq('id', applicationId).eq('user_id', userId).maybeSingle();
  if (ownership.error) throw new PlannerMicroStepUpdateError('read_failed');
  if (!ownership.data) throw new PlannerMicroStepUpdateError('not_found');

  const plan = await supabase.from('application_plans').select('id')
    .eq('application_id', applicationId).eq('producer', CORE3_PLAN_PRODUCER)
    .is('archived_at', null).maybeSingle();
  if (plan.error) throw new PlannerMicroStepUpdateError('read_failed');
  if (!plan.data) throw new PlannerMicroStepUpdateError('not_found');

  const phases = await supabase.from('application_plan_phases').select('id')
    .eq('plan_id', plan.data.id).is('archived_at', null);
  if (phases.error) throw new PlannerMicroStepUpdateError('read_failed');
  const phaseIds = (phases.data ?? []).map((phase) => (phase as { id: string }).id);
  if (phaseIds.length === 0) throw new PlannerMicroStepUpdateError('not_found');

  const steps = await supabase.from('application_plan_steps').select('id')
    .in('phase_id', phaseIds).is('archived_at', null);
  if (steps.error) throw new PlannerMicroStepUpdateError('read_failed');
  const stepIds = (steps.data ?? []).map((step) => (step as { id: string }).id);
  if (stepIds.length === 0) throw new PlannerMicroStepUpdateError('not_found');

  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) fields.status = patch.status;
  if (patch.deadline !== undefined) fields.deadline = patch.deadline;
  if (patch.contentValue !== undefined) fields.content_value = patch.contentValue;

  const updated = await supabase.from('application_plan_micro_steps').update(fields)
    .eq('id', microStepId).in('step_id', stepIds).is('archived_at', null)
    .select('id, status, deadline, content_value').maybeSingle();
  if (updated.error) throw new PlannerMicroStepUpdateError('update_failed');
  if (!updated.data) throw new PlannerMicroStepUpdateError('not_found');

  const row = updated.data as Record<string, unknown>;
  return {
    id: typeof row.id === 'string' ? row.id : microStepId,
    status: isProgressStatus(row.status) ? row.status : 'not_started',
    deadline: typeof row.deadline === 'string' ? row.deadline : null,
    contentValue: (row.content_value ?? null) as PlannerMicroStepExecutionState['contentValue'],
  };
}

function isProgressStatus(value: unknown): value is PlannerMicroStepExecutionState['status'] {
  return typeof value === 'string' && (PROGRESS_STATUS as readonly string[]).includes(value);
}
