import { describe, expect, it } from 'vitest';
import { getApplicationPlanner, PlannerReadError } from './get-application-planner';

type Call = { table: string; filters: [string, unknown][] };

function fakeSupabase(rows: Record<string, Record<string, unknown>[]>) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    const response = () => ({ data: rows[table] ?? [], error: null });
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
      is: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
      in: (column: string, value: unknown) => { filters.push([column, value]); return Promise.resolve(response()); },
      maybeSingle: async () => ({ data: (rows[table] ?? [])[0] ?? null, error: null }),
      then: (resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) => Promise.resolve(resolve(response())),
    };
    calls.push({ table, filters });
    return builder;
  };
  return { client: { from } as never, calls };
}

function ownedRows(): Record<string, Record<string, unknown>[]> {
  return {
    course_applications: [{ id: 'application-1' }],
    application_plans: [{ id: 'plan-db', application_id: 'application-1', producer: 'core3_deterministic', domain_plan_id: 'plan:one', readiness: 'requires_enrichment', archived_at: null }],
    application_plan_phases: [
      { id: 'phase-db', plan_id: 'plan-db', domain_node_id: 'phase:a', title: 'Resolve blockers', objective: 'Resolve', sort_order: 1, source_decision_ids: ['decision:a'], source_provenances: ['database_factual'], archived_at: null },
      { id: 'archived-phase', plan_id: 'plan-db', domain_node_id: 'phase:old', title: 'Old', objective: 'Old', sort_order: 2, source_decision_ids: [], source_provenances: [], archived_at: '2026-08-20T00:00:00.000Z' },
    ],
    application_plan_steps: [
      { id: 'step-db', phase_id: 'phase-db', domain_node_id: 'step:a', title: 'Collect evidence', objective: 'Collect', sort_order: 1, source_decision_ids: ['decision:a'], source_provenances: ['database_factual'], archived_at: null },
      { id: 'old-step', phase_id: 'archived-phase', domain_node_id: 'step:old', title: 'Old step', objective: 'Old', sort_order: 1, source_decision_ids: [], source_provenances: [], archived_at: null },
    ],
    application_plan_micro_steps: [
      { id: 'micro-db', step_id: 'step-db', domain_node_id: 'micro:a', title: 'Upload document', sort_order: 1, readiness: 'requires_enrichment', content_schema: { type: 'checklist', items: ['Upload'] }, source_decision_ids: ['decision:a'], source_provenances: ['database_factual'], status: 'in_progress', deadline: '2026-10-01', content_value: { type: 'checklist', checkedItems: [] }, execution_evidence: [{ documentId: 'doc-1' }], archived_at: null },
      { id: 'old-micro', step_id: 'old-step', domain_node_id: 'micro:old', title: 'Old micro', sort_order: 1, readiness: 'requires_enrichment', content_schema: null, source_decision_ids: [], source_provenances: [], status: 'completed', deadline: null, content_value: null, execution_evidence: [], archived_at: null },
    ],
  };
}

describe('getApplicationPlanner', () => {
  it('verifies application ownership and performs a bounded hierarchy read with no legacy query', async () => {
    const fake = fakeSupabase(ownedRows());
    const model = await getApplicationPlanner(fake.client, 'application-1', 'user-1');

    expect(fake.calls.map((call) => call.table)).toEqual([
      'course_applications', 'application_plans', 'application_plan_phases', 'application_plan_steps', 'application_plan_micro_steps',
    ]);
    expect(fake.calls[0]?.filters).toEqual([['id', 'application-1'], ['user_id', 'user-1']]);
    expect(fake.calls.some((call) => call.table === 'application_recommendations')).toBe(false);
    expect(model.phases.map((phase) => phase.id)).toEqual(['phase-db']);
    expect(model.phases[0]?.steps[0]?.microSteps[0]).toMatchObject({ id: 'micro-db', status: 'in_progress', deadline: '2026-10-01' });
  });

  it('returns an empty canonical model for legacy-only applications without reading application_recommendations', async () => {
    const fake = fakeSupabase({ course_applications: [{ id: 'application-1' }], application_plans: [] });
    await expect(getApplicationPlanner(fake.client, 'application-1', 'user-1')).resolves.toEqual({ plan: null, phases: [], diagnostics: [] });
    expect(fake.calls.map((call) => call.table)).toEqual(['course_applications', 'application_plans']);
  });

  it('does not treat an RLS-filtered application as an empty planner', async () => {
    const fake = fakeSupabase({ course_applications: [] });
    await expect(getApplicationPlanner(fake.client, 'application-1', 'other-user')).rejects.toEqual(expect.any(PlannerReadError));
    expect(fake.calls.map((call) => call.table)).toEqual(['course_applications']);
  });

  it('passes archived rows to the pure builder, which prevents archived ancestors leaking into the active model', async () => {
    const fake = fakeSupabase(ownedRows());
    const model = await getApplicationPlanner(fake.client, 'application-1', 'user-1');
    expect(model.phases.map((phase) => phase.title)).toEqual(['Resolve blockers']);
    expect(model.diagnostics).toContainEqual({ kind: 'orphan_step', nodeId: 'old-step', parentId: 'archived-phase' });
  });
});
