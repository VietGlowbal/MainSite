import { createAdminClient } from '@/server/db/admin';
import { clampPage, clampPageSize, pageOffset, toPage, type Page } from '@/shared/lib';
import { getPublishedScholarships, type DirectoryScholarship } from '@/lib/scholarships-data';
import {
  SCHOLARSHIP_PAGE_SIZE_DEFAULT,
  SCHOLARSHIP_PAGE_SIZE_MAX,
  type ScholarshipFacets,
  type ScholarshipForUniversity,
  type ScholarshipLabel,
  type ScholarshipListQuery,
  type ScholarshipQueries,
} from './scholarship-queries';

/** Columns the "scholarships available here" strip on a university needs. */
const FOR_UNIVERSITY_SELECT = `
  university_id,
  scholarships (
    id, name, scope, funding_type, coverage, eligibility,
    amount_min, amount_max, amount_currency,
    deadline_date, deadline_text, source_url, status
  )
`;

type ForUniversityRow = {
  university_id: number;
  scholarships: {
    id: number;
    name: string;
    scope: DirectoryScholarship['scope'];
    funding_type: string[] | null;
    coverage: string | null;
    eligibility: string | null;
    amount_min: number | null;
    amount_max: number | null;
    amount_currency: string | null;
    deadline_date: string | null;
    deadline_text: string | null;
    source_url: string | null;
    status: string;
  } | null;
};

const NUM = new Intl.NumberFormat('en-US');

function formatAmount(
  min: number | null,
  max: number | null,
  currency: string | null,
): string | null {
  if (min == null && max == null) return null;
  const cur = currency ? ` ${currency}` : '';
  if (min != null && max != null && max !== min) {
    return `${NUM.format(min)}–${NUM.format(max)}${cur}`;
  }
  const value = min ?? max;
  return value == null ? null : `${NUM.format(value)}${cur}`;
}

function formatDeadline(date: string | null, text: string | null): string | null {
  if (date) {
    const t = Date.parse(date);
    if (!Number.isNaN(t)) {
      return new Date(t).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  }
  return text ?? null;
}

/**
 * Supabase-backed implementation of {@link ScholarshipQueries}.
 *
 * `listPublished` and `getById` currently read through the existing cached
 * `getPublishedScholarships()` and slice in memory. That is deliberate for
 * Phase 0: it preserves the exact payload the directory client already
 * receives, so this change is provably behaviour-neutral. Track A replaces the
 * body with a real ranged query once the client stops needing the full set.
 *
 * `byUniversityIds` is the one method that queries directly, because it has no
 * existing equivalent — it is the replacement for the whole-table load that
 * `/universities` performs today.
 */
export class SupabaseScholarshipRepository implements ScholarshipQueries {
  readonly name = 'supabase';

  async listPublished(query: ScholarshipListQuery): Promise<Page<DirectoryScholarship>> {
    const page = clampPage(query.page);
    const pageSize = clampPageSize(
      query.pageSize,
      SCHOLARSHIP_PAGE_SIZE_MAX,
      SCHOLARSHIP_PAGE_SIZE_DEFAULT,
    );

    const all = await getPublishedScholarships();

    const search = query.search?.trim().toLowerCase();
    const filtered = all.filter((s) => {
      if (query.country && s.country !== query.country) return false;
      if (query.scope && s.scope !== query.scope) return false;
      if (search && !s.name.toLowerCase().includes(search)) return false;
      return true;
    });

    const from = pageOffset(page, pageSize);
    return toPage(filtered.slice(from, from + pageSize), filtered.length, page, pageSize);
  }

  async byUniversityIds(ids: number[]): Promise<Map<number, ScholarshipForUniversity[]>> {
    const out = new Map<number, ScholarshipForUniversity[]>();
    if (ids.length === 0) return out;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('scholarship_universities')
      .select(FOR_UNIVERSITY_SELECT)
      .in('university_id', ids);

    if (error) {
      console.error('ScholarshipRepository.byUniversityIds failed:', error.message);
      return out;
    }

    for (const row of (data ?? []) as unknown as ForUniversityRow[]) {
      const s = row.scholarships;
      // The join carries drafts and archived rows too; only published ones are
      // public. Filtering here rather than in the query keeps the join simple.
      if (!s || s.status !== 'published') continue;

      const slim: ScholarshipForUniversity = {
        id: s.id,
        name: s.name,
        scope: s.scope,
        fundingType: s.funding_type ?? [],
        amountLabel: formatAmount(s.amount_min, s.amount_max, s.amount_currency),
        amountMin: s.amount_min,
        amountMax: s.amount_max,
        amountCurrency: s.amount_currency,
        coverage: s.coverage,
        eligibility: s.eligibility,
        deadlineLabel: formatDeadline(s.deadline_date, s.deadline_text),
        sourceUrl: s.source_url,
      };

      const bucket = out.get(row.university_id);
      if (bucket) bucket.push(slim);
      else out.set(row.university_id, [slim]);
    }

    return out;
  }

  async getById(id: number): Promise<DirectoryScholarship | null> {
    const all = await getPublishedScholarships();
    return all.find((s) => s.id === id) ?? null;
  }

  async byIds(ids: number[]): Promise<Map<number, ScholarshipLabel>> {
    const out = new Map<number, ScholarshipLabel>();
    if (ids.length === 0) return out;

    // Deduplicate: the same scholarship can be saved under several universities.
    const unique = [...new Set(ids)];

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('scholarships')
      .select(
        'id, name, scope, amount_min, amount_max, amount_currency, deadline_date, deadline_text, source_url',
      )
      .in('id', unique);

    if (error) {
      console.error('ScholarshipRepository.byIds failed:', error.message);
      return out;
    }

    for (const row of (data ?? []) as Array<{
      id: number;
      name: string;
      scope: DirectoryScholarship['scope'];
      amount_min: number | null;
      amount_max: number | null;
      amount_currency: string | null;
      deadline_date: string | null;
      deadline_text: string | null;
      source_url: string | null;
    }>) {
      out.set(row.id, {
        id: row.id,
        name: row.name,
        scope: row.scope,
        amountLabel: formatAmount(row.amount_min, row.amount_max, row.amount_currency),
        deadlineLabel: formatDeadline(row.deadline_date, row.deadline_text),
        sourceUrl: row.source_url,
      });
    }
    return out;
  }

  async facets(): Promise<ScholarshipFacets> {
    const all = await getPublishedScholarships();
    const tally = new Map<string, number>();
    for (const s of all) {
      if (!s.country) continue;
      tally.set(s.country, (tally.get(s.country) ?? 0) + 1);
    }
    const countries = [...tally.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

    return { countries, total: all.length };
  }
}
