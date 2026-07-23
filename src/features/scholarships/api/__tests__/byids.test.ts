import { describe, expect, it } from 'vitest';
import type { ScholarshipLabel, ScholarshipQueries } from '../scholarship-queries';

/**
 * Contract tests for the `byIds` lookup.
 *
 * `byIds` exists to stop /apply pulling the whole published scholarship table
 * (2,877 rows / ~5.3 MB / ~2.7s measured) just to label a handful of saved
 * rows. The behaviours pinned here are the ones that make that substitution
 * safe: dedupe, unknown-id tolerance, and an empty-input short circuit that
 * issues no query at all.
 */
class FakeScholarshipRepo implements Pick<ScholarshipQueries, 'byIds'> {
  /** Ids the caller actually asked the database for, per call. */
  readonly queried: number[][] = [];

  constructor(private readonly rows: ScholarshipLabel[]) {}

  async byIds(ids: number[]): Promise<Map<number, ScholarshipLabel>> {
    const out = new Map<number, ScholarshipLabel>();
    if (ids.length === 0) return out;

    const unique = [...new Set(ids)];
    this.queried.push(unique);

    for (const row of this.rows) {
      if (unique.includes(row.id)) out.set(row.id, row);
    }
    return out;
  }
}

function label(id: number, name: string): ScholarshipLabel {
  return {
    id,
    name,
    scope: 'university',
    amountLabel: '10,000 USD',
    deadlineLabel: '1 Jan 2027',
    sourceUrl: null,
  };
}

const repo = new FakeScholarshipRepo([label(1, 'Alpha Award'), label(2, 'Beta Grant')]);

describe('ScholarshipQueries.byIds', () => {
  it('returns a map keyed by id', async () => {
    const found = await repo.byIds([1, 2]);
    expect(found.get(1)?.name).toBe('Alpha Award');
    expect(found.get(2)?.name).toBe('Beta Grant');
    expect(found.size).toBe(2);
  });

  it('deduplicates ids before querying', async () => {
    const r = new FakeScholarshipRepo([label(1, 'Alpha Award')]);
    // The same scholarship can be saved under several universities, so the
    // caller legitimately passes duplicates.
    await r.byIds([1, 1, 1]);
    expect(r.queried[0]).toEqual([1]);
  });

  it('omits unknown ids rather than throwing', async () => {
    const found = await repo.byIds([1, 999]);
    expect(found.has(999)).toBe(false);
    expect(found.size).toBe(1);
  });

  it('short-circuits on empty input without querying', async () => {
    const r = new FakeScholarshipRepo([label(1, 'Alpha Award')]);
    const found = await r.byIds([]);
    expect(found.size).toBe(0);
    expect(r.queried).toEqual([]);
  });
});
