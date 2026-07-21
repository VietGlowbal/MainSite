import type { DirectoryScholarship, ScholarshipUniversityLite } from '@/lib/scholarships-data';
import type { Page } from '@/shared/lib';

export type { Page };

/**
 * Scholarship data port.
 *
 * The method that matters here is {@link ScholarshipQueries.byUniversityIds}.
 * Today `/universities` calls `getPublishedScholarships()`, which pages
 * 1,000-at-a-time through 2,877+ published rows with a nested
 * `scholarship_universities -> universities` join (3+ round trips on a cache
 * miss), purely so the page can build a Map and hang a scholarship array off
 * *every* university. `byUniversityIds` inverts that into one query scoped to
 * the universities actually on screen.
 */

/** The slim shape a university detail view needs. Mirrors `UniversityScholarship`. */
export interface ScholarshipForUniversity {
  id: number;
  name: string;
  scope: DirectoryScholarship['scope'];
  fundingType: string[];
  amountLabel: string | null;
  amountMin: number | null;
  amountMax: number | null;
  amountCurrency: string | null;
  coverage: string | null;
  eligibility: string | null;
  deadlineLabel: string | null;
  sourceUrl: string | null;
}

export interface ScholarshipListQuery {
  page: number;
  pageSize: number;
  /** Free-text match against the scholarship name. */
  search?: string;
  /** Country of the awarding body. */
  country?: string;
  scope?: DirectoryScholarship['scope'];
}

export const SCHOLARSHIP_PAGE_SIZE_DEFAULT = 24;
export const SCHOLARSHIP_PAGE_SIZE_MAX = 100;

export interface ScholarshipFacets {
  countries: Array<{ value: string; count: number }>;
  total: number;
}

export interface ScholarshipQueries {
  /** Adapter name, e.g. "supabase". */
  readonly name: string;

  listPublished(query: ScholarshipListQuery): Promise<Page<DirectoryScholarship>>;

  /**
   * Scholarships linked to the given universities, keyed by university id.
   *
   * Returns a Map so the caller can attach results to a page of universities
   * without an O(n*m) scan. Universities with no linked scholarship are absent
   * from the Map rather than present with an empty array.
   */
  byUniversityIds(ids: number[]): Promise<Map<number, ScholarshipForUniversity[]>>;

  getById(id: number): Promise<DirectoryScholarship | null>;

  facets(): Promise<ScholarshipFacets>;
}

export type { DirectoryScholarship, ScholarshipUniversityLite };
