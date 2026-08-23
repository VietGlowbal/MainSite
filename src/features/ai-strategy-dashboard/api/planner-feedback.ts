import { createAdminClient } from '@/lib/supabase/admin';

export type PlannerFeedbackInput = { targetType: 'plan' | 'micro_step'; targetId?: string | null; rating?: number | null; reason?: string | null; comment?: string | null };

/** Trusted server repository for feedback; target ownership is rechecked here. */
export async function savePlannerFeedback(applicationId: string, userId: string, input: PlannerFeedbackInput) {
  const admin = createAdminClient();
  const { data: application } = await admin.from('course_applications').select('id').eq('id', applicationId).eq('user_id', userId).maybeSingle();
  if (!application) return { kind: 'not_found' as const };
  const { data: plan } = await admin.from('application_plans').select('id').eq('application_id', applicationId).eq('producer', 'core3_deterministic').is('archived_at', null).maybeSingle();
  if (!plan) return { kind: 'not_found' as const };
  if (input.targetType === 'micro_step') {
    const { data: micro } = await admin.from('application_plan_micro_steps').select('id,step_id,archived_at').eq('id', input.targetId!).maybeSingle();
    if (!micro || micro.archived_at) return { kind: 'target_not_found' as const };
    const { data: step } = await admin.from('application_plan_steps').select('id,phase_id').eq('id', micro.step_id).maybeSingle();
    const { data: phase } = step ? await admin.from('application_plan_phases').select('id,plan_id').eq('id', step.phase_id).maybeSingle() : { data: null };
    if (!phase || phase.plan_id !== plan.id) return { kind: 'target_not_found' as const };
  }
  const targetId = input.targetId ?? null;
  const existingQuery = admin.from('application_planner_feedback').select('id').eq('user_id', userId).eq('application_id', applicationId).eq('plan_id', plan.id).eq('target_type', input.targetType);
  const existing = targetId ? await existingQuery.eq('target_id', targetId).maybeSingle() : await existingQuery.is('target_id', null).maybeSingle();
  const fields = { rating: input.rating ?? null, reason: input.reason ?? null, comment: input.comment || null, updated_at: new Date().toISOString() };
  if (existing.data) {
    const result = await admin.from('application_planner_feedback').update(fields).eq('id', existing.data.id);
    if (result.error) return { kind: 'failed' as const };
    return { kind: 'saved' as const, id: existing.data.id as string };
  }
  const result = await admin.from('application_planner_feedback').insert({ ...fields, application_id: applicationId, plan_id: plan.id, user_id: userId, target_type: input.targetType, target_id: targetId }).select('id').single();
  if (result.error) return { kind: 'failed' as const };
  return { kind: 'saved' as const, id: result.data.id as string };
}

export async function listPlannerOpsAdmin() {
  const admin = createAdminClient();
  const { data: rows } = await admin.from('application_planner_ops').select('application_id,lifecycle,generation_status,last_attempt_at,last_success_at,failure_code,ai_status,ai_model,source_fingerprint,plan_fingerprint').order('updated_at', { ascending: false }).limit(200);
  const ids = (rows ?? []).map((row) => row.application_id);
  const { data: applications } = ids.length ? await admin.from('course_applications').select('id,course_name,university_name,user_id').in('id', ids) : { data: [] };
  return { rows: rows ?? [], applications: applications ?? [] };
}
