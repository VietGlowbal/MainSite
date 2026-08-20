import { describe, expect, it } from 'vitest';
import {
  buildPlannerReadModel,
  getCalendarMicroSteps,
  getKanbanMicroSteps,
  getPlannerMicroSteps,
} from './build-planner-read-model';
import type {
  PersistedPlan,
  PersistedPlanMicroStep,
  PersistedPlanPhase,
  PersistedPlanStep,
} from './plan-persistence';

type TestInput = {
  plan: PersistedPlan | null;
  phases: PersistedPlanPhase[];
  steps: PersistedPlanStep[];
  microSteps: PersistedPlanMicroStep[];
};

function input(overrides: Partial<TestInput> = {}): TestInput {
  return {
    plan: { id: 'plan-db', applicationId: 'application-1', producer: 'core3_deterministic', domainPlanId: 'plan:one', readiness: 'requires_enrichment', archivedAt: null },
    phases: [
      { id: 'phase-b', planId: 'plan-db', domainNodeId: 'phase:b', title: 'Second phase', objective: 'Second', order: 2, sourceDecisionIds: ['decision:b'], sourceProvenances: ['database_factual'], archivedAt: null },
      { id: 'phase-a', planId: 'plan-db', domainNodeId: 'phase:a', title: 'First phase', objective: 'First', order: 1, sourceDecisionIds: ['decision:a'], sourceProvenances: ['database_factual'], archivedAt: null },
    ],
    steps: [
      { id: 'step-b', planId: 'plan-db', phaseId: 'phase-a', domainNodeId: 'step:b', title: 'Second step', objective: 'Second', order: 2, sourceDecisionIds: ['decision:b'], sourceProvenances: ['database_factual'], archivedAt: null },
      { id: 'step-a', planId: 'plan-db', phaseId: 'phase-a', domainNodeId: 'step:a', title: 'First step', objective: 'First', order: 1, sourceDecisionIds: ['decision:a'], sourceProvenances: ['database_factual'], archivedAt: null },
      { id: 'step-c', planId: 'plan-db', phaseId: 'phase-b', domainNodeId: 'step:c', title: 'Third step', objective: 'Third', order: 1, sourceDecisionIds: ['decision:c'], sourceProvenances: ['database_factual'], archivedAt: null },
    ],
    microSteps: [
      { id: 'micro-b', planId: 'plan-db', stepId: 'step-a', domainNodeId: 'micro:b', title: 'Second micro', order: 2, readiness: 'requires_enrichment', contentSchema: null, sourceDecisionIds: ['decision:a'], sourceProvenances: ['database_factual'], status: 'not_started', deadline: null, contentValue: null, executionEvidence: [], archivedAt: null },
      { id: 'micro-a', planId: 'plan-db', stepId: 'step-a', domainNodeId: 'micro:a', title: 'First micro', order: 1, readiness: 'requires_enrichment', contentSchema: { type: 'long_text', prompt: 'Provide evidence' }, sourceDecisionIds: ['decision:a'], sourceProvenances: ['database_factual'], status: 'completed', deadline: '2026-10-01', contentValue: { type: 'long_text', text: 'Student answer' }, executionEvidence: [{ documentId: 'doc-1' }], archivedAt: null },
      { id: 'micro-c', planId: 'plan-db', stepId: 'step-c', domainNodeId: 'micro:c', title: 'Third micro', order: 1, readiness: 'requires_user_input', contentSchema: null, sourceDecisionIds: ['decision:c'], sourceProvenances: ['database_factual'], status: 'in_progress', deadline: '2026-10-02', contentValue: null, executionEvidence: [], archivedAt: null },
    ],
    ...overrides,
  };
}

describe('buildPlannerReadModel', () => {
  it('builds the full persisted hierarchy in Core 3 order with derived Step and Phase progress', () => {
    const model = buildPlannerReadModel(input());
    expect(model.phases.map((phase) => phase.id)).toEqual(['phase-a', 'phase-b']);
    expect(model.phases[0]?.steps.map((step) => step.id)).toEqual(['step-a', 'step-b']);
    expect(model.phases[0]?.steps[0]?.microSteps.map((microStep) => microStep.id)).toEqual(['micro-a', 'micro-b']);
    expect(model.phases[0]?.steps[0]?.progress).toEqual({ total: 2, completed: 1, percentage: 50 });
    expect(model.phases[0]?.steps[1]?.progress).toEqual({ total: 0, completed: 0, percentage: 0 });
    expect(model.phases[0]?.progress).toEqual({ total: 2, completed: 1, percentage: 50 });
    expect(model.phases[1]?.progress).toEqual({ total: 1, completed: 0, percentage: 0 });
  });

  it('excludes an archived phase and every descendant even when child archive values are inconsistent', () => {
    const current = input();
    current.phases[0] = { ...current.phases[0]!, archivedAt: '2026-08-20T00:00:00.000Z' };
    const model = buildPlannerReadModel(current);
    expect(model.phases.map((phase) => phase.id)).toEqual(['phase-a']);
    expect(getPlannerMicroSteps(model).map((microStep) => microStep.id)).toEqual(['micro-a', 'micro-b']);
    expect(model.diagnostics).toContainEqual({ kind: 'orphan_step', nodeId: 'step-c', parentId: 'phase-b' });
  });

  it('excludes archived Steps and Micro-steps from hierarchy and progress', () => {
    const current = input();
    current.steps[0] = { ...current.steps[0]!, archivedAt: '2026-08-20T00:00:00.000Z' };
    current.microSteps[0] = { ...current.microSteps[0]!, archivedAt: '2026-08-20T00:00:00.000Z' };
    const model = buildPlannerReadModel(current);
    expect(model.phases[0]?.steps.map((step) => step.id)).toEqual(['step-a']);
    expect(model.phases[0]?.steps[0]?.microSteps.map((microStep) => microStep.id)).toEqual(['micro-a']);
    expect(model.phases[0]?.progress).toEqual({ total: 1, completed: 1, percentage: 100 });
  });

  it('returns an empty canonical model for an application with no Core 3 plan', () => {
    expect(buildPlannerReadModel(input({ plan: null }))).toEqual({ plan: null, phases: [], lifecycle: 'empty', diagnostics: [] });
  });

  it('does not expose an archived root plan', () => {
    const current = input();
    current.plan = { ...current.plan!, archivedAt: '2026-08-20T00:00:00.000Z' };
    expect(buildPlannerReadModel(current)).toEqual({
      plan: null, phases: [], lifecycle: 'empty', diagnostics: [{ kind: 'archived_plan', nodeId: 'plan-db', parentId: null }],
    });
  });

  it('excludes orphan and foreign rows and reports diagnostics instead of attaching them arbitrarily', () => {
    const current = input();
    current.steps.push({ ...current.steps[0]!, id: 'orphan-step', phaseId: 'missing-phase', domainNodeId: 'step:orphan' });
    current.microSteps.push({ ...current.microSteps[0]!, id: 'orphan-micro', stepId: 'missing-step', domainNodeId: 'micro:orphan' });
    current.phases.push({ ...current.phases[0]!, id: 'foreign-phase', planId: 'other-plan', domainNodeId: 'phase:foreign' });
    const model = buildPlannerReadModel(current);
    expect(getPlannerMicroSteps(model).map((microStep) => microStep.id)).not.toContain('orphan-micro');
    expect(model.diagnostics).toEqual(expect.arrayContaining([
      { kind: 'foreign_phase', nodeId: 'foreign-phase', parentId: 'other-plan' },
      { kind: 'orphan_step', nodeId: 'orphan-step', parentId: 'missing-phase' },
      { kind: 'orphan_micro_step', nodeId: 'orphan-micro', parentId: 'missing-step' },
    ]));
  });

  it('keeps one deterministic node when corrupted input duplicates an ID or domain identity', () => {
    const current = input();
    current.microSteps.push({ ...current.microSteps[0]!, id: 'duplicate-id', domainNodeId: 'micro:a', title: 'Corrupt duplicate', order: 0 });
    const model = buildPlannerReadModel(current);
    expect(model.phases[0]?.steps[0]?.microSteps.map((microStep) => microStep.title)).toEqual(['Corrupt duplicate', 'Second micro']);
    expect(model.diagnostics).toContainEqual({ kind: 'duplicate_micro_step', nodeId: 'micro-a', parentId: null });
  });

  it('exposes date-only Calendar and status-based Kanban projections with parent context', () => {
    const model = buildPlannerReadModel(input());
    expect(getCalendarMicroSteps(model)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'micro-a', deadline: '2026-10-01', phaseId: 'phase-a', phaseTitle: 'First phase', stepId: 'step-a', stepTitle: 'First step' }),
      expect.objectContaining({ id: 'micro-c', deadline: '2026-10-02' }),
    ]));
    expect(getCalendarMicroSteps(model).map((microStep) => microStep.id)).not.toContain('micro-b');
    expect(getKanbanMicroSteps(model).map((microStep) => [microStep.id, microStep.status])).toEqual([
      ['micro-a', 'completed'], ['micro-b', 'not_started'], ['micro-c', 'in_progress'],
    ]);
  });

  it('passes valid execution definition and student-owned execution values through unchanged', () => {
    const microStep = getPlannerMicroSteps(buildPlannerReadModel(input())).find((item) => item.id === 'micro-a');
    expect(microStep).toMatchObject({
      contentSchema: { type: 'long_text', prompt: 'Provide evidence' },
      contentValue: { type: 'long_text', text: 'Student answer' },
      executionEvidence: [{ documentId: 'doc-1' }],
      status: 'completed', deadline: '2026-10-01',
    });
  });

  it('normalises an invalid persisted execution status safely and exposes a diagnostic', () => {
    const current = input();
    current.microSteps[0] = { ...current.microSteps[0]!, status: 'waiting' };
    const model = buildPlannerReadModel(current);
    expect(getPlannerMicroSteps(model).find((item) => item.id === 'micro-b')?.status).toBe('not_started');
    expect(model.diagnostics).toContainEqual({ kind: 'invalid_execution_status', nodeId: 'micro-b', parentId: null });
  });

  it('has identical output for shuffled persistence rows', () => {
    const current = input();
    const shuffled = input({ phases: [...current.phases].reverse(), steps: [...current.steps].reverse(), microSteps: [...current.microSteps].reverse() });
    expect(buildPlannerReadModel(shuffled)).toEqual(buildPlannerReadModel(current));
  });
});
