import type { PlannerMicroStepExecutionPatch, PlannerMicroStepExecutionState } from '../domain';
import { createAdminClient } from '@/server/db/admin';
import { syncApplicationPlan } from './sync-application-plan';
import { updateApplicationPlannerMicroStep } from './update-application-planner-micro-step';

/** Trusted orchestration: execution saves may explicitly advance Core 1 -> 3. */
export async function progressApplicationPlan(
  applicationId: string,
  userId: string,
  microStepId: string,
  patch: PlannerMicroStepExecutionPatch,
): Promise<{ microStep: PlannerMicroStepExecutionState; progressed: boolean }> {
  const trusted = createAdminClient();
  const microStep = await updateApplicationPlannerMicroStep(trusted, applicationId, userId, microStepId, patch);
  if (microStep.planningInputChanged) {
    await syncApplicationPlan(trusted, applicationId, userId);
    return { microStep, progressed: true };
  }
  return { microStep, progressed: false };
}
