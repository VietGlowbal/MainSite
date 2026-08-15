/**
 * universities — data access (server-only).
 *
 * Exposes repository ports and their adapters. This is the ONLY slice in the
 * feature permitted to reach the database. Consumers import the port type, not
 * the adapter, so the implementation stays swappable (and fake-able in tests).
 */
import { SupabaseProgrammeRepository } from './supabase-programme-repository';
import { SupabaseUniversityRepository } from './supabase-university-repository';
import type { ProgrammeQueries } from './programme-queries';
import type { UniversityQueries } from './university-queries';

let cached: UniversityQueries | null = null;
let cachedProgrammes: ProgrammeQueries | null = null;

/**
 * The active university repository. Cached at module scope — the adapter is
 * stateless, but there is no reason to reconstruct it per call.
 *
 * Mirrors the factory in `src/lib/search-providers/index.ts`.
 */
export function getUniversityQueries(): UniversityQueries {
  cached ??= new SupabaseUniversityRepository();
  return cached;
}

/** Test seam: swap in a fake, or pass null to fall back to the real adapter. */
export function setUniversityQueries(impl: UniversityQueries | null): void {
  cached = impl;
}

/** The programme catalogue behind the subject picker. Same lifecycle as above. */
export function getProgrammeQueries(): ProgrammeQueries {
  cachedProgrammes ??= new SupabaseProgrammeRepository();
  return cachedProgrammes;
}

/** Test seam, mirroring `setUniversityQueries`. */
export function setProgrammeQueries(impl: ProgrammeQueries | null): void {
  cachedProgrammes = impl;
}

export { SupabaseUniversityRepository };
export { SupabaseProgrammeRepository };
export { degreeLabel, durationYears } from './programme-queries';
export type {
  CatalogueProgramme,
  ProgrammeAcademicUnit,
  ProgrammeQueries,
} from './programme-queries';
export { AUTO_PARSE_SOURCE, resolveUniversity } from './university-resolver';
export type { ResolveInput, ResolveOutcome } from './university-resolver';
export {
  UNIVERSITY_LIST_COLUMNS,
  UNIVERSITY_PAGE_SIZE_DEFAULT,
  UNIVERSITY_PAGE_SIZE_MAX,
  clampPage,
  clampPageSize,
  toPage,
} from './university-queries';
export type {
  Page,
  UniversityDetail,
  UniversityFacets,
  UniversityListColumn,
  UniversityListItem,
  UniversityListQuery,
  UniversityQueries,
} from './university-queries';
export { loadRankedUniversityMatches } from './university-matching-loader';
