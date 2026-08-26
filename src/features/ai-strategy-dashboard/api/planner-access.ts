import type { SupabaseClient } from '@supabase/supabase-js';
import { getApplicationPlanner } from './get-application-planner';
import { getApplicationAssessments } from './get-application-assessments';
import { refreshApplicationPlan } from './refresh-application-plan';
import { assertCanonicalPlannerAccess } from './canonical-access';
import { getPlannerMicroSteps, plannerSourceFingerprint } from '../domain';
import { getPlannerMode } from './planner-mode';
import {
  PLANNER_AVAILABILITY_INPUT_KEYS,
  type PlanningInput,
} from '../domain/planning-context';

/** Canonical read boundary used by pages and server orchestration. */
export async function getCanonicalApplicationPlanner(
  supabase: SupabaseClient,
  applicationId: string,
  userId: string,
) {
  await assertCanonicalPlannerAccess(supabase, applicationId, userId);
  return getApplicationPlanner(supabase, applicationId, userId);
}

export type EnsureApplicationPlanResult =
  | { kind: 'ready'; created: boolean }
  | { kind: 'not_entitled' }
  | { kind: 'not_found' }
  | { kind: 'failed' };

export { getPlannerMode, type PlannerMode } from './planner-mode';

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
    const existing = await getCanonicalApplicationPlanner(supabase, applicationId, userId);
    const { context } = await getApplicationAssessments(supabase, applicationId, userId);
    // One-time rollout upgrade: early foundation plans can lack declared
    // inputs. Reconcile only when an unanswered input is also absent, so an
    // existing input remains stable while its answer is being collected.
    const needsInputUpgrade = needsPlannerInputUpgrade(existing, context.plannerInputs ?? []);
    const sourceFingerprint = `:source:${plannerSourceFingerprint(context)}`;
    const sourceChanged = existing.plan !== null && !existing.plan.domainPlanId.includes(sourceFingerprint);
    if (existing.plan && !needsInputUpgrade && !sourceChanged) return { kind: 'ready', created: false };
    // Trusted server client is the sole Core 3 writer after RLS hardening.
    await refreshApplicationPlan(supabase, applicationId, userId, 'source_change');
    return { kind: 'ready', created: true };
  } catch (error) {
    console.error('[planner] ensure canonical plan failed', { applicationId, userId, error });
    return { kind: 'failed' };
  }
}

export { assertCanonicalPlannerAccess, CanonicalPlannerAccessError } from './canonical-access';

function needsPlannerInputUpgrade(
  existing: Awaited<ReturnType<typeof getApplicationPlanner>>,
  plannerInputs: readonly PlanningInput[],
): boolean {
  const microSteps = getPlannerMicroSteps(existing);
  const missingAttentionInput = microSteps.some((micro) =>
    micro.domainNodeId.includes('attention-focus') && micro.contentSchema === null,
  );
  const missingAvailabilityInput = PLANNER_AVAILABILITY_INPUT_KEYS.some((semanticKey) => {
    const hasExplicitAnswer = plannerInputs.some((input) =>
      input.provenance === 'user_provided'
      && input.semanticKey === semanticKey
      && input.value.trim().length > 0,
    );
    const hasInputNode = microSteps.some((micro) =>
      micro.contentSchema?.type === 'long_text'
      && micro.contentSchema.semanticKey === semanticKey,
    );
    return !hasExplicitAnswer && !hasInputNode;
  });
  return missingAttentionInput || missingAvailabilityInput;
}
