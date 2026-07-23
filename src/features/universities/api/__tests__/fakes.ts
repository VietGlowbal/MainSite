import {
  clampPage,
  clampPageSize,
  toPage,
  type Page,
  type UniversityDetail,
  type UniversityFacets,
  type UniversityListItem,
  type UniversityListQuery,
  type UniversityQueries,
} from '../university-queries';

/**
 * In-memory {@link UniversityQueries} for tests.
 *
 * Implements the same paging/clamping/ordering contract as the Supabase
 * adapter so a test can assert on the contract without a database. If the two
 * ever disagree, the contract is under-specified — fix the port, not the fake.
 */
export class InMemoryUniversityRepository implements UniversityQueries {
  readonly name = 'in-memory';

  constructor(private readonly rows: UniversityListItem[]) {}

  async list(query: UniversityListQuery): Promise<Page<UniversityListItem>> {
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize);

    let rows = [...this.rows];

    if (query.countries?.length) {
      const wanted = new Set(query.countries);
      rows = rows.filter((r) => wanted.has(r.country));
    }
    if (query.search?.trim()) {
      const needle = query.search.trim().toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(needle));
    }

    rows.sort((a, b) =>
      query.sort === 'name'
        ? a.name.localeCompare(b.name)
        : // nullsFirst: false — unranked universities sort last.
          (a.qs_rank ?? Number.MAX_SAFE_INTEGER) - (b.qs_rank ?? Number.MAX_SAFE_INTEGER),
    );

    const from = (page - 1) * pageSize;
    return toPage(rows.slice(from, from + pageSize), rows.length, page, pageSize);
  }

  async listAllForLegacyExplorer(): Promise<UniversityListItem[]> {
    return [...this.rows].sort(
      (a, b) =>
        (a.qs_rank ?? Number.MAX_SAFE_INTEGER) - (b.qs_rank ?? Number.MAX_SAFE_INTEGER),
    );
  }

  async getById(id: number): Promise<UniversityDetail | null> {
    const row = this.rows.find((r) => r.id === id);
    return row ? (row as UniversityDetail) : null;
  }

  async getByIds(ids: number[]): Promise<UniversityListItem[]> {
    if (ids.length === 0) return [];
    const wanted = new Set(ids);
    return this.rows.filter((r) => wanted.has(r.id));
  }

  async facets(): Promise<UniversityFacets> {
    const tally = new Map<string, number>();
    for (const r of this.rows) {
      if (!r.country) continue;
      tally.set(r.country, (tally.get(r.country) ?? 0) + 1);
    }
    const countries = [...tally.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    return { countries, total: this.rows.length };
  }
}

/** Build a list row with only the fields a test cares about. */
export function makeUniversity(
  overrides: Partial<UniversityListItem> & Pick<UniversityListItem, 'id' | 'name' | 'country'>,
): UniversityListItem {
  return {
    local_name: null,
    type: null,
    qs_rank: null,
    the_rank: null,
    strengths: null,
    specific_insight: null,
    teaching_style: null,
    international_environment: null,
    gpa_range: null,
    english_requirement: null,
    standardized_test: null,
    admission_difficulty: null,
    accept_rate: null,
    application_deadline: null,
    scholarship: null,
    tuition_usd: null,
    living_cost_usd: null,
    housing: null,
    industry_connections: null,
    internship_coop: null,
    employability: null,
    best_for: null,
    notes: null,
    image_url: null,
    logo_url: null,
    ...overrides,
  };
}
