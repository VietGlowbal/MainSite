import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlannerFailureCode, PlannerOpsLifecycle, PlannerAiStatus } from '../domain';

export type PlannerOpsRow = {
  application_id: string;
  lifecycle: PlannerOpsLifecycle;
  source_fingerprint: string | null;
  plan_fingerprint: string | null;
  stale_since: string | null;
  generation_status: 'idle' | 'running' | 'success' | 'failed';
  last_attempt_at: string | null;
  last_success_at: string | null;
  failure_code: PlannerFailureCode | null;
  ai_status: PlannerAiStatus;
  ai_provider: string | null;
  ai_model: string | null;
  ai_prompt_version: string | null;
  ai_enrichment_version: string | null;
  completed_at: string | null;
};

export async function readPlannerOps(supabase: SupabaseClient, applicationId: string): Promise<PlannerOpsRow | null> {
  const result = await supabase.from('application_planner_ops').select('*').eq('application_id', applicationId).maybeSingle();
  if (result.error) throw new Error(`Could not read Planner Ops: ${result.error.message}`);
  return result.data as PlannerOpsRow | null;
}

export async function upsertPlannerOps(supabase: SupabaseClient, applicationId: string, patch: Partial<PlannerOpsRow>) {
  const result = await supabase.from('application_planner_ops').upsert({ application_id: applicationId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'application_id' });
  if (result.error) throw new Error(`Could not write Planner Ops: ${result.error.message}`);
}

export async function claimPlannerGeneration(supabase: SupabaseClient, input: { applicationId: string; trigger: string; sourceFingerprint: string | null }) {
  const result = await supabase.from('application_planner_generation_runs').insert({ application_id: input.applicationId, trigger: input.trigger, source_fingerprint: input.sourceFingerprint, status: 'running' }).select('id').single();
  if (result.error) {
    if (result.error.code === '23505') return null;
    throw new Error(`Could not claim Planner generation: ${result.error.message}`);
  }
  return result.data.id as string;
}

export async function finishPlannerGeneration(supabase: SupabaseClient, runId: string, patch: { status: 'success' | 'failed'; sourceFingerprint?: string | null; planId?: string | null; aiStatus?: PlannerAiStatus; failureCode?: PlannerFailureCode | null; provider?: string | null; model?: string | null; promptVersion?: string | null; enrichmentVersion?: string | null }) {
  const result = await supabase.from('application_planner_generation_runs').update({ source_fingerprint: patch.sourceFingerprint ?? null, plan_id: patch.planId ?? null, status: patch.status, ai_status: patch.aiStatus ?? null, failure_code: patch.failureCode ?? null, provider: patch.provider ?? null, model: patch.model ?? null, prompt_version: patch.promptVersion ?? null, enrichment_version: patch.enrichmentVersion ?? null, completed_at: new Date().toISOString() }).eq('id', runId);
  if (result.error) throw new Error(`Could not finish Planner generation: ${result.error.message}`);
}
