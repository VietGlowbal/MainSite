import { describe, expect, it } from 'vitest';
import { PlannerMicroStepUpdateError, updateApplicationPlannerMicroStep } from './update-application-planner-micro-step';

function fakeSupabase(options: { owned?: boolean; micro?: Record<string, unknown> | null } = {}) {
  const writes: Record<string, unknown>[] = [];
  const rows: Record<string, Record<string, unknown>[]> = {
    course_applications: options.owned === false ? [] : [{ id: 'app-1' }],
    application_plans: [{ id: 'plan-1' }],
    application_plan_phases: [{ id: 'phase-1' }],
    application_plan_steps: [{ id: 'step-1' }],
  };
  const from = (table: string) => {
    let updatePayload: Record<string, unknown> | null = null;
    const builder = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      is: () => builder,
      maybeSingle: async () => updatePayload ? { data: options.micro ?? { id: 'micro-1', status: 'completed', deadline: null, content_value: null }, error: null } : { data: rows[table]?.[0] ?? null, error: null },
      then: (resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) => Promise.resolve(resolve({ data: rows[table] ?? [], error: null })),
      update: (payload: Record<string, unknown>) => { updatePayload = payload; writes.push({ table, ...payload }); return builder; },
    };
    return builder;
  };
  return { client: { from } as never, writes };
}

describe('updateApplicationPlannerMicroStep', () => {
  it('updates only allowlisted execution fields and returns normalized state', async () => {
    const fake = fakeSupabase();
    const result = await updateApplicationPlannerMicroStep(fake.client, 'app-1', 'user-1', 'micro-1', { status: 'completed', deadline: '2026-10-01', contentValue: { type: 'long_text', text: 'Student work' } });
    expect(result).toEqual({ id: 'micro-1', status: 'completed', deadline: null, contentValue: null });
    expect(fake.writes[0]).toMatchObject({ table: 'application_plan_micro_steps', status: 'completed', deadline: '2026-10-01', content_value: { type: 'long_text', text: 'Student work' } });
    expect(fake.writes[0]).not.toHaveProperty('title');
    expect(fake.writes[0]).not.toHaveProperty('content_schema');
    expect(fake.writes[0]).not.toHaveProperty('sort_order');
  });

  it('rejects foreign users before looking up a canonical hierarchy row', async () => {
    const fake = fakeSupabase({ owned: false });
    await expect(updateApplicationPlannerMicroStep(fake.client, 'app-1', 'other-user', 'legacy-recommendation-id', { status: 'completed' })).rejects.toMatchObject({ code: 'not_found' } satisfies Partial<PlannerMicroStepUpdateError>);
    expect(fake.writes).toEqual([]);
  });
});
