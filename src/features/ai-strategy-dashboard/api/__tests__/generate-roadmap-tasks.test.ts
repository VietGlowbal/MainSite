import { describe, expect, it } from 'vitest';
import { generateRoadmapTasks } from '../generate-roadmap-tasks';

type Op = 'select' | 'insert' | 'update';

/**
 * Same minimal fake Supabase client as `generate-recommendations.test.ts` —
 * every method on the query builder returns itself so any chain shape
 * resolves, and the builder is thenable so `await supabase.from(...)....`
 * works whether or not the real code calls a terminal method.
 */
function buildSupabase(options: {
  latestStrategy?: { roadmap: { why: string; prioritize: string[]; avoid: string[] } } | null;
  existingRows?: Array<{ id: string; pillar: string | null; title: string; status: string }>;
  failOn?: { table: string; op: Op };
}) {
  const calls: Array<{ table: string; op: Op; value?: unknown }> = [];

  function makeBuilder(table: string) {
    let op: Op = 'select';
    let value: unknown;

    const resolve = () => {
      const failed = options.failOn && options.failOn.table === table && options.failOn.op === op;
      if (failed) return { data: null, error: { message: 'boom' } };

      if (table === 'application_strategy_recommendations') {
        return { data: options.latestStrategy ?? null, error: null };
      }
      if (table === 'application_recommendations') {
        if (op === 'select') return { data: options.existingRows ?? [], error: null };
        return { data: null, error: null };
      }
      return { data: null, error: null };
    };

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      is: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      insert: (v: unknown) => {
        op = 'insert';
        value = v;
        calls.push({ table, op, value });
        return builder;
      },
      update: (v: unknown) => {
        op = 'update';
        value = v;
        calls.push({ table, op, value });
        return builder;
      },
      maybeSingle: async () => resolve(),
      then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(resolve()).then(onFulfilled),
    };
    return builder;
  }

  return {
    from: (table: string) => makeBuilder(table),
    calls,
  };
}

describe('generateRoadmapTasks', () => {
  it('errors with no_strategy_recommendation when F7 has not generated yet', async () => {
    const supabase = buildSupabase({ latestStrategy: null });
    const result = await generateRoadmapTasks(supabase as never, 'app-1');
    expect(result).toEqual({
      ok: false,
      error: 'no_strategy_recommendation',
      inserted: 0,
      updated: 0,
      archived: 0,
    });
  });

  it('inserts prioritize and avoid items as next_action rows under the strategy-roadmap category', async () => {
    const supabase = buildSupabase({
      latestStrategy: {
        roadmap: {
          why: 'Concentrates your story around one identity.',
          prioritize: ['Lead a research project'],
          avoid: ['Spreading across unrelated clubs'],
        },
      },
      existingRows: [],
    });

    const result = await generateRoadmapTasks(supabase as never, 'app-1');

    expect(result).toEqual({ ok: true, inserted: 2, updated: 0, archived: 0 });
    const insertCall = supabase.calls.find((c) => c.op === 'insert');
    const rows = insertCall!.value as Array<Record<string, unknown>>;
    expect(rows).toEqual([
      expect.objectContaining({
        recommendation_type: 'next_action',
        category: 'strategy-roadmap',
        pillar: null,
        title: 'Lead a research project',
        priority: 'high',
      }),
      expect.objectContaining({
        recommendation_type: 'next_action',
        category: 'strategy-roadmap',
        title: 'Avoid: Spreading across unrelated clubs',
        priority: 'low',
      }),
    ]);
  });

  it('reports read_failed without touching the database further when the existing-rows read errors', async () => {
    const supabase = buildSupabase({
      latestStrategy: { roadmap: { why: '', prioritize: [], avoid: [] } },
      failOn: { table: 'application_recommendations', op: 'select' },
    });

    const result = await generateRoadmapTasks(supabase as never, 'app-1');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('read_failed');
    expect(supabase.calls).toHaveLength(0);
  });

  it('archives a roadmap task no longer represented after the report regenerates', async () => {
    const supabase = buildSupabase({
      latestStrategy: { roadmap: { why: '', prioritize: [], avoid: [] } },
      existingRows: [
        { id: 'rec-1', pillar: null, title: 'Old priority item', status: 'not_started' },
      ],
    });

    const result = await generateRoadmapTasks(supabase as never, 'app-1');

    expect(result).toEqual({ ok: true, inserted: 0, updated: 0, archived: 1 });
    const archiveCall = supabase.calls.find((c) => c.op === 'update');
    expect(archiveCall?.value).toMatchObject({ archived_at: expect.any(String) });
  });
});
