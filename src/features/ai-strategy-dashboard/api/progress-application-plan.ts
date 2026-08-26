import type { PlannerMicroStepExecutionPatch, PlannerMicroStepExecutionState } from '../domain';
import { createAdminClient } from '@/server/db/admin';
import { refreshApplicationPlan } from './refresh-application-plan';
import { updateApplicationPlannerMicroStep } from './update-application-planner-micro-step';
import { assertCanonicalPlannerAccess } from './canonical-access';

/** Trusted orchestration: execution saves may explicitly advance Core 1 -> 3. */
export async function progressApplicationPlan(
  applicationId: string,
  userId: string,
  microStepId: string,
  patch: PlannerMicroStepExecutionPatch,
): Promise<{ microStep: PlannerMicroStepExecutionState; progressed: boolean }> {
  const trusted = createAdminClient();
  await assertCanonicalPlannerAccess(trusted, applicationId, userId);
  const microStep = await updateApplicationPlannerMicroStep(trusted, applicationId, userId, microStepId, patch);
  if (microStep.planningInputChanged) {
    await refreshApplicationPlan(trusted, applicationId, userId, 'semantic_input');
    return { microStep, progressed: true };
  }
  return { microStep, progressed: false };
}
