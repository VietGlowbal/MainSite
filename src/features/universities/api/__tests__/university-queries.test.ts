import { describe, expect, it } from 'vitest';
import {
  UNIVERSITY_PAGE_SIZE_DEFAULT,
  UNIVERSITY_PAGE_SIZE_MAX,
  clampPage,
  clampPageSize,
  toPage,
} from '../university-queries';
import { InMemoryUniversityRepository, makeUniversity } from './fakes';

const rows = [
  makeUniversity({ id: 1, name: 'Alpha University', country: 'United Kingdom', qs_rank: 10 }),
  makeUniversity({ id: 2, name: 'Beta Institute', country: 'United Kingdom', qs_rank: 5 }),
  makeUniversity({ id: 3, name: 'Gamma College', country: 'Australia', qs_rank: null }),
  makeUniversity({ id: 4, name: 'Delta School', country: 'Australia', qs_rank: 42 }),
  makeUniversity({ id: 5, name: 'Epsilon Academy', country: 'Canada', qs_rank: 1 }),
];

const repo = new InMemoryUniversityRepository(rows);

describe('pagination clamping', () => {
  it('clamps page to a 1-based index', () => {
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-7)).toBe(1);
    expect(clampPage(3)).toBe(3);
    expect(clampPage(2.9)).toBe(2);
  });

  it('falls back to the default page for a non-finite page', () => {
    expect(clampPage(Number.NaN)).toBe(1);
    expect(clampPage(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('caps page size so a crafted query cannot request the whole table', () => {
    expect(clampPageSize(10_000)).toBe(UNIVERSITY_PAGE_SIZE_MAX);
    expect(clampPageSize(0)).toBe(1);
    expect(clampPageSize(Number.NaN)).toBe(UNIVERSITY_PAGE_SIZE_DEFAULT);
    expect(clampPageSize(9)).toBe(9);
  });
});

describe('toPage', () => {
  it('reports hasMore while rows remain', () => {
    expect(toPage([1, 2], 5, 1, 2).hasMore).toBe(true);
    expect(toPage([5], 5, 3, 2).hasMore).toBe(false);
  });

  it('reports hasMore false on an exact final page', () => {
    expect(toPage([3, 4], 4, 2, 2).hasMore).toBe(false);
  });

  it('handles an empty result set', () => {
    const p = toPage<number>([], 0, 1, 9);
    expect(p.items).toEqual([]);
    expect(p.total).toBe(0);
    expect(p.hasMore).toBe(false);
  });
});

describe('UniversityQueries contract', () => {
  it('orders by QS rank with unranked universities last', async () => {
    const page = await repo.list({ page: 1, pageSize: 10 });
    expect(page.items.map((u) => u.id)).toEqual([5, 2, 1, 4, 3]);
  });

  it('orders by name when asked', async () => {
    const page = await repo.list({ page: 1, pageSize: 10, sort: 'name' });
    expect(page.items.map((u) => u.name)[0]).toBe('Alpha University');
  });

  it('paginates without overlap and reports the unpaginated total', async () => {
    const first = await repo.list({ page: 1, pageSize: 2 });
    const second = await repo.list({ page: 2, pageSize: 2 });

    expect(first.items).toHaveLength(2);
    expect(first.total).toBe(5);
    expect(first.hasMore).toBe(true);

    const overlap = first.items.filter((a) => second.items.some((b) => b.id === a.id));
    expect(overlap).toHaveLength(0);
  });

  it('returns an empty page past the end rather than throwing', async () => {
    const page = await repo.list({ page: 99, pageSize: 2 });
    expect(page.items).toEqual([]);
    expect(page.total).toBe(5);
    expect(page.hasMore).toBe(false);
  });

  it('filters by country', async () => {
    const page = await repo.list({ page: 1, pageSize: 10, countries: ['Australia'] });
    expect(page.items.map((u) => u.id).sort()).toEqual([3, 4]);
    expect(page.total).toBe(2);
  });

  it('search is case-insensitive and matches substrings', async () => {
    const page = await repo.list({ page: 1, pageSize: 10, search: 'beta' });
    expect(page.items.map((u) => u.name)).toEqual(['Beta Institute']);
  });

  it('getByIds short-circuits on an empty list', async () => {
    expect(await repo.getByIds([])).toEqual([]);
  });

  it('getByIds ignores unknown ids', async () => {
    const found = await repo.getByIds([1, 999]);
    expect(found.map((u) => u.id)).toEqual([1]);
  });

  it('getById returns null for an unknown id', async () => {
    expect(await repo.getById(999)).toBeNull();
  });

  it('facets counts by country, most common first', async () => {
    const f = await repo.facets();
    expect(f.total).toBe(5);
    expect(f.countries[0]).toEqual({ value: 'Australia', count: 2 });
    expect(f.countries.map((c) => c.value)).toContain('Canada');
  });
});
