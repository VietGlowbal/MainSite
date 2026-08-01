import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A stand-in for the two tables `seedBaselineChecklist` touches.
 *
 * `stageRows` / `taskRows` are what the database is pretending to already hold;
 * `insertedStages` / `insertedTasks` are what the function tried to write. That
 * split is the point of every test below — the function is idempotent, so what
 * it *does not* write matters as much as what it does.
 */
let stageRows: Array<{ id: string; slug: string }> = [];
let taskRows: Array<{ stage_id: string | null }> = [];
let insertedStages: Array<Record<string, unknown>> = [];
let insertedTasks: Array<Record<string, unknown>> = [];
let stageInsertError: { code?: string; message: string } | null = null;
let taskInsertError: { code?: string; message: string } | null = null;

function stageTable() {
  return {
    select: () => ({ eq: async () => ({ data: stageRows, error: null }) }),
    insert: (rows: Array<Record<string, unknown>>) => {
      insertedStages = rows;
      return {
        select: async () =>
          stageInsertError
            ? { data: null, error: stageInsertError }
            : {
                data: rows.map((r, i) => ({ id: `new-${i}`, slug: r.slug })),
                error: null,
              },
      };
    },
  };
}

function taskTable() {
  return {
    select: () => ({ eq: async () => ({ data: taskRows, error: null }) }),
    insert: async (rows: Array<Record<string, unknown>>) => {
      insertedTasks = rows;
      return { error: taskInsertError };
    },
  };
}

const mockFrom = vi.fn((table: string) =>
  table === 'application_stages' ? stageTable() : taskTable(),
);

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import { STAGE_TEMPLATE } from './extract-course';
import {
  BASELINE_TASK_COUNT,
  BaselineNotEnabledError,
  seedBaselineChecklist,
} from './baseline-checklist';

beforeEach(() => {
  stageRows = [];
  taskRows = [];
  insertedStages = [];
  insertedTasks = [];
  stageInsertError = null;
  taskInsertError = null;
  vi.clearAllMocks();
});

describe('seedBaselineChecklist', () => {
  it('writes the five template stages onto a bare application', async () => {
    const result = await seedBaselineChecklist('app-1');

    expect(result.stages).toBe(5);
    expect(insertedStages.map((s) => s.slug)).toEqual(STAGE_TEMPLATE.map((s) => s.slug));
  });

  it('does not redefine the stages — names and order come from STAGE_TEMPLATE', async () => {
    await seedBaselineChecklist('app-1');

    expect(insertedStages.map((s) => s.name)).toEqual(STAGE_TEMPLATE.map((s) => s.name));
    expect(insertedStages.map((s) => s.order_num)).toEqual([1, 2, 3, 4, 5]);
  });

  it('flags the spine as not ai_generated, so a later parse enriches it', async () => {
    // If these were written `ai_generated: true`, writeChecklist's old delete
    // would have wiped them; if the flag were missing the spine would look
    // model-authored. Both are wrong for tasks nothing inferred.
    await seedBaselineChecklist('app-1');
    expect(insertedStages.every((s) => s.ai_generated === false)).toBe(true);
  });

  it("marks tasks created_by 'system' and gives them no confidence", async () => {
    await seedBaselineChecklist('app-1');

    expect(insertedTasks).toHaveLength(BASELINE_TASK_COUNT);
    expect(insertedTasks.every((t) => t.created_by === 'system')).toBe(true);
    // A confidence number would imply a judgement that was never made.
    expect(insertedTasks.every((t) => t.confidence === null)).toBe(true);
  });

  it('is idempotent: a second run over the same application writes nothing', async () => {
    stageRows = STAGE_TEMPLATE.map((s, i) => ({ id: `s-${i}`, slug: s.slug }));
    taskRows = stageRows.map((s) => ({ stage_id: s.id }));

    const result = await seedBaselineChecklist('app-1');

    expect(result).toEqual({ stages: 0, tasks: 0 });
    expect(insertedStages).toEqual([]);
    expect(insertedTasks).toEqual([]);
  });

  it('adds only the stages that are missing', async () => {
    stageRows = [{ id: 's-0', slug: 'research' }];
    taskRows = [{ stage_id: 's-0' }];

    const result = await seedBaselineChecklist('app-1');

    expect(result.stages).toBe(4);
    expect(insertedStages.map((s) => s.slug)).not.toContain('research');
  });

  it('leaves a stage the parse already filled alone', async () => {
    // A specific requirement list must not get a generic "read the course page"
    // dropped underneath it.
    stageRows = STAGE_TEMPLATE.map((s, i) => ({ id: `s-${i}`, slug: s.slug }));
    taskRows = [{ stage_id: 's-1' }]; // check-eligibility already has tasks

    await seedBaselineChecklist('app-1');

    expect(insertedTasks.some((t) => t.stage_id === 's-1')).toBe(false);
    expect(insertedTasks.some((t) => t.stage_id === 's-0')).toBe(true);
  });

  it('names the missing migration when created_by rejects system', async () => {
    // 23514 is Postgres check_violation — on this insert it can only be
    // valid_created_by, i.e. supabase-apply-baseline-checklist.sql is unapplied.
    taskInsertError = { code: '23514', message: 'violates check constraint' };

    await expect(seedBaselineChecklist('app-1')).rejects.toThrow(BaselineNotEnabledError);
    await expect(seedBaselineChecklist('app-1')).rejects.toThrow(
      /supabase-apply-baseline-checklist\.sql/,
    );
  });

  it('surfaces any other write failure rather than reporting success', async () => {
    stageInsertError = { message: 'connection reset' };
    await expect(seedBaselineChecklist('app-1')).rejects.toThrow(/connection reset/);
  });
});

describe('the baseline itself', () => {
  it('covers every stage in the template', async () => {
    await seedBaselineChecklist('app-1');
    const stageIds = new Set(insertedTasks.map((t) => t.stage_id));
    expect(stageIds.size).toBe(STAGE_TEMPLATE.length);
  });

  it('names no university-specific fact', async () => {
    await seedBaselineChecklist('app-1');
    const prose = insertedTasks.map((t) => `${t.title} ${t.description}`).join(' ');
    // Nothing here may assert a score, a fee or a date — those are the course
    // page's to state, and inventing one is the failure this baseline exists to
    // avoid being accused of.
    expect(prose).not.toMatch(/\bIELTS\s*\d|\bTOEFL\s*\d|\$\d|\b\d{4}-\d{2}-\d{2}\b/);
  });
});
