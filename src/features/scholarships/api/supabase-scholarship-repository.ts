import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/server/db/admin';
import { clampPage, clampPageSize, pageOffset, toPage, type Page } from '@/shared/lib';
import {
  getPublishedScholarships,
  SCHOLARSHIPS_REVALIDATE,
  SCHOLARSHIPS_SELECT,
  toDirectoryScholarship,
  type DirectoryScholarship,
  type ScholarshipRow,
} from '@/lib/scholarships-data';
import type { ScholarshipDegree, ScholarshipMajor } from '../domain/query-state';
import {
  SCHOLARSHIP_PAGE_SIZE_DEFAULT,
  SCHOLARSHIP_PAGE_SIZE_MAX,
  type HomeScholarshipHighlights,
  type ScholarshipFacets,
  type ScholarshipForUniversity,
  type ScholarshipLabel,
  type ScholarshipListQuery,
  type ScholarshipQueries,
} from './scholarship-queries';

const MAJOR_KEYWORDS: Record<Exclude<ScholarshipMajor, 'all'>, readonly string[]> = {
  business: ['business', 'economics', 'finance', 'management', 'marketing'],
  stem: ['engineering', 'computer', 'science', 'mathematics', 'technology'],
  arts: ['art', 'design', 'music', 'humanities'],
  health: ['health', 'medical', 'nursing', 'pharmacy'],
  law: ['law', 'legal'],
};
const DEGREE_KEYWORDS: Record<Exclude<ScholarshipDegree, 'all'>, readonly string[]> = {
  undergraduate: ['undergraduate', 'bachelor', 'high school', 'secondary school'],
  postgraduate: ['postgraduate', 'master', 'graduate', 'mba'],
  doctoral: ['doctoral', 'doctorate', 'phd'],
};
const SEARCH_COLUMNS = ['eligibility', 'applies_to_text', 'conditions', 'insight'] as const;
const HOME_HIGHLIGHT_DEFAULT = 6;
const HOME_HIGHLIGHT_MAX = 8;

function homeHighlightScore(scholarship: DirectoryScholarship): number {
  const ranking = scholarship.ranking_note?.toLowerCase() ?? '';
  const coverage = scholarship.coverage?.toLowerCase() ?? '';
  let score = 0;

  if (ranking.includes('most prestigious')) score += 120;
  else if (ranking.includes('top global')) score += 110;
  else if (ranking.includes('top')) score += 90;
  else if (ranking.includes('largest')) score += 80;
  else score += 50;

  if (coverage.includes('full ride')) score += 35;
  else if (coverage.includes('full tuition') || coverage.includes('100%')) score += 28;
  else if (coverage.includes('tuition')) score += 18;

  if (scholarship.universities.some((university) => Boolean(university.logo_url))) score += 30;
  if (scholarship.amountLabel) score += 12;
  return score;
}

function isOpenHomeHighlight(scholarship: DirectoryScholarship): boolean {
  const deadline = scholarship.deadline_text?.toLowerCase() ?? '';
  return !deadline.includes('expired') && !deadline.includes('closed') && !deadline.includes('hết hạn');
}

function selectHomeHighlights(
  candidates: DirectoryScholarship[],
  limit: number,
): DirectoryScholarship[] {
  const seenUniversities = new Set<number>();
  const seenScholarships = new Set<number>();
  const selected: DirectoryScholarship[] = [];

  const ranked = candidates
    .filter((scholarship) => isOpenHomeHighlight(scholarship))
    .filter((scholarship) => Boolean(scholarship.amountLabel || scholarship.coverage))
    .sort((left, right) => homeHighlightScore(right) - homeHighlightScore(left) || left.id - right.id);

  // The Home design promises a visible mark on every featured card. Prefer the
  // editorial candidates with linked university crests, then fill from the
  // remaining ranked set only when the database cannot supply enough of them.
  const logoBacked = ranked.filter((scholarship) =>
    scholarship.universities.some((university) => Boolean(university.logo_url)),
  );

  for (const scholarship of [...logoBacked, ...ranked]) {
    if (seenScholarships.has(scholarship.id)) continue;
    const universityId = scholarship.universityIds[0];
    if (universityId != null && seenUniversities.has(universityId)) continue;
    seenScholarships.add(scholarship.id);
    if (universityId != null) seenUniversities.add(universityId);
    selected.push(scholarship);
    if (selected.length === limit) break;
  }

  return selected;
}

async function linkedScholarshipIds(
  filter: { universityId?: number; universityName?: string; universityCountry?: string },
): Promise<number[]> {
  const admin = createAdminClient();
  let query = admin
    .from('scholarship_universities')
    .select(
      filter.universityName || filter.universityCountry
        ? 'scholarship_id, universities!inner(id)'
        : 'scholarship_id',
    );
  if (filter.universityId != null) query = query.eq('university_id', filter.universityId);
  if (filter.universityName) {
    query = query.ilike('universities.name', `%${filter.universityName}%`);
  }
  if (filter.universityCountry) {
    query = query.eq('universities.country', filter.universityCountry);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Scholarship links query failed: ${error.message}`);
  const rows = (data ?? []) as unknown as Array<{ scholarship_id: number }>;
  return [...new Set(rows.map((row) => Number(row.scholarship_id)).filter(Number.isFinite))];
}

async function countryScholarshipIds(country: string): Promise<number[]> {
  const { data, error } = await createAdminClient()
    .from('scholarships')
    .select('id')
    .eq('status', 'published')
    .eq('country', country);
  if (error) throw new Error(`Scholarship country query failed: ${error.message}`);
  return (data ?? []).map((row) => Number(row.id)).filter(Number.isFinite);
}

function intersect(left: number[] | null, right: number[]): number[] {
  if (left == null) return right;
  const allowed = new Set(right);
  return left.filter((id) => allowed.has(id));
}

function keywordFilter(keywords: readonly string[]): string {
  return keywords.flatMap((keyword) => SEARCH_COLUMNS.map((column) => `${column}.ilike.%${keyword}%`)).join(',');
}

async function listPublishedUncached(query: ScholarshipListQuery): Promise<Page<DirectoryScholarship>> {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(
    query.pageSize,
    SCHOLARSHIP_PAGE_SIZE_MAX,
    SCHOLARSHIP_PAGE_SIZE_DEFAULT,
  );

  const [universityIds, schoolIds, excludedIds, relatedLinks, relatedCountry] = await Promise.all([
    query.universityId != null
      ? linkedScholarshipIds({ universityId: query.universityId })
      : Promise.resolve(null),
    query.universitySearch
      ? linkedScholarshipIds({ universityName: query.universitySearch })
      : Promise.resolve(null),
    query.excludeUniversityId != null
      ? linkedScholarshipIds({ universityId: query.excludeUniversityId })
      : Promise.resolve([]),
    query.relatedUniversityCountry
      ? linkedScholarshipIds({ universityCountry: query.relatedUniversityCountry })
      : Promise.resolve([]),
    query.relatedUniversityCountry
      ? countryScholarshipIds(query.relatedUniversityCountry)
      : Promise.resolve([]),
  ]);

  let included: number[] | null = null;
  if (universityIds) included = intersect(included, universityIds);
  if (schoolIds) included = intersect(included, schoolIds);
  if (query.relatedUniversityCountry) {
    const excluded = new Set(excludedIds);
    included = intersect(
      included,
      [...new Set([...relatedLinks, ...relatedCountry])].filter((id) => !excluded.has(id)),
    );
  }
  if (included?.length === 0) return toPage([], 0, page, pageSize);

  const admin = createAdminClient();
  let databaseQuery = admin
    .from('scholarships')
    .select(SCHOLARSHIPS_SELECT, { count: 'exact' })
    .eq('status', 'published');
  if (query.search) databaseQuery = databaseQuery.ilike('name', `%${query.search}%`);
  if (query.country) databaseQuery = databaseQuery.eq('country', query.country);
  if (query.scope) databaseQuery = databaseQuery.eq('scope', query.scope);
  if (query.funding?.length) databaseQuery = databaseQuery.overlaps('funding_type', query.funding);
  if (included) databaseQuery = databaseQuery.in('id', included);
  if (excludedIds.length) databaseQuery = databaseQuery.not('id', 'in', `(${excludedIds.join(',')})`);
  if (query.major && query.major !== 'all') {
    databaseQuery = databaseQuery.or(keywordFilter(MAJOR_KEYWORDS[query.major]));
  }
  if (query.degree && query.degree !== 'all') {
    databaseQuery = databaseQuery.or(keywordFilter(DEGREE_KEYWORDS[query.degree]));
  }

  if (query.sort === 'deadline') {
    databaseQuery = databaseQuery.order('deadline_date', { ascending: true, nullsFirst: false });
  } else {
    databaseQuery = databaseQuery.order('name', { ascending: true });
  }
  databaseQuery = databaseQuery
    .order('id', { ascending: true })
    .range(pageOffset(page, pageSize), pageOffset(page, pageSize) + pageSize - 1);

  const { data, error, count } = await databaseQuery;
  if (error) throw new Error(`Scholarship list query failed: ${error.message}`);
  const items = ((data ?? []) as unknown as ScholarshipRow[]).map(toDirectoryScholarship);
  return toPage(items, count ?? items.length, page, pageSize);
}

const listPublishedCached = unstable_cache(
  listPublishedUncached,
  ['published-scholarship-page'],
  { revalidate: SCHOLARSHIPS_REVALIDATE, tags: ['scholarships'] },
);

const homeHighlightsCached = unstable_cache(
  async (requestedLimit: number): Promise<HomeScholarshipHighlights> => {
    const limit = clampPageSize(requestedLimit, HOME_HIGHLIGHT_MAX, HOME_HIGHLIGHT_DEFAULT);
    const candidateLimit = Math.max(32, limit * 6);
    const admin = createAdminClient();

    const [countResult, candidateResult] = await Promise.all([
      admin
        .from('scholarships')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published'),
      admin
        .from('scholarships')
        .select(SCHOLARSHIPS_SELECT)
        .eq('status', 'published')
        .not('ranking_note', 'is', null)
        .order('id', { ascending: true })
        .limit(candidateLimit),
    ]);

    if (countResult.error) {
      throw new Error(`Scholarship Home count failed: ${countResult.error.message}`);
    }
    if (candidateResult.error) {
      throw new Error(`Scholarship Home highlights failed: ${candidateResult.error.message}`);
    }

    const candidates = ((candidateResult.data ?? []) as unknown as ScholarshipRow[]).map(
      toDirectoryScholarship,
    );
    return {
      total: countResult.count ?? candidates.length,
      items: selectHomeHighlights(candidates, limit),
    };
  },
  ['home-scholarship-highlights'],
  { revalidate: SCHOLARSHIPS_REVALIDATE, tags: ['scholarships'] },
);

const facetsCached = unstable_cache(
  async (): Promise<ScholarshipFacets> => {
    const rows: Array<{ country: string | null; funding_type: string[] | null }> = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await createAdminClient()
        .from('scholarships')
        .select('country, funding_type')
        .eq('status', 'published')
        .order('id', { ascending: true })
        .range(from, from + 999);
      if (error) throw new Error(`Scholarship facets query failed: ${error.message}`);
      rows.push(...((data ?? []) as Array<{ country: string | null; funding_type: string[] | null }>));
      if ((data ?? []).length < 1000) break;
    }
    const tally = new Map<string, number>();
    for (const row of rows) {
      if (row.country) tally.set(row.country, (tally.get(row.country) ?? 0) + 1);
    }
    return {
      countries: [...tally.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
      total: rows.length,
    };
  },
  ['published-scholarship-facets'],
  { revalidate: SCHOLARSHIPS_REVALIDATE, tags: ['scholarships'] },
);

/**
 * Columns the "scholarships available here" strip on a university needs.
 *
 * `conditions`, `insight` and `applies_to_text` are here for the saved list's
 * scholarship detail panel (Figma 337:19349, "Chi tiết voucer"): it opens from a
 * row already on screen, so carrying three more text columns on this one join is
 * cheaper than a second round trip per scholarship the student opens.
 */
const FOR_UNIVERSITY_SELECT = `
  university_id,
  scholarships (
    id, name, scope, funding_type, coverage, eligibility,
    conditions, insight, applies_to_text,
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
    conditions: string | null;
    insight: string | null;
    applies_to_text: string | null;
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
 * Directory pages use ranged public queries; personalized joins remain direct
 * and outside that cache.
 */
export class SupabaseScholarshipRepository implements ScholarshipQueries {
  readonly name = 'supabase';

  async listPublished(query: ScholarshipListQuery): Promise<Page<DirectoryScholarship>> {
    return listPublishedCached({
      ...query,
      page: clampPage(query.page),
      pageSize: clampPageSize(
        query.pageSize,
        SCHOLARSHIP_PAGE_SIZE_MAX,
        SCHOLARSHIP_PAGE_SIZE_DEFAULT,
      ),
    });
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
        conditions: s.conditions,
        insight: s.insight,
        appliesToText: s.applies_to_text,
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

  async homeHighlights(limit = HOME_HIGHLIGHT_DEFAULT): Promise<HomeScholarshipHighlights> {
    return homeHighlightsCached(limit);
  }

  async facets(): Promise<ScholarshipFacets> {
    return facetsCached();
  }
}
