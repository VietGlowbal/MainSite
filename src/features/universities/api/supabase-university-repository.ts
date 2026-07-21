import { createAdminClient } from '@/server/db/admin';
import type { University } from '@/lib/types';
import {
  UNIVERSITY_LIST_COLUMNS,
  clampPage,
  clampPageSize,
  toPage,
  type Page,
  type UniversityDetail,
  type UniversityFacets,
  type UniversityListItem,
  type UniversityListQuery,
  type UniversityQueries,
} from './university-queries';

const LIST_SELECT = UNIVERSITY_LIST_COLUMNS.join(', ');

/**
 * Supabase-backed implementation of {@link UniversityQueries}.
 *
 * Uses the service-role client: the `universities` table is public reference
 * data, identical for every visitor, so there is no per-user row-level
 * filtering to preserve. Anything user-specific (match scores, shortlist state)
 * is computed above this layer.
 */
export class SupabaseUniversityRepository implements UniversityQueries {
  readonly name = 'supabase';

  async list(query: UniversityListQuery): Promise<Page<UniversityListItem>> {
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize);
    const from = (page - 1) * pageSize;

    const admin = createAdminClient();
    let q = admin
      .from('universities')
      .select(LIST_SELECT, { count: 'exact' })
      .range(from, from + pageSize - 1);

    if (query.countries?.length) {
      q = q.in('country', query.countries);
    }
    if (query.search?.trim()) {
      // ilike rather than full-text: the corpus is small and the column is not
      // indexed with a tsvector yet. Revisit if search becomes a hot path.
      q = q.ilike('name', `%${query.search.trim()}%`);
    }

    q =
      query.sort === 'name'
        ? q.order('name', { ascending: true })
        : q.order('qs_rank', { ascending: true, nullsFirst: false });

    const { data, error, count } = await q;
    if (error) {
      console.error('UniversityRepository.list failed:', error.message);
      return toPage<UniversityListItem>([], 0, page, pageSize);
    }

    const items = (data ?? []) as unknown as UniversityListItem[];
    return toPage(items, count ?? items.length, page, pageSize);
  }

  /** @deprecated See {@link UniversityQueries.listAllForLegacyExplorer}. */
  async listAllForLegacyExplorer(): Promise<UniversityListItem[]> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('universities')
      .select(LIST_SELECT)
      .order('qs_rank', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('UniversityRepository.listAllForLegacyExplorer failed:', error.message);
      return [];
    }
    return (data ?? []) as unknown as UniversityListItem[];
  }

  async getById(id: number): Promise<UniversityDetail | null> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('universities')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('UniversityRepository.getById failed:', error.message);
      return null;
    }
    return (data as University | null) ?? null;
  }

  async getByIds(ids: number[]): Promise<UniversityListItem[]> {
    if (ids.length === 0) return [];

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('universities')
      .select(LIST_SELECT)
      .in('id', ids);

    if (error) {
      console.error('UniversityRepository.getByIds failed:', error.message);
      return [];
    }
    return (data ?? []) as unknown as UniversityListItem[];
  }

  async facets(): Promise<UniversityFacets> {
    const admin = createAdminClient();
    const { data, error, count } = await admin
      .from('universities')
      .select('country', { count: 'exact' });

    if (error) {
      console.error('UniversityRepository.facets failed:', error.message);
      return { countries: [], total: 0 };
    }

    const rows = (data ?? []) as Array<{ country: string | null }>;
    const tally = new Map<string, number>();
    for (const row of rows) {
      if (!row.country) continue;
      tally.set(row.country, (tally.get(row.country) ?? 0) + 1);
    }

    const countries = [...tally.entries()]
      .map(([value, n]) => ({ value, count: n }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

    return { countries, total: count ?? rows.length };
  }
}
