import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown) => fn,
}));

const from = vi.fn();
vi.mock('@/server/db/admin', () => ({
  createAdminClient: () => ({ from }),
}));

import { toDirectoryScholarship } from '@/lib/scholarships-data';
import { SupabaseScholarshipRepository } from '../supabase-scholarship-repository';
import { normalizeScholarshipDirectoryFilters } from '../../domain/eligibility-normalization';

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
  gte(...args: unknown[]) { this.calls.push(['gte', ...args]); return this; }
  lt(...args: unknown[]) { this.calls.push(['lt', ...args]); return this; }
  is(...args: unknown[]) { this.calls.push(['is', ...args]); return this; }
  order(...args: unknown[]) { this.calls.push(['order', ...args]); return this; }
  range(...args: unknown[]) { this.calls.push(['range', ...args]); return this; }
  limit(...args: unknown[]) { this.calls.push(['limit', ...args]); return this; }
  then(resolve: (result: Result) => unknown) { return Promise.resolve(this.result).then(resolve); }
}

function row(id = 1) {
  return {
    id,
    name: `Award ${id}`,
    slug: `award-${id}`,
    scope: 'university' as const,
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
    source_lang: 'en' as const,
    ranking_note: null,
    status: 'published' as const,
    scholarship_universities: [],
  };
}

describe('SupabaseScholarshipRepository.listPublished', () => {
  beforeEach(() => from.mockReset());

  it('attaches typed benefit normalization without replacing raw catalogue fields', () => {
    const result = toDirectoryScholarship({
      ...row(11),
      coverage: '100% tuition',
      funding_type: ['full-ride'],
    });

    expect(result.coverage).toBe('100% tuition');
    expect(result.benefits?.classification).toMatchObject({
      label: 'tuition-only',
      fullRideStatus: 'not-claimed',
    });
    expect(result.benefits?.components[0]).toMatchObject({
      type: 'tuition',
      percentage: { min: 100, max: null },
    });
  });

  it('loads the complete filtered set before applying deterministic ranking and pagination', async () => {
    const query = new Query({ data: [row(10)], error: null, count: 17 });
    from.mockReturnValue(query);

    const result = await new SupabaseScholarshipRepository().listPublished({
      page: 1,
      pageSize: 9,
      sort: 'name',
    });

    expect(from).toHaveBeenCalledWith('scholarships');
    expect(query.calls).toContainEqual(['eq', 'status', 'published']);
    expect(query.calls).toContainEqual(['range', 0, 999]);
    expect(query.calls).toContainEqual(['order', 'id', { ascending: true }]);
    expect(query.calls.find(([method]) => method === 'select')?.[2]).toEqual({ count: 'exact' });
    expect(result.total).toBe(17);
    expect(result.items).toHaveLength(1);
  });

  it('carries structured country, funding, discovery, and date-backed deadline filters to SQL', async () => {
    const query = new Query({ data: [row(10)], error: null, count: 1 });
    from.mockReturnValue(query);

    await new SupabaseScholarshipRepository().listPublished({
      page: 1,
      pageSize: 9,
      sort: 'name',
      filters: normalizeScholarshipDirectoryFilters({
        country: 'United Kingdom',
        fundingTypes: ['merit'],
        major: 'stem',
        degree: 'postgraduate',
        subject: 'Computer Science',
        deadline: 'open',
      }),
    });

    expect(query.calls).toContainEqual(['eq', 'country', 'United Kingdom']);
    expect(query.calls).toContainEqual(['overlaps', 'funding_type', ['merit']]);
    expect(query.calls).toContainEqual(['gte', 'deadline_date', expect.any(String)]);
    expect(query.calls.filter(([method]) => method === 'or').length).toBe(3);
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
      universityId: 42,
      filters: normalizeScholarshipDirectoryFilters({ universityIds: [42] }),
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

  it('loads a counted, ranked Home spotlight without reading the full directory', async () => {
    const count = new Query({ data: [], error: null, count: 2_877 });
    const candidates = new Query({
      data: [
        {
          ...row(101),
          name: 'High-score award without a mark',
          coverage: 'Full ride',
          amount_min: 50_000,
          amount_currency: 'USD',
          ranking_note: 'Most prestigious',
        },
        {
          ...row(140),
          name: 'Gates Cambridge',
          coverage: 'Full ride',
          ranking_note: 'Top global',
          scholarship_universities: [
            {
              university_id: 23,
              match_score: 100,
              confirmed: true,
              universities: {
                id: 23,
                name: 'University of Cambridge',
                country: 'United Kingdom',
                logo_url: 'https://example.test/cambridge.webp',
              },
            },
          ],
        },
        {
          ...row(147),
          name: 'Rhodes Scholarship',
          coverage: 'Full ride',
          ranking_note: 'Most prestigious',
          scholarship_universities: [
            {
              university_id: 22,
              match_score: 100,
              confirmed: true,
              universities: {
                id: 22,
                name: 'University of Oxford',
                country: 'United Kingdom',
                logo_url: 'https://example.test/oxford.webp',
              },
            },
          ],
        },
      ],
      error: null,
    });
    from.mockReturnValueOnce(count).mockReturnValueOnce(candidates);

    const result = await new SupabaseScholarshipRepository().homeHighlights(2);

    expect(result.total).toBe(2_877);
    expect(result.items.map((item) => item.name)).toEqual([
      'Rhodes Scholarship',
      'Gates Cambridge',
    ]);
    expect(count.calls).toContainEqual(['select', 'id', { count: 'exact', head: true }]);
    expect(candidates.calls).toContainEqual(['not', 'ranking_note', 'is', null]);
    expect(candidates.calls).toContainEqual(['limit', 32]);
  });
});
