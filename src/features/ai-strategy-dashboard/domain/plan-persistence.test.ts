import { describe, expect, it } from 'vitest';
import type { ExistingPersistedPlan } from './plan-persistence';
import { CORE3_PLAN_PRODUCER, reconcilePlan } from './plan-persistence';
import type { PlanResult } from './plan';

const applicationId = 'application-1';

function plan(overrides: Partial<PlanResult> = {}): PlanResult {
  return {
    id: 'plan:deterministic:a',
    readiness: 'requires_enrichment',
    phases: [{
      id: 'phase:blockers', title: 'Resolve blockers', objective: 'Remove the blocker.', order: 1,
      sourceDecisionIds: ['decision:eligibility'], sourceProvenances: ['database_factual'],
      steps: [{
        id: 'step:blockers:eligibility', title: 'Resolve eligibility', objective: 'Meet the rule.', order: 1,
        sourceDecisionIds: ['decision:eligibility'], sourceProvenances: ['database_factual'],
        microSteps: [{
          id: 'micro-step:blockers:eligibility:detail', title: 'Collect official evidence', order: 1,
          readiness: 'requires_enrichment', sourceDecisionIds: ['decision:eligibility'],
          sourceProvenances: ['database_factual'],
        }],
      }],
    }],
    ...overrides,
  };
}

function existing(input: Partial<ExistingPersistedPlan> = {}): ExistingPersistedPlan {
  return { plan: null, phases: [], steps: [], microSteps: [], ...input };
}

function persistedFor(source = plan()): ExistingPersistedPlan {
  const phase = source.phases[0]!;
  const step = phase.steps[0]!;
  const microStep = step.microSteps[0]!;
  return existing({
    plan: { id: 'db-plan', applicationId, producer: CORE3_PLAN_PRODUCER, domainPlanId: source.id, readiness: source.readiness, archivedAt: null },
    phases: [{ id: 'db-phase', planId: 'db-plan', domainNodeId: phase.id, title: phase.title, objective: phase.objective, order: phase.order, sourceDecisionIds: phase.sourceDecisionIds, sourceProvenances: phase.sourceProvenances, archivedAt: null }],
    steps: [{ id: 'db-step', planId: 'db-plan', phaseId: 'db-phase', domainNodeId: step.id, title: step.title, objective: step.objective, order: step.order, sourceDecisionIds: step.sourceDecisionIds, sourceProvenances: step.sourceProvenances, archivedAt: null }],
    microSteps: [{ id: 'db-micro', planId: 'db-plan', stepId: 'db-step', domainNodeId: microStep.id, title: microStep.title, order: microStep.order, readiness: microStep.readiness, contentSchema: microStep.contentSchema ?? null, sourceDecisionIds: microStep.sourceDecisionIds, sourceProvenances: microStep.sourceProvenances, archivedAt: null, status: 'in_progress', deadline: '2026-10-01', contentValue: { type: 'long_text', text: 'Student work' }, executionEvidence: [{ id: 'evidence-1' }] }],
  });
}

describe('reconcilePlan', () => {
  it('creates the canonical hierarchy on the first sync, retaining parent identities by deterministic node ID', () => {
    expect(reconcilePlan(applicationId, plan(), existing()).operations).toEqual([
      { kind: 'insert_plan', applicationId, producer: CORE3_PLAN_PRODUCER, fields: { domainPlanId: 'plan:deterministic:a', readiness: 'requires_enrichment' } },
      expect.objectContaining({ kind: 'insert_phase', fields: expect.objectContaining({ domainNodeId: 'phase:blockers' }) }),
      expect.objectContaining({ kind: 'insert_step', phaseDomainNodeId: 'phase:blockers', fields: expect.objectContaining({ domainNodeId: 'step:blockers:eligibility' }) }),
      expect.objectContaining({ kind: 'insert_micro_step', stepDomainNodeId: 'step:blockers:eligibility', fields: expect.objectContaining({ domainNodeId: 'micro-step:blockers:eligibility:detail' }) }),
    ]);
  });

  it('is idempotent when the deterministic plan has not changed', () => {
    expect(reconcilePlan(applicationId, plan(), persistedFor()).operations).toEqual([]);
  });

  it('updates planning fields by deterministic identity after a title, order, or provenance change', () => {
    const revised = plan({
      id: 'plan:deterministic:revised',
      phases: [{ ...plan().phases[0]!, title: 'Resolve confirmed blockers', order: 2, sourceProvenances: ['ai_generated'], steps: plan().phases[0]!.steps }],
    });
    const operations = reconcilePlan(applicationId, revised, persistedFor()).operations;
    expect(operations).toContainEqual({ kind: 'update_plan', id: 'db-plan', fields: { domainPlanId: 'plan:deterministic:revised', readiness: 'requires_enrichment' } });
    expect(operations).toContainEqual(expect.objectContaining({ kind: 'update_phase', id: 'db-phase', fields: expect.objectContaining({ title: 'Resolve confirmed blockers', order: 2, sourceProvenances: ['ai_generated'] }) }));
  });

  it('inserts a newly introduced deterministic node without rematching the existing hierarchy by title', () => {
    const current = plan();
    const added = { ...current, phases: [{ ...current.phases[0]!, steps: [...current.phases[0]!.steps, {
      ...current.phases[0]!.steps[0]!, id: 'step:blockers:language', title: 'Resolve language', order: 2,
      microSteps: [{ ...current.phases[0]!.steps[0]!.microSteps[0]!, id: 'micro-step:blockers:language:detail', title: 'Collect language evidence' }],
    }] }] };
    const operations = reconcilePlan(applicationId, added, persistedFor()).operations;
    expect(operations).toContainEqual(expect.objectContaining({ kind: 'insert_step', fields: expect.objectContaining({ domainNodeId: 'step:blockers:language' }) }));
    expect(operations).toContainEqual(expect.objectContaining({ kind: 'insert_micro_step', fields: expect.objectContaining({ domainNodeId: 'micro-step:blockers:language:detail' }) }));
  });

  it('archives removed nodes instead of deleting their execution history', () => {
    const operations = reconcilePlan(applicationId, plan({ phases: [] }), persistedFor()).operations;
    expect(operations.map((operation) => operation.kind)).toEqual(['archive_phase', 'archive_step', 'archive_micro_step']);
  });

  it('restores an archived deterministic node rather than inserting a duplicate identity', () => {
    const current = persistedFor();
    current.microSteps[0] = { ...current.microSteps[0]!, archivedAt: '2026-08-01T00:00:00.000Z' };
    expect(reconcilePlan(applicationId, plan(), current).operations).toContainEqual(expect.objectContaining({ kind: 'restore_micro_step', id: 'db-micro' }));
  });

  it('never writes student-owned execution status, deadline, content, or evidence during a planning update', () => {
    const revised = plan({ phases: [{ ...plan().phases[0]!, steps: [{ ...plan().phases[0]!.steps[0]!, microSteps: [{ ...plan().phases[0]!.steps[0]!.microSteps[0]!, title: 'Upload official evidence' }] }] }] });
    const operation = reconcilePlan(applicationId, revised, persistedFor()).operations.find((item) => item.kind === 'update_micro_step');
    expect(operation).toMatchObject({ kind: 'update_micro_step', id: 'db-micro', fields: { title: 'Upload official evidence' } });
    expect(JSON.stringify(operation)).not.toContain('in_progress');
    expect(JSON.stringify(operation)).not.toContain('2026-10-01');
    expect(JSON.stringify(operation)).not.toContain('Student work');
    expect(JSON.stringify(operation)).not.toContain('evidence-1');
  });

  it('updates a planning-owned content schema without including compatible student content', () => {
    const current = plan();
    const revised = plan({ phases: [{ ...current.phases[0]!, steps: [{ ...current.phases[0]!.steps[0]!, microSteps: [{ ...current.phases[0]!.steps[0]!.microSteps[0]!, contentSchema: { type: 'long_text', prompt: 'Explain the evidence', minWords: 50 } }] }] }] });
    const operation = reconcilePlan(applicationId, revised, persistedFor()).operations.find((item) => item.kind === 'update_micro_step');
    expect(operation).toMatchObject({ kind: 'update_micro_step', fields: { contentSchema: { type: 'long_text', prompt: 'Explain the evidence', minWords: 50 } } });
    expect(JSON.stringify(operation)).not.toContain('contentValue');
  });

  it('preserves execution state for wording-only schema changes', () => {
    const source = plan();
    const micro = source.phases[0]!.steps[0]!.microSteps[0]!;
    const current = persistedFor(source);
    current.microSteps[0] = {
      ...current.microSteps[0]!,
      status: 'completed',
      contentSchema: { type: 'long_text', prompt: 'Explain the evidence', minWords: 1 },
      contentValue: { type: 'long_text', text: 'Student work' },
    };
    const revised = plan({ phases: [{ ...source.phases[0]!, steps: [{ ...source.phases[0]!.steps[0]!, microSteps: [{ ...micro, contentSchema: { type: 'long_text', prompt: 'Describe the evidence', minWords: 1 } }] }] }] });
    const operation = reconcilePlan(applicationId, revised, current).operations.find((item) => item.kind === 'update_micro_step');
    expect(operation).toMatchObject({ kind: 'update_micro_step', fields: { contentSchema: { type: 'long_text', prompt: 'Describe the evidence' } } });
    expect(operation && 'fields' in operation ? operation.fields.executionReset : undefined).toBeUndefined();
  });

  it('marks an incompatible schema change for execution reset', () => {
    const current = persistedFor();
    current.microSteps[0] = {
      ...current.microSteps[0]!,
      status: 'completed',
      contentSchema: { type: 'long_text', prompt: 'Explain', minWords: 1 },
      contentValue: { type: 'long_text', text: 'Student work' },
    };
    const revised = plan({ phases: [{ ...plan().phases[0]!, steps: [{ ...plan().phases[0]!.steps[0]!, microSteps: [{ ...plan().phases[0]!.steps[0]!.microSteps[0]!, contentSchema: { type: 'single_select', prompt: 'Choose', semanticKey: 'planner.focus', options: [{ value: 'a', label: 'A' }] } }] }] }] });
    const operation = reconcilePlan(applicationId, revised, current).operations.find((item) => item.kind === 'update_micro_step');
    expect(operation && 'fields' in operation ? operation.fields.executionReset : undefined).toBe(true);
  });

  it('is independent of source input order and sorts source provenance before persisting', () => {
    const current = plan();
    const reordered = plan({ phases: [...current.phases].reverse() });
    expect(reconcilePlan(applicationId, current, existing())).toEqual(reconcilePlan(applicationId, reordered, existing()));
  });

  it('refuses to reconcile another producer plan, preventing F5/F7 ownership collisions', () => {
    const incompatible = persistedFor();
    incompatible.plan = { ...incompatible.plan!, producer: 'f5_match_analysis' };
    expect(() => reconcilePlan(applicationId, plan(), incompatible)).toThrow('different producer');
  });
});
