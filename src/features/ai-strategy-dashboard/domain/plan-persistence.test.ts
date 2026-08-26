import { describe, expect, it } from 'vitest';
import type { ExistingPersistedPlan, PlanPersistenceOperation } from './plan-persistence';
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

  it('keeps answered conditional availability inputs through a second reconciliation without duplicate nodes', () => {
    const first: PlanResult = {
      id: 'plan:deterministic:availability-inputs',
      readiness: 'requires_user_input',
      phases: [{
        id: 'phase:planner-inputs',
        title: 'Record planning availability',
        objective: 'Use explicit availability.',
        order: 1,
        sourceDecisionIds: [],
        sourceProvenances: [],
        steps: [{
          id: 'step:planner-inputs:availability',
          title: 'Share available planning time',
          objective: 'Record available time.',
          order: 1,
          sourceDecisionIds: [],
          sourceProvenances: [],
          microSteps: [
            {
              id: 'micro-step:planner-inputs:availability',
              title: 'Record when you are available',
              order: 1,
              readiness: 'requires_user_input',
              contentSchema: { type: 'long_text', prompt: 'When can you work?', semanticKey: 'planner.availability' },
              sourceDecisionIds: [],
              sourceProvenances: [],
            },
            {
              id: 'micro-step:planner-inputs:time-capacity',
              title: 'Record weekly capacity',
              order: 2,
              readiness: 'requires_user_input',
              contentSchema: { type: 'long_text', prompt: 'How much time?', semanticKey: 'planner.time_capacity' },
              sourceDecisionIds: [],
              sourceProvenances: [],
            },
          ],
        }],
      }],
    };
    const phase = first.phases[0]!;
    const step = phase.steps[0]!;
    const existingInputs: ExistingPersistedPlan = {
      plan: { id: 'db-plan', applicationId, producer: CORE3_PLAN_PRODUCER, domainPlanId: first.id, readiness: first.readiness, archivedAt: null },
      phases: [{ id: 'db-phase', planId: 'db-plan', domainNodeId: phase.id, title: phase.title, objective: phase.objective, order: phase.order, sourceDecisionIds: [], sourceProvenances: [], archivedAt: null }],
      steps: [{ id: 'db-step', planId: 'db-plan', phaseId: 'db-phase', domainNodeId: step.id, title: step.title, objective: step.objective, order: step.order, sourceDecisionIds: [], sourceProvenances: [], archivedAt: null }],
      microSteps: step.microSteps.map((microStep, index) => ({
        id: `db-input-${index}`,
        planId: 'db-plan',
        stepId: 'db-step',
        domainNodeId: microStep.id,
        title: microStep.title,
        order: microStep.order,
        readiness: microStep.readiness,
        contentSchema: microStep.contentSchema ?? null,
        sourceDecisionIds: [],
        sourceProvenances: [],
        status: 'not_started',
        deadline: null,
        contentValue: index === 0
          ? { type: 'long_text' as const, text: 'Weekday evenings' }
          : { type: 'long_text' as const, text: '6 hours weekly' },
        executionEvidence: [],
        archivedAt: null,
      })),
    };

    // The context has consumed both answers, so the mapper no longer emits the
    // optional phase. Reconciliation must retain the student-owned input rows.
    const second: PlanResult = { id: first.id, readiness: 'empty', phases: [] };
    const operations = reconcilePlan(applicationId, second, existingInputs).operations;

    expect(operations.filter((operation) => operation.kind.startsWith('archive_'))).toEqual([]);
    expect(operations.filter((operation) => operation.kind.startsWith('insert_'))).toEqual([]);
    expect(JSON.stringify(operations)).not.toContain('Weekday evenings');
    expect(JSON.stringify(operations)).not.toContain('6 hours weekly');
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

// ─── Part 6.3 — ownership proof tests ────────────────────────────────────────
// The reconcile path is the contract that keeps regeneration from destroying
// student work: matching is by domain_node_id, and micro-step writes may carry
// ONLY planning-owned (generated) fields. These tests pin that contract with
// exact key-set assertions so a future field slip fails loudly.

type MicroStepWriteOp = Extract<PlanPersistenceOperation, { kind: 'insert_micro_step' | 'update_micro_step' | 'restore_micro_step' }>;

/** Every emitted op that writes micro-step row content, across all three write kinds. */
function microStepWriteOps(operations: readonly PlanPersistenceOperation[]): MicroStepWriteOp[] {
  return operations.filter(
    (operation): operation is MicroStepWriteOp =>
      operation.kind === 'insert_micro_step' ||
      operation.kind === 'update_micro_step' ||
      operation.kind === 'restore_micro_step',
  );
}

/** The exhaustive set of generated keys `microStepFields` may ever produce. */
const GENERATED_MICRO_STEP_FIELD_KEYS = [
  'contentSchema',
  'domainNodeId',
  'order',
  'readiness',
  'sourceDecisionIds',
  'sourceProvenances',
  'title',
];

describe('reconcilePlan ownership (Part 6.3)', () => {
  function revisedPlanWith(microStepOverrides: Partial<PlanResult['phases'][number]['steps'][number]['microSteps'][number]>): PlanResult {
    const current = plan();
    return {
      ...current,
      phases: [{
        ...current.phases[0]!,
        steps: [{
          ...current.phases[0]!.steps[0]!,
          microSteps: [{ ...current.phases[0]!.steps[0]!.microSteps[0]!, ...microStepOverrides }],
        }],
      }],
    };
  }

  it('keeps a regenerated micro-step on its existing database row when the domain_node_id is unchanged', () => {
    const revised = revisedPlanWith({ title: 'Upload official evidence' });
    const operations = reconcilePlan(applicationId, revised, persistedFor()).operations;

    // Same domain_node_id must reconcile to an UPDATE of the SAME database id —
    // never insert+archive, which would orphan status/deadline/content_value.
    expect(
      operations.filter((op) => op.kind === 'insert_micro_step' || op.kind === 'archive_micro_step'),
    ).toEqual([]);
    expect(
      microStepWriteOps(operations).filter((op) => op.kind === 'update_micro_step').map((op) => op.id),
    ).toEqual(['db-micro']);
  });

  it('emits micro-step writes whose fields carry generated planning keys only', () => {
    // Cover both write paths: an update of a node with user progress present,
    // and a fresh insert of a brand-new node.
    const operations = [
      ...reconcilePlan(applicationId, revisedPlanWith({ title: 'Upload official evidence' }), persistedFor()).operations,
      ...reconcilePlan(applicationId, plan(), existing()).operations,
    ];
    const writes = microStepWriteOps(operations);
    expect(writes.length).toBeGreaterThanOrEqual(2);

    for (const operation of writes) {
      // Exact key-set assertion: any future field slip (status / deadline /
      // contentValue / executionEvidence / …) fails loudly right here.
      expect(Object.keys(operation.fields).sort()).toEqual(GENERATED_MICRO_STEP_FIELD_KEYS);
      expect(Object.keys(operation.fields)).not.toContain('status');
      expect(Object.keys(operation.fields)).not.toContain('deadline');
      expect(Object.keys(operation.fields)).not.toContain('contentValue');
      expect(Object.keys(operation.fields)).not.toContain('executionEvidence');
    }
  });

  it('regenerates a checklist micro-step around existing user progress without touching user-owned fields', () => {
    const items = ['Book IELTS', 'Request official transcripts'];
    const revised = revisedPlanWith({
      title: 'Upload verified evidence',
      contentSchema: { type: 'checklist', items },
    });

    // Existing row: checklist schema plus REAL user progress against it.
    const persistedChecklist = persistedFor();
    persistedChecklist.microSteps[0] = {
      ...persistedChecklist.microSteps[0]!,
      contentSchema: { type: 'checklist', items: ['Book IELTS'] },
      status: 'in_progress',
      deadline: '2026-10-01',
      contentValue: { type: 'checklist', checkedItems: ['Book IELTS'] },
      executionEvidence: [{ id: 'evidence-1' }],
    };

    const operations = reconcilePlan(applicationId, revised, persistedChecklist).operations;
    const updates = microStepWriteOps(operations).filter((op) => op.kind === 'update_micro_step');
    const update = updates[0];

    // Identity survives the regenerate: same DB row updated, not re-created.
    expect(updates).toHaveLength(1);
    expect(update?.id).toBe('db-micro');

    // Planning-owned fields refresh; the field SET stays generated-only.
    expect(update?.fields.title).toBe('Upload verified evidence');
    expect(update?.fields.contentSchema).toEqual({ type: 'checklist', items });
    expect(Object.keys(update?.fields ?? {}).sort()).toEqual(GENERATED_MICRO_STEP_FIELD_KEYS);

    // No op anywhere carries the student's answer, progress state or evidence.
    const serialized = JSON.stringify(operations);
    expect(serialized).not.toContain('checkedItems');
    expect(serialized).not.toContain('in_progress');
    expect(serialized).not.toContain('evidence-1');
  });
});
