import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlanResult } from '../domain';

vi.mock('./get-application-plan', () => ({ getApplicationPlan: vi.fn() }));

import { getApplicationPlan } from './get-application-plan';
import { syncApplicationPlan } from './sync-application-plan';

const mockedGetApplicationPlan = vi.mocked(getApplicationPlan);

const compiledPlan: PlanResult = {
  id: 'plan:deterministic:a', readiness: 'requires_enrichment', phases: [{
    id: 'phase:blockers', title: 'Resolve blockers', objective: 'Remove blocker.', order: 1,
    sourceDecisionIds: ['decision:eligibility'], sourceProvenances: ['database_factual'], steps: [{
      id: 'step:blockers:eligibility', title: 'Resolve eligibility', objective: 'Meet rule.', order: 1,
      sourceDecisionIds: ['decision:eligibility'], sourceProvenances: ['database_factual'], microSteps: [{
        id: 'micro-step:blockers:eligibility:detail', title: 'Collect evidence', order: 1,
        readiness: 'requires_enrichment', sourceDecisionIds: ['decision:eligibility'], sourceProvenances: ['database_factual'],
      }],
    }],
  }],
};

type Write = { table: string; kind: 'insert' | 'update'; payload: Record<string, unknown>; filters: [string, unknown][] };

function fakeSupabase(rows: Record<string, Record<string, unknown>[]> = {}) {
  const calls: { table: string; filters: [string, unknown][] }[] = [];
  const writes: Write[] = [];
  const insertedIds: Record<string, string[]> = {
    application_plans: ['db-plan'], application_plan_phases: ['db-phase'], application_plan_steps: ['db-step'], application_plan_micro_steps: ['db-micro'],
  };

  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    let kind: 'select' | 'insert' | 'update' = 'select';
    let payload: Record<string, unknown> = {};
    const response = () => ({ data: rows[table] ?? [], error: null });
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        if (kind === 'update') {
          writes.push({ table, kind: 'update', payload, filters: [...filters] });
          return Promise.resolve({ data: null, error: null });
        }
        return builder;
      },
      is: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
      in: (column: string, value: unknown) => { filters.push([column, value]); return Promise.resolve(response()); },
      maybeSingle: async () => ({ data: (rows[table] ?? (table === 'course_applications' ? [{ id: 'application-1' }] : []))[0] ?? null, error: null }),
      single: async () => ({ data: (rows[table] ?? [])[0] ?? null, error: null }),
      insert: (next: Record<string, unknown>) => {
        kind = 'insert'; payload = next;
        writes.push({ table, kind: 'insert', payload, filters: [...filters] });
        const id = insertedIds[table]?.shift() ?? `${table}-id`;
        const insertResult = { data: null, error: null, then: (resolve: (value: { data: null; error: null }) => unknown) => Promise.resolve(resolve({ data: null, error: null })) };
        return { select: () => ({ single: async () => ({ data: { id }, error: null }) }), ...insertResult };
      },
      update: (next: Record<string, unknown>) => { kind = 'update'; payload = next; return builder; },
      then: (resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) => Promise.resolve(resolve(response())),
    };
    calls.push({ table, filters });
    return builder;
  };
  return { client: { from } as never, calls, writes };
}

afterEach(() => vi.resetAllMocks());

describe('syncApplicationPlan', () => {
  it('checks application ownership and writes only the dedicated hierarchy on an initial sync', async () => {
    mockedGetApplicationPlan.mockResolvedValue(compiledPlan);
    const fake = fakeSupabase();

    await expect(syncApplicationPlan(fake.client, 'application-1', 'user-1')).resolves.toEqual({ inserted: 4, updated: 0, restored: 0, archived: 0 });

    expect(mockedGetApplicationPlan).toHaveBeenCalledWith(fake.client, 'application-1', 'user-1');
    expect(fake.calls.find((call) => call.table === 'course_applications')?.filters).toEqual([['id', 'application-1'], ['user_id', 'user-1']]);
    expect(fake.writes.map((write) => write.table)).toEqual([
      'application_plans', 'application_plan_phases', 'application_plan_steps', 'application_plan_micro_steps',
    ]);
    expect(fake.writes.some((write) => write.table === 'application_recommendations')).toBe(false);
    expect(fake.writes.at(-1)?.payload).not.toHaveProperty('status');
    expect(fake.writes.at(-1)?.payload).not.toHaveProperty('deadline');
    expect(fake.writes.at(-1)?.payload).not.toHaveProperty('content_value');
  });

  it('preserves existing Core 4 execution fields while updating a Core 3 planning title', async () => {
    const revised = structuredClone(compiledPlan);
    revised.phases[0]!.steps[0]!.microSteps[0]!.title = 'Upload verified evidence';
    mockedGetApplicationPlan.mockResolvedValue(revised);
    const fake = fakeSupabase({
      application_plans: [{ id: 'db-plan', application_id: 'application-1', producer: 'core3_deterministic', domain_plan_id: revised.id, readiness: revised.readiness, archived_at: null }],
      application_plan_phases: [{ id: 'db-phase', plan_id: 'db-plan', domain_node_id: 'phase:blockers', title: 'Resolve blockers', objective: 'Remove blocker.', sort_order: 1, source_decision_ids: ['decision:eligibility'], source_provenances: ['database_factual'], archived_at: null }],
      application_plan_steps: [{ id: 'db-step', phase_id: 'db-phase', domain_node_id: 'step:blockers:eligibility', title: 'Resolve eligibility', objective: 'Meet rule.', sort_order: 1, source_decision_ids: ['decision:eligibility'], source_provenances: ['database_factual'], archived_at: null }],
      application_plan_micro_steps: [{ id: 'db-micro', step_id: 'db-step', domain_node_id: 'micro-step:blockers:eligibility:detail', title: 'Collect evidence', sort_order: 1, readiness: 'requires_enrichment', content_schema: null, source_decision_ids: ['decision:eligibility'], source_provenances: ['database_factual'], status: 'in_progress', deadline: '2026-10-01', content_value: { type: 'long_text', text: 'Student work' }, execution_evidence: [{ id: 'evidence-1' }], archived_at: null }],
    });

    await expect(syncApplicationPlan(fake.client, 'application-1', 'user-1')).resolves.toEqual({ inserted: 0, updated: 1, restored: 0, archived: 0 });

    const update = fake.writes.find((write) => write.table === 'application_plan_micro_steps');
    expect(update?.payload).toMatchObject({ title: 'Upload verified evidence' });
    expect(update?.payload).not.toHaveProperty('status');
    expect(update?.payload).not.toHaveProperty('deadline');
    expect(update?.payload).not.toHaveProperty('content_value');
    expect(update?.payload).not.toHaveProperty('execution_evidence');
  });
});
