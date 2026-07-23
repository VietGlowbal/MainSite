/**
 * scholarships — data access (server-only).
 *
 * Exposes repository ports and their adapters. This is the ONLY slice in the
 * feature permitted to reach the database. Consumers import the port type, not
 * the adapter, so the implementation stays swappable (and fake-able in tests).
 */
import { SupabaseScholarshipRepository } from './supabase-scholarship-repository';
import type { ScholarshipQueries } from './scholarship-queries';

let cached: ScholarshipQueries | null = null;

/** The active scholarship repository. */
export function getScholarshipQueries(): ScholarshipQueries {
  cached ??= new SupabaseScholarshipRepository();
  return cached;
}

/** Test seam: swap in a fake, or pass null to fall back to the real adapter. */
export function setScholarshipQueries(impl: ScholarshipQueries | null): void {
  cached = impl;
}

export { SupabaseScholarshipRepository };
export {
  SCHOLARSHIP_PAGE_SIZE_DEFAULT,
  SCHOLARSHIP_PAGE_SIZE_MAX,
} from './scholarship-queries';
export type {
  DirectoryScholarship,
  Page,
  ScholarshipFacets,
  ScholarshipForUniversity,
  ScholarshipLabel,
  ScholarshipListQuery,
  ScholarshipQueries,
  ScholarshipUniversityLite,
} from './scholarship-queries';
