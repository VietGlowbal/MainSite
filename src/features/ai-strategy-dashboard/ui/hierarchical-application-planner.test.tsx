import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlannerReadModel } from '../domain';
import { HierarchicalApplicationPlanner } from './hierarchical-application-planner';

function planner(): PlannerReadModel {
  const task = { id: 'micro-1', domainNodeId: 'micro:1', stepId: 'step-1', phaseId: 'phase-1', title: 'Upload evidence', order: 1, readiness: 'requires_enrichment' as const, contentSchema: null, sourceDecisionIds: [], sourceProvenances: [], status: 'not_started' as const, deadline: null, contentValue: null, executionEvidence: [] };
  return { plan: { id: 'plan-1', applicationId: 'app-1', producer: 'core3_deterministic', domainPlanId: 'plan:1', readiness: 'requires_enrichment' }, diagnostics: [], phases: [{ id: 'phase-1', domainNodeId: 'phase:1', title: 'Meet requirements', objective: 'Objective', order: 1, sourceDecisionIds: [], sourceProvenances: [], progress: { total: 1, completed: 0, percentage: 0 }, steps: [{ id: 'step-1', domainNodeId: 'step:1', phaseId: 'phase-1', title: 'Provide proof', objective: 'Objective', order: 1, sourceDecisionIds: [], sourceProvenances: [], progress: { total: 1, completed: 0, percentage: 0 }, microSteps: [task] }] }] };
}

afterEach(() => vi.unstubAllGlobals());

describe('HierarchicalApplicationPlanner', () => {
  it('renders Phase -> Step -> Micro-step hierarchy with progress and canonical task link', () => {
    render(<HierarchicalApplicationPlanner applicationId="app-1" planner={planner()} />);
    expect(screen.getByText(/Meet requirements/)).toBeInTheDocument();
    expect(screen.getByText(/Provide proof/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upload evidence' })).toHaveAttribute('href', '/ai-strategy/app-1/planner/tasks/micro-1');
    expect(screen.getByText('0 / 1 complete · 0%')).toBeInTheDocument();
  });

  it('uses shared canonical mutations for status and deadline without drag/drop', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ microStep: {} }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<HierarchicalApplicationPlanner applicationId="app-1" planner={planner()} />);
    await userEvent.selectOptions(screen.getByLabelText('Status for Upload evidence'), 'completed');
    fireEvent.change(screen.getByLabelText('Deadline for Upload evidence'), { target: { value: '2026-10-01' } });
    expect(fetchMock).toHaveBeenCalledWith('/api/applications/app-1/planner/micro-steps/micro-1', expect.objectContaining({ body: JSON.stringify({ status: 'completed' }) }));
    expect(fetchMock).toHaveBeenCalledWith('/api/applications/app-1/planner/micro-steps/micro-1', expect.objectContaining({ body: JSON.stringify({ deadline: '2026-10-01' }) }));
  });

  it('keeps Calendar and Kanban micro-step-only views available from the same state', async () => {
    render(<HierarchicalApplicationPlanner applicationId="app-1" planner={planner()} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Calendar' }));
    expect(screen.getByText('Unscheduled')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Board' }));
    expect(screen.getByText('To do')).toBeInTheDocument();
    expect(screen.getByText('Meet requirements · Provide proof')).toBeInTheDocument();
  });
});
