import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/server/db/admin';
import { getApplicationAssessments } from './get-application-assessments';
import { getApplicationPlanner } from './get-application-planner';
import { getPlannerMode } from './planner-mode';
import { claimPlannerGeneration, finishPlannerGeneration, upsertPlannerOps } from './planner-ops-store';
import { syncApplicationPlan } from './sync-application-plan';
import { isPlannerStale, planFingerprint, plannerLifecycle, plannerSourceFingerprint, type PlannerFailureCode } from '../domain';

export type PlannerRefreshTrigger = 'initial_create' | 'semantic_input' | 'source_change' | 'manual_refresh' | 'retry';
export type PlannerRefreshResult = { refreshed: boolean; skipped: boolean; reason?: 'not_entitled' | 'current' | 'concurrent'; runId?: string };

/** Controlled, cross-instance-safe refresh. A failed run never archives the old plan. */
export async function refreshApplicationPlan(supabase: SupabaseClient, applicationId: string, userId: string, trigger: PlannerRefreshTrigger): Promise<PlannerRefreshResult> {
  if (await getPlannerMode(supabase, userId) !== 'canonical') return { refreshed: false, skipped: true, reason: 'not_entitled' };
  const admin = createAdminClient();
  const existing = await getApplicationPlanner(supabase, applicationId, userId).catch(() => null);
  const runId = await claimPlannerGeneration(admin, { applicationId, trigger, sourceFingerprint: null });
  if (!runId) return { refreshed: false, skipped: true, reason: 'concurrent' };
  let currentFingerprint: string | null = null;
  try {
    const { context } = await getApplicationAssessments(supabase, applicationId, userId);
    const fingerprint = plannerSourceFingerprint(context);
    currentFingerprint = fingerprint;
    const previousFingerprint = planFingerprint(existing?.plan?.domainPlanId);
    if (trigger !== 'manual_refresh' && trigger !== 'retry' && existing?.plan && !isPlannerStale(fingerprint, previousFingerprint)) {
      await finishPlannerGeneration(admin, runId, { status: 'success', sourceFingerprint: fingerprint, aiStatus: 'not_required' });
      return { refreshed: false, skipped: true, reason: 'current', runId };
    }
    const staleSince = existing?.plan && isPlannerStale(fingerprint, previousFingerprint)
      ? new Date().toISOString()
      : null;
    await upsertPlannerOps(admin, applicationId, { lifecycle: 'refreshing', source_fingerprint: fingerprint, plan_fingerprint: previousFingerprint, stale_since: staleSince, generation_status: 'running', last_attempt_at: new Date().toISOString(), failure_code: null });
    let enrichment: { enriched: boolean; fallbackReason?: string } = { enriched: false };
    await syncApplicationPlan(admin, applicationId, userId, { onEnrichment: (result) => { enrichment = result; } });
    const updated = await getApplicationPlanner(admin, applicationId, userId);
    const nextFingerprint = planFingerprint(updated.plan?.domainPlanId);
    const ai = findAiProvenance(updated);
    const lifecycle = plannerLifecycle({ readModel: updated, stale: false });
    const aiStatus = enrichment.enriched ? 'success' : enrichment.fallbackReason === 'not_configured' ? 'not_required' : ai ? 'success' : enrichment.fallbackReason ? 'fallback' : 'not_required';
    await finishPlannerGeneration(admin, runId, { status: 'success', sourceFingerprint: fingerprint, planId: updated.plan?.id ?? null, aiStatus, provider: ai?.provider ?? null, model: ai?.model ?? null, promptVersion: ai?.promptVersion ?? null, enrichmentVersion: ai?.enrichmentVersion ?? null });
    await upsertPlannerOps(admin, applicationId, { lifecycle, source_fingerprint: fingerprint, plan_fingerprint: nextFingerprint, stale_since: null, generation_status: 'success', last_success_at: new Date().toISOString(), failure_code: null, ai_status: aiStatus, ai_provider: ai?.provider ?? null, ai_model: ai?.model ?? null, ai_prompt_version: ai?.promptVersion ?? null, ai_enrichment_version: ai?.enrichmentVersion ?? null });
    return { refreshed: true, skipped: false, runId };
  } catch (error) {
    const failureCode = classifyPlannerFailure(error);
    await finishPlannerGeneration(admin, runId, { status: 'failed', sourceFingerprint: currentFingerprint, aiStatus: 'failed', failureCode }).catch(() => undefined);
    await upsertPlannerOps(admin, applicationId, { lifecycle: 'failed', generation_status: 'failed', failure_code: failureCode, ai_status: 'failed' }).catch(() => undefined);
    console.error('[planner/ops] refresh failed', { applicationId, userId, error });
    throw error;
  }
}

function classifyPlannerFailure(error: unknown): PlannerFailureCode {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (/application_planner_(ops|generation_runs)|relation .* does not exist|schema cache/.test(message)) return 'migration_unavailable';
  if (/enrichment|openai|ai /.test(message)) return 'ai_enrichment_failed';
  if (/validation|invalid output|unknown decision|unknown schema/.test(message)) return 'validation_failed';
  if (/not enough|missing required|needs user input/.test(message)) return 'not_enough_data';
  if (/source|assessment|programme|requirement|strategy|fetch|could not load/.test(message)) return 'source_unavailable';
  if (/persist|persistence|atomic|insert|update|database/.test(message)) return 'persistence_failed';
  return 'unknown';
}

function findAiProvenance(planner: Awaited<ReturnType<typeof getApplicationPlanner>>) {
  for (const micro of planner.phases.flatMap((phase) => phase.steps).flatMap((step) => step.microSteps)) {
    const provenance = micro.sourceProvenances.find((item): item is Extract<typeof item, { kind: 'ai_planning' }> => typeof item === 'object' && item !== null && item.kind === 'ai_planning');
    if (provenance) return provenance;
  }
  return null;
}
