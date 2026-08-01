import { describe, expect, it } from 'vitest';
import { generateRecommendations } from '../generate-recommendations';

type Op = 'select' | 'insert' | 'update';

/**
 * A minimal fake Supabase client for `generateRecommendations`. Every method
 * on the query builder returns itself so any chain shape resolves, and the
 * builder is thenable so `await supabase.from(...)....` works whether or not
 * the real code calls a terminal method like `.maybeSingle()` — this
 * function's actual chains do both (see the calls in generate-recommendations.ts).
 */
function buildSupabase(options: {
  latestMatch?: { id: string; improvement_actions: unknown[] } | null;
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

      if (table === 'application_match_analyses') {
        return { data: options.latestMatch ?? null, error: null };
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
      not: () => builder,
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

describe('generateRecommendations', () => {
  it('errors with no_match_analysis when no Course Match Analysis exists yet', async () => {
    const supabase = buildSupabase({ latestMatch: null });
    const result = await generateRecommendations(supabase as never, 'app-1');
    expect(result).toEqual({ ok: false, error: 'no_match_analysis', inserted: 0, updated: 0, archived: 0 });
  });

  it('inserts new recommendations with estimated_impact and pillar persisted', async () => {
    const supabase = buildSupabase({
      latestMatch: {
        id: 'analysis-1',
        improvement_actions: [
          {
            id: 'a1',
            pillar: 'academic',
            label: 'Improve Mathematics grade',
            detail: 'Required for entry.',
            estimatedUplift: 25,
            actionType: 'none',
          },
        ],
      },
      existingRows: [],
    });

    const result = await generateRecommendations(supabase as never, 'app-1');

    expect(result).toEqual({ ok: true, inserted: 1, updated: 0, archived: 0 });
    const insertCall = supabase.calls.find((c) => c.op === 'insert');
    expect(insertCall).toBeDefined();
    const rows = insertCall!.value as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({
      estimated_impact: 25,
      pillar: 'academic',
      source_analysis_id: 'analysis-1',
      archived_at: null,
    });
  });

  it('reports read_failed without touching the database further when the existing-rows read errors', async () => {
    const supabase = buildSupabase({
      latestMatch: { id: 'analysis-1', improvement_actions: [] },
      failOn: { table: 'application_recommendations', op: 'select' },
    });

    const result = await generateRecommendations(supabase as never, 'app-1');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('read_failed');
    expect(supabase.calls).toHaveLength(0);
  });

  it('reports insert_failed and does not silently claim success', async () => {
    const supabase = buildSupabase({
      latestMatch: {
        id: 'analysis-1',
        improvement_actions: [
          { id: 'a1', pillar: 'academic', label: 'X', detail: '', estimatedUplift: 5, actionType: 'none' },
        ],
      },
      existingRows: [],
      failOn: { table: 'application_recommendations', op: 'insert' },
    });

    const result = await generateRecommendations(supabase as never, 'app-1');
    expect(result).toEqual({ ok: false, error: 'insert_failed', inserted: 0, updated: 0, archived: 0 });
  });

  it('archives a stale recommendation no longer represented in the new analysis', async () => {
    const supabase = buildSupabase({
      latestMatch: { id: 'analysis-2', improvement_actions: [] },
      existingRows: [{ id: 'rec-1', pillar: 'academic', title: 'Old advice', status: 'not_started' }],
    });

    const result = await generateRecommendations(supabase as never, 'app-1');

    expect(result).toEqual({ ok: true, inserted: 0, updated: 0, archived: 1 });
    const archiveCall = supabase.calls.find((c) => c.op === 'update');
    expect(archiveCall?.value).toMatchObject({ archived_at: expect.any(String) });
  });
});
