import type { SupabaseClient } from '@supabase/supabase-js';
import { isPlusEntitlementActive } from '@/lib/entitlements/entitlement-service';
import { createAdminClient } from '@/server/db/admin';
import { isAdmin } from '@/server/auth/auth-helpers';
import { getApplicationPlanner } from './get-application-planner';
import { getApplicationAssessments } from './get-application-assessments';
import { syncApplicationPlan } from './sync-application-plan';
import { getPlannerMicroSteps } from '../domain';

export type PlannerMode = 'canonical' | 'legacy';
export type EnsureApplicationPlanResult =
  | { kind: 'ready'; created: boolean }
  | { kind: 'not_entitled' }
  | { kind: 'not_found' }
  | { kind: 'failed' };

/** Single server-side rollout boundary: Plus and admins use canonical Planner. */
export async function getPlannerMode(supabase: SupabaseClient, userId: string): Promise<PlannerMode> {
  const { data } = await supabase.from('student_profiles')
    .select('plus_status,plus_expires_at,is_admin').eq('user_id', userId).maybeSingle();
  return isPlusEntitlementActive(data ?? {}) || await isAdmin(userId) ? 'canonical' : 'legacy';
}

/**
 * Idempotent production initializer and source-change reconciler. The Core 1
 * fingerprint is deterministic and does not make an AI request; a changed
 * fingerprint is the only page-load condition that can start enrichment.
 */
export async function ensureApplicationPlan(
  supabase: SupabaseClient,
  applicationId: string,
  userId: string,
): Promise<EnsureApplicationPlanResult> {
  if (await getPlannerMode(supabase, userId) !== 'canonical') return { kind: 'not_entitled' };
  const { data: application, error } = await supabase.from('course_applications').select('id')
    .eq('id', applicationId).eq('user_id', userId).maybeSingle();
  if (error || !application) return { kind: 'not_found' };
  try {
    const existing = await getApplicationPlanner(supabase, applicationId, userId);
    // One-time rollout upgrade: early foundation plans have the attention
    // decision node but no schema. Reconcile once so it becomes a real input;
    // normal existing plans are never regenerated on page load.
    const needsInputUpgrade = getPlannerMicroSteps(existing).some((micro) =>
      micro.domainNodeId.includes('attention-focus') && micro.contentSchema === null,
    );
    const { context } = await getApplicationAssessments(supabase, applicationId, userId);
    const sourceFingerprint = `:source:${context.provenance.contextHash}`;
    const sourceChanged = existing.plan !== null && !existing.plan.domainPlanId.includes(sourceFingerprint);
    if (existing.plan && !needsInputUpgrade && !sourceChanged) return { kind: 'ready', created: false };
    // Trusted server client is the sole Core 3 writer after RLS hardening.
    await syncApplicationPlan(createAdminClient(), applicationId, userId);
    return { kind: 'ready', created: true };
  } catch (error) {
    console.error('[planner] ensure canonical plan failed', { applicationId, userId, error });
    return { kind: 'failed' };
  }
}
