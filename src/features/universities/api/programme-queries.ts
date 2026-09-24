/**
 * Programme catalogue data port.
 *
 * Backs the "Chọn lại ngành" subject picker (Figma 375:13546), whose two lists
 * are schools over programmes — a `university → school → programme` tree.
 *
 * ⚠️ THIS TABLE WAS REPORTED AS NON-EXISTENT ON 2026-07-30, AND THAT WAS WRONG.
 * The check that produced it probed three guessed names (`programs`, `majors`,
 * `university_programs`), missed on all three, and concluded there was no
 * catalogue. There are 75 tables in this database and `catalog_programmes` is
 * one of them. **Enumerate, do not guess** — `GET /rest/v1/` returns PostgREST's
 * OpenAPI document, which lists every exposed table and its columns in one call.
 *
 * Coverage is partial and that is the design constraint, not a bug: 404
 * programmes across **24** of the 106 universities. Callers must keep a fallback
 * for the rest — see `programChoices` in the domain slice.
 */

/** One school/college/faculty, as denormalised onto a programme row. */
export interface ProgrammeAcademicUnit {
  name: string;
  /** "school", "college", "faculty", … — the crawler's own classification. */
  type: string | null;
  /** The unit that administers the programme, when several are attached. */
  isPrimary: boolean;
}

export interface CatalogueProgramme {
  id: string;
  universityId: number;
  name: string;
  /**
   * ⚠️ NOT NORMALISED IN THE DATABASE. The live distribution is `bachelor` 205,
   * `master` 169, `phd` 26, plus `Bachelor's` 3 and `Master's` 1 — two spellings
   * of the same two levels. Normalise at the edge (`degreeLabel`) rather than
   * printing it.
   */
  degreeLevel: string | null;
  /** "MA", "MS", "MBA", … Often null. */
  credential: string | null;
  /**
   * Free text where present ("3 years"), and **null on 400 of 404 rows** — so
   * the frame's "(4 năm)" renders for almost nothing. Do not default it.
   */
  duration: string | null;
  officialUrl: string | null;
  normalizedSubject: string | null;
  programmeStatus: string | null;
  verificationStatus: string | null;
  retrievedAt: string | null;
  units: ProgrammeAcademicUnit[];
}

/**
 * The subset of a programme that `rankUniversityRecommendations` reads.
 *
 * Deliberately a `Pick` rather than the full row: `/universities/matches` used
 * to load every column of all 593 rows, and `academic_units` alone is **192 kB
 * of the payload against 58 kB for everything ranking actually uses** (measured
 * with `pg_column_size`, 2026-09-05). Nothing downstream touches the units, the
 * credential, the duration or the programme status, so the port refuses to hand
 * them over on this path instead of trusting each caller to ignore them.
 */
export type MatchingProgramme = Pick<
  CatalogueProgramme,
  | 'id'
  | 'universityId'
  | 'name'
  | 'degreeLevel'
  | 'normalizedSubject'
  | 'officialUrl'
  | 'verificationStatus'
  | 'retrievedAt'
>;

export interface ProgrammeQueries {
  /** Every catalogued programme for one university, or [] when it has none. */
  byUniversityId(universityId: number): Promise<CatalogueProgramme[]>;

  /** Batch equivalent used by recommendation flows to avoid one query per university. */
  byUniversityIds(universityIds: number[]): Promise<Map<number, CatalogueProgramme[]>>;

  /**
   * Every catalogued programme, narrowed to the ranking fields.
   *
   * A flat array, not a `Map`, because the recommendation loader caches this
   * across users through `unstable_cache` and a `Map` does not survive that
   * serialisation. Grouping is the caller's job.
   */
  allForMatching(): Promise<MatchingProgramme[]>;
}

/**
 * A display label for `degree_level`, folding the two spellings together.
 *
 * Returns null for a value we do not recognise rather than echoing it: the
 * picker's secondary line is a translated string, and an unmapped value there
 * would be an untranslated one. Exported for the domain slice and its tests.
 */
export function degreeLabel(degreeLevel: string | null | undefined): string | null {
  switch ((degreeLevel ?? '').trim().toLowerCase().replace(/['’]s$/, '')) {
    case 'bachelor':
      return 'Bachelor';
    case 'master':
      return 'Master';
    case 'phd':
    case 'doctorate':
      return 'PhD';
    case 'diploma':
      return 'Diploma';
    default:
      return null;
  }
}

/**
 * Years, parsed out of the free-text `duration`.
 *
 * "3 years" -> 3. Returns null for anything else, including months and prose,
 * because the picker renders this as "N years" and converting "18 months" to
 * "1.5 years" would be inventing precision the source did not state.
 */
export function durationYears(duration: string | null | undefined): number | null {
  const match = /^\s*(\d+)\s*(year|yr)s?\s*$/i.exec(duration ?? '');
  if (!match?.[1]) return null;
  const years = Number.parseInt(match[1], 10);
  return Number.isFinite(years) && years > 0 && years <= 12 ? years : null;
}
