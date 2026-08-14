import { createAdminClient } from '@/server/db/admin';
import {
  degreeLabel,
  durationYears,
  type CatalogueProgramme,
  type CatalogueFieldValue,
  type CatalogueProgrammeMatchingRecord,
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
  source_programme_id: string | null;
  normalized_field: string | null;
};

type RawCourse = {
  source_programme_id: string | null;
  tuition_fee_min: number | null;
  tuition_currency: string | null;
  tuition_fee_text: string | null;
  entry_requirements_summary: string | null;
  english_requirements_summary: string | null;
  source_confidence: number | null;
  verification_status: string | null;
};

type RawFieldValue = {
  id: string;
  course_id: string;
  field_name: string;
  value_json: unknown;
  null_reason: string | null;
  source_url: string | null;
  source_type: string | null;
  evidence: string | null;
  evidence_locator: string | null;
  scope: string | null;
  audience: string | null;
  academic_cycle: string | null;
  retrieved_at: string;
  confidence: number;
  verification_status: string;
  display_mode: string;
  use_for_eligibility: boolean;
  validation_errors: string[] | null;
};

const MATCHING_FIELD_NAMES = [
  'minimum_degree',
  'minimum_gpa',
  'gpa_scale',
  'subject_prerequisites',
  'admission_difficulty',
  'ielts_overall',
  'ielts_subscores',
  'toefl',
  'duolingo',
  'standardized_tests',
  'tuition',
] as const;

const NORMALIZED_FIELD_SELECT =
  'id, course_id, field_name, value_json, null_reason, source_url, source_type, evidence, evidence_locator, scope, audience, academic_cycle, retrieved_at, confidence, verification_status, display_mode, use_for_eligibility, validation_errors';

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

  async allForMatching(): Promise<CatalogueProgrammeMatchingRecord[]> {
    const admin = createAdminClient();
    const [programmesResult, coursesResult, currentFactsResult, factsResult] = await Promise.all([
      admin.from('catalog_programmes').select(
        'programme_id, university_id, programme_name, degree_level, credential, duration, official_url, verification_status, academic_units, source_programme_id, normalized_field',
      ),
      admin.from('courses').select(
        'source_programme_id, tuition_fee_min, tuition_currency, tuition_fee_text, entry_requirements_summary, english_requirements_summary, source_confidence, verification_status',
      ),
      admin.from('course_current_field_values').select(NORMALIZED_FIELD_SELECT).in('field_name', [...MATCHING_FIELD_NAMES]),
      admin.from('course_field_values').select(NORMALIZED_FIELD_SELECT).in('field_name', [...MATCHING_FIELD_NAMES]),
    ]);
    if (programmesResult.error || coursesResult.error) {
      console.error('ProgrammeRepository.allForMatching failed:', programmesResult.error?.message ?? coursesResult.error?.message);
      return [];
    }
    const coursesBySource = new Map<string, RawCourse>();
    for (const row of (coursesResult.data ?? []) as RawCourse[]) {
      if (row.source_programme_id) coursesBySource.set(row.source_programme_id, row);
    }
    const normalizedFactsByCourse = new Map<string, CatalogueFieldValue[]>();
    // The current view is the normal read path. The base table is merged as a
    // compatibility path for cycle/audience-specific facts that the view's
    // DISTINCT key cannot retain. The loader selects the applicable fact and
    // applies the verification contract at the adapter boundary.
    const factRows = [
      ...((currentFactsResult.data ?? []) as RawFieldValue[]),
      ...((factsResult.data ?? []) as RawFieldValue[]),
    ];
    for (const row of factRows) {
      if (!row.course_id || !MATCHING_FIELD_NAMES.includes(row.field_name as (typeof MATCHING_FIELD_NAMES)[number])) continue;
      const fact: CatalogueFieldValue = {
        id: row.id,
        courseId: row.course_id,
        fieldName: row.field_name,
        valueJson: row.value_json,
        nullReason: row.null_reason,
        sourceUrl: row.source_url,
        sourceType: row.source_type,
        evidence: row.evidence,
        evidenceLocator: row.evidence_locator,
        scope: row.scope,
        audience: row.audience,
        academicCycle: row.academic_cycle,
        retrievedAt: row.retrieved_at,
        confidence: row.confidence,
        verificationStatus: row.verification_status,
        displayMode: row.display_mode,
        useForEligibility: row.use_for_eligibility,
        validationErrors: row.validation_errors ?? [],
      };
      const facts = normalizedFactsByCourse.get(row.course_id) ?? [];
      facts.push(fact);
      normalizedFactsByCourse.set(row.course_id, facts);
    }
    return (programmesResult.data ?? []).flatMap((row) => {
      const programme = toProgramme(row as RawRow);
      if (!programme) return [];
      const raw = row as RawRow;
      const course = raw.source_programme_id ? coursesBySource.get(raw.source_programme_id) ?? null : null;
      return [{
        ...programme,
        sourceProgrammeId: raw.source_programme_id,
        normalizedField: raw.normalized_field,
        normalizedFacts: normalizedFactsByCourse.get(raw.programme_id) ?? [],
        course: course ? {
          tuitionFeeMin: course.tuition_fee_min,
          tuitionCurrency: course.tuition_currency,
          tuitionFeeText: course.tuition_fee_text,
          entryRequirementsSummary: course.entry_requirements_summary,
          englishRequirementsSummary: course.english_requirements_summary,
          sourceConfidence: course.source_confidence,
          verificationStatus: course.verification_status,
        } : null,
      }];
    });
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
