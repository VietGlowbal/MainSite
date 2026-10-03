import { beforeEach, describe, expect, it, vi } from 'vitest';
import { inflateSync } from 'node:zlib';
import type { ScholarshipRow } from '@/lib/scholarships-data';

const state = vi.hoisted(() => ({
  rows: [] as unknown[],
  fail: false,
  reads: 0,
  entries: new Map<string, unknown>(),
  writes: [] as Array<{ keys: string[]; args: unknown[]; value: unknown }>,
}));

vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>, keys: string[]) =>
    async (...args: unknown[]) => {
      const key = JSON.stringify([keys, args]);
      if (state.entries.has(key)) return state.entries.get(key);
      const value = await fn(...args);
      if (Buffer.byteLength(JSON.stringify(value)) > 2 * 1024 * 1024) {
        throw new Error('Next data cache entry exceeds 2 MB');
      }
      state.entries.set(key, value);
      state.writes.push({ keys, args, value });
      return value;
    },
}));

vi.mock('@/server/db/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      let start = 0;
      let end = 999;
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        range: (offset: number, last: number) => { start = offset; end = last; return query; },
        then: (resolve: (result: unknown) => unknown) => {
          state.reads++;
          return Promise.resolve({
            data: state.fail ? null : state.rows.slice(start, end + 1),
            count: state.rows.length,
            error: state.fail ? { message: 'unavailable' } : null,
          }).then(resolve);
        },
      };
      return query;
    },
  }),
}));

import { SupabaseScholarshipRepository } from '../supabase-scholarship-repository';

function row(id: number): ScholarshipRow {
  return {
    id, name: `Award ${id}`, slug: null, scope: 'provider', country: null,
    provider: null, funding_type: [], coverage: null,
    amount_min: id, amount_max: id + 10, amount_currency: 'USD',
    slots: null, slots_text: null, eligibility: null, applies_to_text: null,
    conditions: null, insight: 'Preserve this original source evidence. '.repeat(180),
    deadline_date: null, deadline_text: null, source_url: 'https://example.org/award',
    source_lang: 'en', ranking_note: null, status: 'published', scholarship_universities: [],
  };
}

describe('complete scholarship candidate cache size', () => {
  beforeEach(() => {
    state.rows = [];
    state.fail = false;
    state.reads = 0;
    state.entries.clear();
    state.writes = [];
  });

  it('caches a >2 MB catalogue losslessly and ranks all batches before pagination', async () => {
    state.rows = Array.from({ length: 1001 }, (_, index) => row(index + 1));
    expect(Buffer.byteLength(JSON.stringify(state.rows))).toBeGreaterThan(2 * 1024 * 1024);
    const repo = new SupabaseScholarshipRepository();
    const page = await repo.listPublished({ page: 1, pageSize: 2, sort: 'value_desc' });
    expect(page.items.map((item) => item.id)).toEqual([1001, 1000]);
    expect(page.total).toBe(1001);
    expect(page.items[0]?.insight).toBe(row(1001).insight);
    expect(page.items[0]?.deadlineSortValue).toBe(Infinity);
    expect(state.reads).toBe(2);

    const cached = state.writes.find((entry) => entry.keys[0] === 'published-scholarship-candidates');
    expect(cached?.keys).toContain('raw-deflate-base64-v1');
    expect(typeof cached?.value).toBe('string');
    const decoded = JSON.parse(inflateSync(Buffer.from(cached?.value as string, 'base64')).toString());
    expect(decoded.rows).toEqual(state.rows);
    expect(decoded.total).toBe(1001);

    const next = await repo.listPublished({ page: 2, pageSize: 2, sort: 'value_desc' });
    expect(next.items.map((item) => item.id)).toEqual([999, 998]);
    expect(state.reads).toBe(2);
    const ascending = await repo.listPublished({ page: 1, pageSize: 2, sort: 'value_asc' });
    expect(ascending.items.map((item) => item.id)).toEqual([1, 2]);
    expect(state.reads).toBe(2);
  });

  it('does not cache a failed read as an empty or partial catalogue', async () => {
    state.rows = [row(1)];
    state.fail = true;
    const repo = new SupabaseScholarshipRepository();
    await expect(repo.listPublished({ page: 1, pageSize: 9, sort: 'name' })).rejects.toThrow('unavailable');
    expect(state.entries.size).toBe(0);
    state.fail = false;
    expect((await repo.listPublished({ page: 1, pageSize: 9, sort: 'name' })).items[0]?.id).toBe(1);
  });
});
