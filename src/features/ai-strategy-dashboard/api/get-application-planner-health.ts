import type { SupabaseClient } from '@supabase/supabase-js';
import { buildPlannerReadModel, getPlannerMicroSteps, isPlannerStale, planFingerprint, plannerLifecycle, plannerSourceFingerprint, type PlannerHealth } from '../domain';
import { getApplicationAssessments } from './get-application-assessments';
import { getApplicationPlanner } from './get-application-planner';
import { getPlannerMode } from './planner-mode';
import { readPlannerOps } from './planner-ops-store';

/** One server-side read model for student/admin health surfaces. Never calls AI. */
export async function getApplicationPlannerHealth(supabase: SupabaseClient, applicationId: string, userId: string): Promise<PlannerHealth> {
  const mode = await getPlannerMode(supabase, userId);
  const [ops, planner, assessment] = await Promise.all([
    readPlannerOps(supabase, applicationId).catch(() => null),
    mode === 'canonical' ? getApplicationPlanner(supabase, applicationId, userId) : Promise.resolve(null),
    mode === 'canonical' ? getApplicationAssessments(supabase, applicationId, userId) : Promise.resolve(null),
  ]);
  const feedbackResult = mode === 'canonical' ? await supabase.from('application_planner_feedback').select('rating').eq('application_id', applicationId) : { data: [] as Array<{ rating: number | null }> };
  const currentFingerprint = assessment ? plannerSourceFingerprint(assessment.context) : null;
  const planFingerprintValue = planFingerprint(planner?.plan?.domainPlanId);
  const stale = isPlannerStale(currentFingerprint, planFingerprintValue);
  const micros = planner ? getPlannerMicroSteps(planner) : [];
  const completed = micros.filter((micro) => micro.status === 'completed').length;
  const percentage = micros.length === 0 ? 0 : Math.round((completed / micros.length) * 100);
  const readModel = planner ?? buildPlannerReadModel({ plan: null, phases: [], steps: [], microSteps: [] });
  return {
    lifecycle: plannerLifecycle({ readModel, stale, refreshing: ops?.generation_status === 'running', failed: ops?.generation_status === 'failed' }),
    entitlement: mode,
    source: { currentFingerprint, planFingerprint: planFingerprintValue, stale, staleSince: ops?.stale_since ?? null },
    generation: { lastAttemptAt: ops?.last_attempt_at ?? null, lastSuccessAt: ops?.last_success_at ?? null, status: ops?.generation_status ?? 'idle', failureCode: ops?.failure_code ?? null },
    ai: { lastStatus: ops?.ai_status ?? null, provider: ops?.ai_provider ?? null, model: ops?.ai_model ?? null, promptVersion: ops?.ai_prompt_version ?? null, enrichmentVersion: ops?.ai_enrichment_version ?? null },
    progress: { phases: planner?.phases.length ?? 0, steps: planner?.phases.flatMap((phase) => phase.steps).length ?? 0, microSteps: micros.length, completedMicroSteps: completed, percentage },
    feedback: { averageRating: averageRating(feedbackResult.data ?? []), totalRatings: feedbackResult.data?.length ?? 0 },
    stuckMicroSteps: 0,
  };
}

function averageRating(rows: Array<{ rating: number | null }>): number | null {
  const rated = rows.map((row) => row.rating).filter((rating): rating is number => typeof rating === 'number');
  return rated.length ? Math.round((rated.reduce((sum, rating) => sum + rating, 0) / rated.length) * 100) / 100 : null;
}
