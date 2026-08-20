'use client';

import { useCallback, useState } from 'react';
import {
  applyPlannerMicroStepExecution,
  getPlannerMicroSteps,
  type PlannerMicroStepExecutionPatch,
  type PlannerReadModel,
} from '../domain';

export type ApplicationPlannerController = {
  planner: PlannerReadModel;
  error: string | null;
  updateMicroStepStatus: (id: string, status: PlannerMicroStepExecutionPatch['status']) => Promise<void>;
  updateMicroStepDeadline: (id: string, deadline: PlannerMicroStepExecutionPatch['deadline']) => Promise<void>;
  updateMicroStepContent: (id: string, contentValue: PlannerMicroStepExecutionPatch['contentValue']) => Promise<boolean>;
};

/** One optimistic hierarchy state shared by canonical List, Calendar, and Kanban. */
export function useApplicationPlanner(applicationId: string, initial: PlannerReadModel): ApplicationPlannerController {
  const [planner, setPlanner] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (id: string, patch: PlannerMicroStepExecutionPatch, message: string): Promise<boolean> => {
    const before = getPlannerMicroSteps(planner).find((microStep) => microStep.id === id);
    if (!before) { setError('That task is no longer available.'); return false; }
    const rollback: PlannerMicroStepExecutionPatch = {
      ...(patch.status !== undefined ? { status: before.status } : {}),
      ...(patch.deadline !== undefined ? { deadline: before.deadline } : {}),
      ...(patch.contentValue !== undefined ? { contentValue: before.contentValue } : {}),
    };
    setError(null);
    setPlanner((current) => applyPlannerMicroStepExecution(current, id, patch));
    try {
      const response = await fetch(`/api/applications/${applicationId}/planner/micro-steps/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error('save_failed');
      const payload = await response.json() as { microStep?: PlannerMicroStepExecutionPatch };
      const serverPatch = payload.microStep;
      if (serverPatch) setPlanner((current) => applyPlannerMicroStepExecution(current, id, serverPatch));
      return true;
    } catch {
      setPlanner((current) => applyPlannerMicroStepExecution(current, id, rollback));
      setError(message);
      return false;
    }
  }, [applicationId, planner]);

  return {
    planner,
    error,
    updateMicroStepStatus: async (id, status) => { await mutate(id, { status }, 'That status did not save. Please try again.'); },
    updateMicroStepDeadline: async (id, deadline) => { await mutate(id, { deadline }, 'That date did not save. Please try again.'); },
    updateMicroStepContent: (id, contentValue) => mutate(id, { contentValue }, 'That content did not save. Please try again.'),
  };
}
