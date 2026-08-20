import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPlannerMicroSteps, type PlannerReadModel } from '../domain';
import { useApplicationPlanner } from './use-application-planner';

function planner(): PlannerReadModel {
  const micro = { id: 'micro-1', domainNodeId: 'micro:1', stepId: 'step-1', phaseId: 'phase-1', title: 'Upload evidence', order: 1, readiness: 'requires_enrichment' as const, contentSchema: { type: 'long_text' as const, prompt: 'Explain' }, sourceDecisionIds: [], sourceProvenances: [], status: 'not_started' as const, deadline: null, contentValue: null, executionEvidence: [] };
  return { plan: { id: 'plan-1', applicationId: 'app-1', producer: 'core3_deterministic', domainPlanId: 'plan:1', readiness: 'requires_enrichment' }, lifecycle: 'active', diagnostics: [], phases: [{ id: 'phase-1', domainNodeId: 'phase:1', title: 'Phase', objective: 'Objective', order: 1, sourceDecisionIds: [], sourceProvenances: [], progress: { total: 1, completed: 0, percentage: 0 }, steps: [{ id: 'step-1', domainNodeId: 'step:1', phaseId: 'phase-1', title: 'Step', objective: 'Objective', order: 1, sourceDecisionIds: [], sourceProvenances: [], progress: { total: 1, completed: 0, percentage: 0 }, microSteps: [micro] }] }] };
}

afterEach(() => vi.unstubAllGlobals());

describe('useApplicationPlanner', () => {
  it('shares an optimistic status update with derived Step and Phase progress', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ microStep: { status: 'completed' } }) }));
    const { result } = renderHook(() => useApplicationPlanner('app-1', planner()));
    await act(async () => { await result.current.updateMicroStepStatus('micro-1', 'completed'); });
    expect(getPlannerMicroSteps(result.current.planner)[0]?.status).toBe('completed');
    expect(result.current.planner.phases[0]?.progress).toEqual({ total: 1, completed: 1, percentage: 100 });
  });

  it('rolls back only a failed deadline edit, retaining a concurrently saved status', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ microStep: { status: 'in_progress' } }) })
      .mockResolvedValueOnce({ ok: false });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useApplicationPlanner('app-1', planner()));
    await act(async () => { await result.current.updateMicroStepStatus('micro-1', 'in_progress'); await result.current.updateMicroStepDeadline('micro-1', '2026-10-01'); });
    expect(getPlannerMicroSteps(result.current.planner)[0]).toMatchObject({ status: 'in_progress', deadline: null });
    expect(result.current.error).toBe('That date did not save. Please try again.');
  });

  it('persists interactive content through the canonical PATCH endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ microStep: { contentValue: { type: 'long_text', text: 'Student work' } } }) });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useApplicationPlanner('app-1', planner()));
    await act(async () => { await result.current.updateMicroStepContent('micro-1', { type: 'long_text', text: 'Student work' }); });
    expect(fetchMock).toHaveBeenCalledWith('/api/applications/app-1/planner/micro-steps/micro-1', expect.objectContaining({ body: JSON.stringify({ contentValue: { type: 'long_text', text: 'Student work' } }) }));
    expect(getPlannerMicroSteps(result.current.planner)[0]?.contentValue).toEqual({ type: 'long_text', text: 'Student work' });
  });
});
