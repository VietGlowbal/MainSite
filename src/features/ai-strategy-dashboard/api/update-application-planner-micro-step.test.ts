import { describe, expect, it } from 'vitest';
import { PlannerMicroStepUpdateError, updateApplicationPlannerMicroStep } from './update-application-planner-micro-step';

function fakeSupabase(options: { owned?: boolean; micro?: Record<string, unknown> | null; existingMicro?: Record<string, unknown> } = {}) {
  const writes: Record<string, unknown>[] = [];
  const rows: Record<string, Record<string, unknown>[]> = {
    course_applications: options.owned === false ? [] : [{ id: 'app-1' }],
    application_plans: [{ id: 'plan-1' }],
    application_plan_phases: [{ id: 'phase-1' }],
    application_plan_steps: [{ id: 'step-1' }],
    application_plan_micro_steps: [options.existingMicro ?? { id: 'micro-1', content_schema: { type: 'long_text', prompt: 'Explain' }, content_value: null }],
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

  it('marks a declared availability long-text save as a planning input change', async () => {
    const schema = { type: 'long_text', prompt: 'When can you work?', semanticKey: 'planner.availability' } as const;
    const fake = fakeSupabase({
      existingMicro: { id: 'micro-1', content_schema: schema, content_value: null },
      micro: { id: 'micro-1', status: 'not_started', deadline: null, content_value: { type: 'long_text', text: 'Weekday evenings' } },
    });

    const result = await updateApplicationPlannerMicroStep(fake.client, 'app-1', 'user-1', 'micro-1', {
      contentValue: { type: 'long_text', text: 'Weekday evenings' },
    });

    expect(result).toMatchObject({
      id: 'micro-1',
      contentValue: { type: 'long_text', text: 'Weekday evenings' },
      planningInputChanged: true,
    });
  });

  it('rejects foreign users before looking up a canonical hierarchy row', async () => {
    const fake = fakeSupabase({ owned: false });
    await expect(updateApplicationPlannerMicroStep(fake.client, 'app-1', 'other-user', 'legacy-recommendation-id', { status: 'completed' })).rejects.toMatchObject({ code: 'not_found' } satisfies Partial<PlannerMicroStepUpdateError>);
    expect(fake.writes).toEqual([]);
  });

  it('rejects a content value that does not match the stored schema', async () => {
    const fake = fakeSupabase({ micro: { id: 'micro-1', content_schema: { type: 'single_select', prompt: 'Focus', semanticKey: 'focus', options: [{ value: 'essay', label: 'Essay' }] }, content_value: null } });
    await expect(updateApplicationPlannerMicroStep(fake.client, 'app-1', 'user-1', 'micro-1', { contentValue: { type: 'single_select', value: 'portfolio' } })).rejects.toMatchObject({ code: 'invalid_content' });
    expect(fake.writes).toEqual([]);
  });

  // CHARACTERIZATION (Part 5.1): the required-content gate. A task whose
  // generated schema demands student input cannot be marked completed while
  // that input is missing — and when it blocks, NOTHING is written, so a
  // rejected completion can never half-persist.
  it('blocks completion behind the required-content gate and writes nothing', async () => {
    const fake = fakeSupabase({
      existingMicro: {
        id: 'micro-1',
        content_schema: { type: 'long_text', prompt: 'Reflect on your readiness', minWords: 50 },
        content_value: null,
      },
    });
    await expect(
      updateApplicationPlannerMicroStep(fake.client, 'app-1', 'user-1', 'micro-1', { status: 'completed' }),
    ).rejects.toMatchObject({ code: 'input_required' } satisfies Partial<PlannerMicroStepUpdateError>);
    expect(fake.writes).toEqual([]);
  });

  // CHARACTERIZATION (Part 5.1): the gate only guards COMPLETION. Supplying
  // the demanded content in the same patch passes, and reopening a task is
  // always allowed even while its content is still incomplete — otherwise a
  // student could never back out of an accidentally-completed empty task.
  it('completes once the required content arrives, and reopens regardless of content', async () => {
    const schema = { type: 'single_select', prompt: 'Choose a focus', options: [{ value: 'deepen', label: 'Deepen' }, { value: 'broaden', label: 'Broaden' }], semanticKey: 'focus.choice' } as const;

    const satisfied = fakeSupabase({
      existingMicro: { id: 'micro-1', content_schema: schema, content_value: null },
      micro: { id: 'micro-1', status: 'completed', deadline: null, content_value: { type: 'single_select', value: 'deepen' } },
    });
    const done = await updateApplicationPlannerMicroStep(satisfied.client, 'app-1', 'user-1', 'micro-1', {
      status: 'completed',
      contentValue: { type: 'single_select', value: 'deepen' },
    });
    expect(done.status).toBe('completed');
    expect(satisfied.writes[0]).toMatchObject({ status: 'completed' });

    const reopened = fakeSupabase({
      existingMicro: { id: 'micro-1', content_schema: schema, content_value: null },
      micro: { id: 'micro-1', status: 'not_started', deadline: null, content_value: null },
    });
    const result = await updateApplicationPlannerMicroStep(reopened.client, 'app-1', 'user-1', 'micro-1', { status: 'not_started' });
    expect(result.status).toBe('not_started');
    expect(reopened.writes[0]).toMatchObject({ status: 'not_started' });
  });
});
