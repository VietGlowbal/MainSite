import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown) => fn,
}));

const from = vi.fn();
vi.mock('@/server/db/admin', () => ({
  createAdminClient: () => ({ from }),
}));

import { SupabaseScholarshipRepository } from '../supabase-scholarship-repository';

type Result = { data: unknown[] | null; error: { message: string } | null; count?: number | null };

class Query {
  readonly calls: Array<[string, ...unknown[]]> = [];

  constructor(private readonly result: Result) {}

  select(...args: unknown[]) { this.calls.push(['select', ...args]); return this; }
  eq(...args: unknown[]) { this.calls.push(['eq', ...args]); return this; }
  ilike(...args: unknown[]) { this.calls.push(['ilike', ...args]); return this; }
  overlaps(...args: unknown[]) { this.calls.push(['overlaps', ...args]); return this; }
  in(...args: unknown[]) { this.calls.push(['in', ...args]); return this; }
  not(...args: unknown[]) { this.calls.push(['not', ...args]); return this; }
  or(...args: unknown[]) { this.calls.push(['or', ...args]); return this; }
  order(...args: unknown[]) { this.calls.push(['order', ...args]); return this; }
  range(...args: unknown[]) { this.calls.push(['range', ...args]); return this; }
  then(resolve: (result: Result) => unknown) { return Promise.resolve(this.result).then(resolve); }
}

function row(id = 1) {
  return {
    id,
    name: `Award ${id}`,
    slug: `award-${id}`,
    scope: 'university',
    country: 'United Kingdom',
    provider: null,
    funding_type: ['merit'],
    coverage: null,
    amount_min: null,
    amount_max: null,
    amount_currency: null,
    slots: null,
    slots_text: null,
    eligibility: null,
    applies_to_text: null,
    conditions: null,
    insight: null,
    deadline_date: null,
    deadline_text: null,
    source_url: null,
    source_lang: 'en',
    ranking_note: null,
    status: 'published',
    scholarship_universities: [],
  };
}

describe('SupabaseScholarshipRepository.listPublished', () => {
  beforeEach(() => from.mockReset());

  it('queries published rows with exact count, stable ordering, and a nine-row range', async () => {
    const query = new Query({ data: [row(10)], error: null, count: 17 });
    from.mockReturnValue(query);

    const result = await new SupabaseScholarshipRepository().listPublished({
      page: 2,
      pageSize: 9,
      sort: 'name',
    });

    expect(from).toHaveBeenCalledWith('scholarships');
    expect(query.calls).toContainEqual(['eq', 'status', 'published']);
    expect(query.calls).toContainEqual(['range', 9, 17]);
    expect(query.calls).toContainEqual(['order', 'name', { ascending: true }]);
    expect(query.calls).toContainEqual(['order', 'id', { ascending: true }]);
    expect(query.calls.find(([method]) => method === 'select')?.[2]).toEqual({ count: 'exact' });
    expect(result.total).toBe(17);
    expect(result.items).toHaveLength(1);
  });

  it('excludes scholarships linked to the focused university from the country section', async () => {
    const excluded = new Query({ data: [{ scholarship_id: 7 }, { scholarship_id: 8 }], error: null });
    const countryLinks = new Query({ data: [{ scholarship_id: 8 }, { scholarship_id: 9 }], error: null });
    const countryAwards = new Query({ data: [{ id: 10 }], error: null });
    const list = new Query({ data: [row(9)], error: null, count: 2 });
    from
      .mockReturnValueOnce(excluded)
      .mockReturnValueOnce(countryLinks)
      .mockReturnValueOnce(countryAwards)
      .mockReturnValueOnce(list);

    await new SupabaseScholarshipRepository().listPublished({
      page: 1,
      pageSize: 9,
      sort: 'name',
      relatedUniversityCountry: 'United Kingdom',
      excludeUniversityId: 42,
    });

    expect(list.calls).toContainEqual(['in', 'id', [9, 10]]);
    expect(list.calls).toContainEqual(['not', 'id', 'in', '(7,8)']);
  });

  it('throws instead of returning partial data when Supabase fails', async () => {
    from.mockReturnValue(new Query({ data: null, error: { message: 'database unavailable' }, count: null }));

    await expect(
      new SupabaseScholarshipRepository().listPublished({ page: 1, pageSize: 9, sort: 'name' }),
    ).rejects.toThrow('database unavailable');
  });
});
