import { createAdminClient } from '@/server/db/admin';
import {
  degreeLabel,
  durationYears,
  type CatalogueProgramme,
  type ProgrammeAcademicUnit,
  type ProgrammeQueries,
} from './programme-queries';

/** The denormalised JSON `catalog_programmes.academic_units` actually holds. */
type RawUnit = {
  name?: unknown;
  type?: unknown;
  is_primary?: unknown;
};

type RawRow = {
  programme_id: string;
  university_id: number | null;
  programme_name: string | null;
  degree_level: string | null;
  credential: string | null;
  duration: string | null;
  official_url: string | null;
  verification_status: string | null;
  academic_units: unknown;
};

/**
 * The one verification state that must never be offered as a choice.
 *
 * ⚠️ NOT `NEEDS_REVIEW`. That is the DEFAULT state of crawler output that has
 * not been through a rule validator — 390 of the 404 live rows carry it — and it
 * does not mean "we think this is wrong". Filtering on it would leave the
 * catalogue path working for exactly one university (Penn, the only holder of
 * the 10 `RULE_VALIDATED` rows), which is deleting the feature rather than
 * hedging it. `REJECTED` is the flag that means the pipeline decided against a
 * row; it appears 58 times elsewhere in the crawl tables and zero times here, so
 * this is insurance, not a filter that currently removes anything.
 */
const REJECTED = 'REJECTED';

/**
 * Supabase-backed {@link ProgrammeQueries}.
 *
 * Service-role client, same reasoning as the university repository:
 * `catalog_programmes` is public reference data with no per-user rows. (It is
 * readable by `anon` and `authenticated` too — checked, because a policy granted
 * only `to authenticated` is how the mentor directory shipped silently empty.
 * Using the admin client here means the picker cannot regress that way if a
 * policy is tightened later.)
 */
export class SupabaseProgrammeRepository implements ProgrammeQueries {
  readonly name = 'supabase';

  async byUniversityId(universityId: number): Promise<CatalogueProgramme[]> {
    if (!Number.isFinite(universityId)) return [];

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('catalog_programmes')
      .select(
        'programme_id, university_id, programme_name, degree_level, credential, duration, official_url, verification_status, academic_units',
      )
      .eq('university_id', universityId)
      .order('programme_name', { ascending: true });

    if (error) {
      // Logged rather than thrown: an empty catalogue is a legitimate answer for
      // 82 of the 106 universities, so the caller already handles []. Without the
      // log, a broken read would be indistinguishable from that.
      console.error('ProgrammeRepository.byUniversityId failed:', error.message);
      return [];
    }

    return (data ?? [])
      .map((row) => toProgramme(row as RawRow))
      .filter((programme): programme is CatalogueProgramme => programme !== null);
  }
}

function toProgramme(row: RawRow): CatalogueProgramme | null {
  const name = row.programme_name?.trim();
  // A nameless programme cannot be offered as a choice.
  if (!name || row.university_id == null) return null;
  /*
   * Filtered here rather than with `.neq()` in the query, because `neq` is not
   * null-safe in SQL: `NULL != 'REJECTED'` is NULL, not true, so it would also
   * drop the 4 rows whose status is unset. A comparison in JS treats null as
   * "not rejected", which is the intent.
   */
  if (row.verification_status === REJECTED) return null;

  return {
    id: row.programme_id,
    universityId: row.university_id,
    name,
    degreeLevel: row.degree_level,
    credential: row.credential,
    duration: row.duration,
    officialUrl: row.official_url,
    units: toUnits(row.academic_units),
  };
}

function toUnits(raw: unknown): ProgrammeAcademicUnit[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const unit = entry as RawUnit;
    const name = typeof unit.name === 'string' ? unit.name.trim() : '';
    if (!name) return [];
    return [
      {
        name,
        type: typeof unit.type === 'string' ? unit.type : null,
        isPrimary: unit.is_primary === true,
      },
    ];
  });
}

export { degreeLabel, durationYears };
