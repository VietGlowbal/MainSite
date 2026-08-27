import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PlannerReadModel } from '../domain';
import { CanonicalMicroStepDetail } from './canonical-micro-step-detail';

const planner: PlannerReadModel = {
  plan: { id: 'plan-1', applicationId: 'app-1', producer: 'core3_deterministic', domainPlanId: 'plan:1', readiness: 'requires_enrichment' },
  lifecycle: 'active',
  diagnostics: [],
  phases: [{
    id: 'phase-1', domainNodeId: 'phase:1', title: 'Meet requirements', objective: 'Objective', order: 1,
    sourceDecisionIds: [], sourceProvenances: [], progress: { total: 1, completed: 0, percentage: 0 }, steps: [{
      id: 'step-1', domainNodeId: 'step:1', phaseId: 'phase-1', title: 'Provide proof', objective: 'Objective', order: 1,
      sourceDecisionIds: [], sourceProvenances: [], progress: { total: 1, completed: 0, percentage: 0 }, microSteps: [{
        id: 'micro-1', domainNodeId: 'micro:1', stepId: 'step-1', phaseId: 'phase-1', title: 'Upload evidence',
        guidance: 'Upload an official document that verifies this requirement.', order: 1, readiness: 'requires_enrichment',
        contentSchema: null, sourceDecisionIds: [], sourceProvenances: [], status: 'not_started', deadline: null,
        contentValue: null, executionEvidence: [],
      }],
    }],
  }],
};

describe('CanonicalMicroStepDetail', () => {
  it('shows persisted task guidance when the task has no content form', () => {
    render(<CanonicalMicroStepDetail applicationId="app-1" planner={planner} microStepId="micro-1" />);

    expect(screen.getByText('What to do')).toBeInTheDocument();
    expect(screen.getByText('Upload an official document that verifies this requirement.')).toBeInTheDocument();
    expect(screen.queryByText('Task content')).not.toBeInTheDocument();
  });

  it('shows a usable fallback for a legacy task without persisted guidance', () => {
    const legacyPlanner = structuredClone(planner);
    delete legacyPlanner.phases[0]!.steps[0]!.microSteps[0]!.guidance;
    render(<CanonicalMicroStepDetail applicationId="app-1" planner={legacyPlanner} microStepId="micro-1" />);

    expect(screen.getByText('Complete this task: Upload evidence Review the related step, then mark it complete when you have finished.')).toBeInTheDocument();
  });
});
