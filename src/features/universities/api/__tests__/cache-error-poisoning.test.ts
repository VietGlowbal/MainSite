import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression: a database error must never be cached as "no data".
 *
 * 2026-09-29 the old Supabase project answered HTTP 402 for a while. The
 * repositories turned that error into an empty page, `unstable_cache` stored
 * it, and /universities showed "No universities match your filters" for twelve
 * hours — surviving a redeploy — after the database was healthy again.
 *
 * The fake below models the one property of `unstable_cache` that matters: a
 * resolved value is stored and served again, a rejection is not.
 */
const store = new Map<string, unknown>();
vi.mock('next/cache', () => ({
  unstable_cache:
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>, keyParts: string[]) =>
    async (...args: A): Promise<R> => {
      const key = JSON.stringify([keyParts, args]);
      if (store.has(key)) return store.get(key) as R;
      const value = await fn(...args);
      store.set(key, value);
      return value;
    },
}));

type Result = { data: unknown[] | null; error: { message: string } | null; count?: number | null };
const results: Result[] = [];

class Query {
  select() { return this; }
  eq() { return this; }
  in() { return this; }
  ilike() { return this; }
  order() { return this; }
  range() { return this; }
  limit() { return this; }
  then(resolve: (result: Result) => unknown) {
    const next = results.shift();
    if (!next) throw new Error('Unexpected query: no result queued');
    return Promise.resolve(next).then(resolve);
  }
}
const client = { from: () => new Query() };

vi.mock('@/server/db/admin', () => ({
  createAdminClient: () => client,
  isPlaceholderSupabaseConfig: () => false,
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => client,
}));

import { getUniversityFacets, loadUniversityDirectory } from '../directory-loader';
import { getTeamMembers } from '@/lib/team';

const outage: Result = { data: null, error: { message: 'Service for this project is restricted' } };

function university(id: number) {
  return { id, name: `University ${id}`, country: 'United Kingdom', image_url: null, logo_url: null };
}

beforeEach(() => {
  store.clear();
  results.length = 0;
});

describe('university directory under a database outage', () => {
  it('rejects instead of caching an empty page, and serves real rows once the database recovers', async () => {
    const query = { page: 1, search: '', country: '' };

    results.push(outage);
    await expect(loadUniversityDirectory(query)).rejects.toThrow(/restricted/);

    results.push({ data: [university(1), university(2)], error: null, count: 2 });
    const recovered = await loadUniversityDirectory(query);
    expect(recovered.page.total).toBe(2);
    expect(recovered.page.items.map((item) => item.name)).toEqual(['University 1', 'University 2']);
  });

  it('does not cache empty country facets', async () => {
    results.push(outage);
    await expect(getUniversityFacets()).rejects.toThrow(/restricted/);

    results.push({ data: [{ country: 'United Kingdom' }, { country: 'Australia' }], error: null, count: 2 });
    const facets = await getUniversityFacets();
    expect(facets.countries.map((facet) => facet.value)).toEqual(['Australia', 'United Kingdom']);
  });
});

describe('team roster under a database outage', () => {
  it('falls back to [] for the failing request only', async () => {
    results.push(outage);
    expect(await getTeamMembers()).toEqual([]);

    results.push({
      data: [{ id: 'a', full_name: 'Demo Member', photo_url: null, display_order: 1, achievements: [] }],
      error: null,
    });
    const members = await getTeamMembers();
    expect(members.map((member) => member.full_name)).toEqual(['Demo Member']);
  });
});
