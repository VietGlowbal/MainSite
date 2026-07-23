import type { University } from '@/lib/types';
import {
  clampPage,
  clampPageSize as clampSize,
  toPage,
  type Page,
} from '@/shared/lib';

export { clampPage, toPage };
export type { Page };

/**
 * University data port.
 *
 * Modelled on `src/lib/search-providers/search-provider-interface.ts`, the one
 * port/adapter boundary that already existed in this codebase: a named
 * interface returning normalized types, with the concrete adapter behind a
 * factory.
 *
 * Contract:
 *  - Returns normalized domain types, never a raw Supabase row.
 *  - Every list method is paginated. There is deliberately no `getAll()` —
 *    the page that used one is the reason `/universities` is slow.
 *  - Implementations must not import from `@/app` or another feature.
 */

/**
 * Default page size. Matches the 3x3 grid in the redesign's "Page trường"
 * frame, which ships a `Pagination` component — server-side paging is what the
 * new design expects, not an accident of implementation.
 */
export const UNIVERSITY_PAGE_SIZE_DEFAULT = 9;

/** Upper bound so a hand-crafted query string cannot ask for the whole table. */
export const UNIVERSITY_PAGE_SIZE_MAX = 60;

export interface UniversityListQuery {
  /** 1-based; values below 1 are clamped. */
  page: number;
  /** Clamped to [1, UNIVERSITY_PAGE_SIZE_MAX]. */
  pageSize: number;
  countries?: string[];
  /** Free-text match against the university name. */
  search?: string;
  /**
   * Match-based ordering is per-user and cannot be expressed in SQL here, so it
   * is applied by the caller after scoring. This port only offers orderings the
   * database can do.
   */
  sort?: 'rank' | 'name';
}

/**
 * Columns the list view actually consumes.
 *
 * This is a real projection but a modest one: 28 of the 33 columns are read
 * somewhere between `computeMatchResult`, `classifyAdmissionFit`,
 * `toExplorerUniversity` and the card components. Excluded are `arwu_rank`,
 * `national_rank`, `special_test`, `weaknesses` and `images_resolved_at`,
 * which only the CSV importer and the imagery cron touch.
 *
 * Do not expect the projection to be the performance win — pagination is.
 * Dropping five mostly-null columns is worth ~15% of the row, whereas today's
 * page ships every row in the table.
 */
export const UNIVERSITY_LIST_COLUMNS = [
  'id',
  'name',
  'local_name',
  'country',
  'type',
  'qs_rank',
  'the_rank',
  'strengths',
  'specific_insight',
  'teaching_style',
  'international_environment',
  'gpa_range',
  'english_requirement',
  'standardized_test',
  'admission_difficulty',
  'accept_rate',
  'application_deadline',
  'scholarship',
  'tuition_usd',
  'living_cost_usd',
  'housing',
  'industry_connections',
  'internship_coop',
  'employability',
  'best_for',
  'notes',
  'image_url',
  'logo_url',
] as const;

export type UniversityListColumn = (typeof UNIVERSITY_LIST_COLUMNS)[number];

/** A university as the list/grid needs it. */
export type UniversityListItem = Pick<University, UniversityListColumn>;

/** The full row — only ever fetched one at a time, for the detail view. */
export type UniversityDetail = University;

/** Filter-chip counts, computed in the database rather than over a full payload. */
export interface UniversityFacets {
  countries: Array<{ value: string; count: number }>;
  total: number;
}

export interface UniversityQueries {
  /** Adapter name, e.g. "supabase". Mirrors `SearchProvider.name`. */
  readonly name: string;

  list(query: UniversityListQuery): Promise<Page<UniversityListItem>>;

  getById(id: number): Promise<UniversityDetail | null>;

  /** Hydrate a shortlist without re-fetching the world. */
  getByIds(ids: number[]): Promise<UniversityListItem[]>;

  facets(): Promise<UniversityFacets>;

  /**
   * Every university in one query, rank-ordered.
   *
   * @deprecated Exists solely so `/universities` keeps rendering unchanged
   * while it still filters, sorts and paginates on the client. It is named
   * rather than hidden so the remaining whole-table read is greppable and has
   * exactly one call site to delete.
   *
   * Do not add callers. Paging through `list()` instead would be worse, not
   * better: it would turn today's single round trip into dozens. The fix is
   * for the caller to stop needing every row — that is Track A's job.
   */
  listAllForLegacyExplorer(): Promise<UniversityListItem[]>;
}

/** Clamp a caller-supplied page size into this feature's allowed range. */
export function clampPageSize(pageSize: number): number {
  return clampSize(pageSize, UNIVERSITY_PAGE_SIZE_MAX, UNIVERSITY_PAGE_SIZE_DEFAULT);
}
