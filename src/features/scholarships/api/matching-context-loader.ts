import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeScholarshipBenefits } from '../domain/benefit-normalization';
import type {
  AcademicAchievementSource,
  AcademicActivitySource,
  EnglishTestSource,
  MatchingAcademicEvidence,
  MatchingApplicationSource,
  MatchingContextRequest,
  MatchingContextSources,
  MatchingProgrammeSource,
  MatchingProfileSource,
  MatchingProvenance,
  MatchingRead,
  MatchingScholarshipSource,
  MatchingSourceKind,
  MatchingUniversitySource,
  SavedUniversitySource,
  StandardizedTestSource,
  ScholarshipMatchingContext,
} from '../domain/matching-context';
import {
  buildScholarshipMatchingContext,
  type MatchingContextDiagnostic,
} from '../domain/matching-context';
import type { BenefitAmount } from '../domain/benefit-types';
import type { DurationValue } from '../domain/duration';
import type { ValuationPeriod } from '../domain/valuation';
import { isSupportedCurrency } from '../domain/currency';
import { buildScholarshipValuationContexts } from '../domain/valuation-context';
import { canonicalizeExternalUrl } from '@/shared/lib/external-url';

const PROFILE_SELECT = `
  id, profile_version, nationality, preferred_countries, target_subjects,
  study_level, budget_range, tuition_budget_usd, funding_source,
  target_intake, application_cycle_year, preferred_cities, study_mode_preference,
  academic_background, current_qualification, grades_summary,
  curriculum_grades, gpa_scale, gpa_value, predicted_grades,
  postgraduate_academic, phd_academic, career_interests, campus_preferences
`;

const APPLICATION_SELECT = `
  id, course_id, university_id, university_name, course_name, course_url,
  degree_level, subject, study_mode, intake, country, deadline, status,
  created_at, updated_at
`;

const COURSE_SELECT = `
  id, university_id, university_name, course_name, degree_level, subject,
  study_mode, intake, country, city, duration, tuition_fee_text,
  tuition_fee_min, tuition_fee_max, tuition_currency, official_url,
  source_confidence, extraction_status, last_extracted_at
`;

const UNIVERSITY_SELECT = `
  id, name, country, city, type, tuition_usd, living_cost_usd, housing
`;

const SCHOLARSHIP_SELECT = `
  id, name, scope, country, provider, funding_type, coverage,
  amount_min, amount_max, amount_currency,
  eligibility, applies_to_text, conditions, deadline_date, deadline_text,
  source_url, source_lang, ranking_note, raw, source_key, updated_at,
  scholarship_universities (
    university_id,
    universities ( id, name, country, city )
  )
`;

type UnknownRecord = Record<string, unknown>;
type QueryResult = { data: unknown; error: { message: string } | null };

export type ScholarshipMatchingContextRepository = {
  readProfile: (userId: string) => Promise<MatchingRead<MatchingProfileSource>>;
  readEvidence: (userId: string) => Promise<MatchingRead<MatchingAcademicEvidence>>;
  readSavedUniversities: (userId: string) => Promise<MatchingRead<readonly SavedUniversitySource[]>>;
  readApplications: (args: {
    userId: string;
    applicationId: string | null;
    selectedProgrammeId: string | null;
  }) => Promise<MatchingRead<readonly MatchingApplicationSource[]>>;
  readProgrammes: (ids: readonly string[]) => Promise<MatchingRead<readonly MatchingProgrammeSource[]>>;
  readUniversities: (ids: readonly number[]) => Promise<MatchingRead<readonly MatchingUniversitySource[]>>;
  readScholarships: (ids: readonly number[]) => Promise<MatchingRead<readonly MatchingScholarshipSource[]>>;
};

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function stringValue(row: UnknownRecord, key: string): string | null {
  const value = row[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function scalarStringValue(row: UnknownRecord, key: string): string | null {
  const value = row[key];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
}

function numberValue(row: UnknownRecord, key: string): number | null {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function stringList(row: UnknownRecord, key: string): readonly string[] | null {
  const value = row[key];
  if (!Array.isArray(value)) return null;
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function nestedRecord(row: UnknownRecord, key: string): UnknownRecord | null {
  const value = row[key];
  if (Array.isArray(value)) return record(value[0]);
  return record(value);
}

function asRows(value: unknown): UnknownRecord[] {
  return Array.isArray(value)
    ? value.map(record).filter((row): row is UnknownRecord => row !== null)
    : [];
}

function provenance(
  sourceKind: MatchingSourceKind,
  recordId: string | null,
  sourceUrl: string | null = null,
  sourceField: string | null = null,
  retrievedAt: string | null = null,
): MatchingProvenance {
  return { sourceKind, recordId, sourceUrl, sourceField, retrievedAt };
}

function readPresent<T>(value: T): MatchingRead<T> {
  return { value, status: 'present', message: null };
}

function readMissing<T>(value: T): MatchingRead<T> {
  return { value, status: 'missing', message: null };
}

async function readOne<T>(
  label: string,
  query: PromiseLike<QueryResult>,
  map: (value: unknown) => T | null,
): Promise<MatchingRead<T>> {
  try {
    const result = await query;
    if (result.error) {
      console.error(`[scholarship-matching] ${label} failed:`, result.error.message);
      return { value: null, status: 'unavailable', message: result.error.message };
    }
    const value = map(result.data);
    return value === null
      ? { value: null, status: 'missing', message: null }
      : readPresent(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown data source error.';
    console.error(`[scholarship-matching] ${label} failed:`, message);
    return { value: null, status: 'unavailable', message };
  }
}

async function readMany<T>(
  label: string,
  query: PromiseLike<QueryResult>,
  map: (row: UnknownRecord, index: number) => T | null,
): Promise<MatchingRead<readonly T[]>> {
  try {
    const result = await query;
    if (result.error) {
      console.error(`[scholarship-matching] ${label} failed:`, result.error.message);
      return { value: null, status: 'unavailable', message: result.error.message };
    }
    const rows = asRows(result.data);
    const values = rows
      .map(map)
      .filter((value): value is T => value !== null);
    return values.length > 0 ? readPresent(values) : readMissing([]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown data source error.';
    console.error(`[scholarship-matching] ${label} failed:`, message);
    return { value: null, status: 'unavailable', message };
  }
}

function parseDuration(text: string | null): DurationValue | null {
  if (!text) return null;
  const match = /^\s*(\d+(?:\.\d+)?)\s*(months?|years?|terms?)\s*$/i.exec(text);
  if (!match?.[1] || !match[2]) return null;
  const count = Number(match[1]);
  if (!Number.isFinite(count) || count <= 0) return null;
  const unit = /^month/i.test(match[2])
    ? 'month'
    : /^term/i.test(match[2])
      ? 'term'
      : 'year';
  return { count, unit, rawText: text.trim() };
}

function tuitionAmount(row: UnknownRecord): BenefitAmount | null {
  const minValue = numberValue(row, 'tuition_fee_min');
  const maxValue = numberValue(row, 'tuition_fee_max');
  if (minValue == null && maxValue == null) return null;
  const min = minValue ?? maxValue!;
  if (min < 0) return null;
  const max = maxValue != null && maxValue !== min ? maxValue : null;
  if (max != null && (max < min || max < 0)) return null;
  const rawCurrency = stringValue(row, 'tuition_currency');
  const currency = rawCurrency?.toUpperCase() ?? null;
  return {
    min,
    max,
    currency,
    currencyStatus: currency && isSupportedCurrency(currency) ? 'known' : 'unknown',
  };
}

function tuitionPeriod(text: string | null): ValuationPeriod {
  const value = text?.toLowerCase() ?? '';
  if (/one[- ]?(?:time|off)|lump\s*sum|single\s*payment/.test(value)) return 'one-time';
  if (/\/\s*month|per\s+month|monthly/.test(value)) return 'monthly';
  if (/\/\s*year|per\s+year|annual|yearly/.test(value)) return 'annual';
  return 'unspecified';
}

function universityFromRow(row: UnknownRecord): MatchingUniversitySource | null {
  const id = numberValue(row, 'id');
  if (id == null) return null;
  return {
    id,
    name: stringValue(row, 'name'),
    country: stringValue(row, 'country'),
    city: stringValue(row, 'city'),
    type: stringValue(row, 'type'),
    tuitionText: stringValue(row, 'tuition_usd'),
    livingCostText: stringValue(row, 'living_cost_usd'),
    housingText: stringValue(row, 'housing'),
    source: provenance('university', String(id), null, null, null),
  };
}

function profileFromRow(row: UnknownRecord): MatchingProfileSource {
  const id = scalarStringValue(row, 'id');
  return {
    id,
    profileVersion: scalarStringValue(row, 'profile_version'),
    nationality: stringValue(row, 'nationality'),
    preferredCountries: stringList(row, 'preferred_countries'),
    targetSubjects: stringList(row, 'target_subjects'),
    studyLevel: stringValue(row, 'study_level'),
    budgetRange: stringValue(row, 'budget_range'),
    tuitionBudgetUsd: stringValue(row, 'tuition_budget_usd'),
    fundingPreference: stringValue(row, 'funding_source'),
    targetIntake: stringValue(row, 'target_intake'),
    applicationCycleYear: numberValue(row, 'application_cycle_year'),
    preferredCities: stringList(row, 'preferred_cities'),
    studyMode: stringValue(row, 'study_mode_preference'),
    academicBackground: stringValue(row, 'academic_background'),
    currentQualification: stringValue(row, 'current_qualification'),
    gradesSummary: row['grades_summary'] ?? null,
    curriculumGrades: row['curriculum_grades'] ?? null,
    gpaScale: stringValue(row, 'gpa_scale'),
    gpaValue: numberValue(row, 'gpa_value'),
    predictedGrades: stringValue(row, 'predicted_grades'),
    postgraduateAcademic: row['postgraduate_academic'] ?? null,
    phdAcademic: row['phd_academic'] ?? null,
    careerInterests: stringList(row, 'career_interests'),
    campusPreferences: stringValue(row, 'campus_preferences'),
    source: provenance('student-profile', id),
  };
}

function evidenceFromRows(rows: readonly UnknownRecord[]): MatchingAcademicEvidence {
  const achievements: AcademicAchievementSource[] = [];
  const activities: AcademicActivitySource[] = [];
  const englishTests: EnglishTestSource[] = [];
  const standardizedTests: StandardizedTestSource[] = [];

  for (const [index, row] of rows.entries()) {
    const kind = stringValue(row, '__kind');
    const id = scalarStringValue(row, 'id') ?? `${kind ?? 'evidence'}:${index}`;
    if (kind === 'achievement') {
      achievements.push({
        id,
        title: stringValue(row, 'title') ?? '',
        category: stringValue(row, 'category'),
        level: stringValue(row, 'level'),
        year: stringValue(row, 'year') ?? (numberValue(row, 'year')?.toString() ?? null),
        detail: stringValue(row, 'detail'),
        source: provenance('student-achievement', id),
      });
    } else if (kind === 'activity') {
      activities.push({
        id,
        title: stringValue(row, 'title') ?? '',
        category: stringValue(row, 'category'),
        level: stringValue(row, 'level'),
        period: stringValue(row, 'period'),
        description: stringValue(row, 'description'),
        source: provenance('student-activity', id),
      });
    } else if (kind === 'english') {
      englishTests.push({
        id,
        testType: stringValue(row, 'test_type') ?? '',
        overallScore: numberValue(row, 'overall_score'),
        source: provenance('english-test', id),
      });
    } else if (kind === 'standardized') {
      standardizedTests.push({
        id,
        testType: stringValue(row, 'test_type') ?? '',
        score: stringValue(row, 'score'),
        source: provenance('standardized-test', id),
      });
    }
  }

  return { achievements, activities, englishTests, standardizedTests };
}

function savedUniversityFromRow(row: UnknownRecord): SavedUniversitySource | null {
  const universityId = numberValue(row, 'university_id');
  if (universityId == null) return null;
  const universityRow = nestedRecord(row, 'universities');
  return {
    id: scalarStringValue(row, 'id'),
    universityId,
    status: stringValue(row, 'status'),
    addedAt: stringValue(row, 'added_at'),
    updatedAt: stringValue(row, 'updated_at'),
    university: universityRow ? universityFromRow(universityRow) : null,
    source: provenance('saved-university', stringValue(row, 'id')),
  };
}

function applicationFromRow(row: UnknownRecord): MatchingApplicationSource | null {
  const id = stringValue(row, 'id');
  if (!id) return null;
  return {
    id,
    courseId: stringValue(row, 'course_id'),
    universityId: numberValue(row, 'university_id'),
    universityName: stringValue(row, 'university_name'),
    courseName: stringValue(row, 'course_name'),
    courseUrl: stringValue(row, 'course_url'),
    degreeLevel: stringValue(row, 'degree_level'),
    subject: stringValue(row, 'subject'),
    studyMode: stringValue(row, 'study_mode'),
    intake: stringValue(row, 'intake'),
    country: stringValue(row, 'country'),
    deadline: stringValue(row, 'deadline'),
    status: stringValue(row, 'status'),
    createdAt: stringValue(row, 'created_at'),
    updatedAt: stringValue(row, 'updated_at'),
    source: provenance('application', id, stringValue(row, 'course_url')),
  };
}

function programmeFromRow(row: UnknownRecord): MatchingProgrammeSource | null {
  const id = stringValue(row, 'id');
  if (!id) return null;
  const tuitionText = stringValue(row, 'tuition_fee_text');
  return {
    id,
    universityId: numberValue(row, 'university_id'),
    universityName: stringValue(row, 'university_name'),
    name: stringValue(row, 'course_name'),
    degreeLevel: stringValue(row, 'degree_level'),
    subject: stringValue(row, 'subject'),
    studyMode: stringValue(row, 'study_mode'),
    intake: stringValue(row, 'intake'),
    country: stringValue(row, 'country'),
    city: stringValue(row, 'city'),
    durationText: stringValue(row, 'duration'),
    duration: parseDuration(stringValue(row, 'duration')),
    tuitionText,
    tuitionAmount: tuitionAmount(row),
    tuitionPeriod: tuitionPeriod(tuitionText),
    source: provenance('programme', id, stringValue(row, 'official_url'), 'course', stringValue(row, 'last_extracted_at')),
  };
}

function scholarshipFromRow(row: UnknownRecord): MatchingScholarshipSource | null {
  const id = numberValue(row, 'id');
  const name = stringValue(row, 'name');
  if (id == null || !name) return null;
  const sourceUrl = canonicalizeExternalUrl(stringValue(row, 'source_url'));
  const fundingType = stringList(row, 'funding_type') ?? [];
  const linkedRows = asRows(row['scholarship_universities']);
  const universityIds = linkedRows
    .map((link) => numberValue(link, 'university_id'))
    .filter((value): value is number => value != null);
  const universityCountries = linkedRows
    .map((link) => stringValue(nestedRecord(link, 'universities') ?? {}, 'country'))
    .filter((value): value is string => value !== null);
  const valuationUniversities = linkedRows
    .map((link) => {
      const university = nestedRecord(link, 'universities');
      const universityId = numberValue(link, 'university_id');
      if (universityId == null) return null;
      return {
        id: universityId,
        name: stringValue(university ?? {}, 'name'),
        country: stringValue(university ?? {}, 'country'),
        city: stringValue(university ?? {}, 'city'),
        sourceUrl: null,
        retrievedAt: stringValue(row, 'updated_at'),
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);
  const raw = record(row['raw']) ?? {};
  const rawFields: Record<string, unknown> = {
    ...raw,
    id,
    name,
    coverage: stringValue(row, 'coverage'),
    amount_min: numberValue(row, 'amount_min'),
    amount_max: numberValue(row, 'amount_max'),
    amount_currency: stringValue(row, 'amount_currency'),
    funding_type: fundingType,
    source_url: sourceUrl,
  };

  return {
    id,
    name,
    scope: stringValue(row, 'scope') ?? 'provider',
    country: stringValue(row, 'country'),
    provider: stringValue(row, 'provider'),
    fundingType,
    coverage: stringValue(row, 'coverage'),
    eligibility: stringValue(row, 'eligibility'),
    appliesToText: stringValue(row, 'applies_to_text'),
    conditions: stringValue(row, 'conditions'),
    deadline: stringValue(row, 'deadline_date') ?? stringValue(row, 'deadline_text'),
    sourceUrl,
    raw: rawFields,
    universityIds,
    universityCountries,
    normalizedBenefits: normalizeScholarshipBenefits({
      coverage: stringValue(row, 'coverage'),
      amountMin: numberValue(row, 'amount_min'),
      amountMax: numberValue(row, 'amount_max'),
      amountCurrency: stringValue(row, 'amount_currency'),
      fundingType,
      sourceUrl,
      raw: rawFields,
    }),
    valuationContexts: buildScholarshipValuationContexts({
      scholarshipId: id,
      scholarshipCountry: stringValue(row, 'country'),
      universities: valuationUniversities,
    }),
    source: provenance(
      'scholarship-catalogue',
      String(id),
      sourceUrl,
      'coverage/amount/funding_type',
      stringValue(row, 'updated_at'),
    ),
  };
}

function readStatusDiagnostic(
  source: MatchingSourceKind,
  read: MatchingRead<unknown>,
): MatchingContextDiagnostic | null {
  if (!read.message) return null;
  return { source, status: read.status, message: read.message };
}

function emptyRead<T>(): MatchingRead<T> {
  return { value: [], status: 'missing', message: null } as MatchingRead<T>;
}

/**
 * Request-scoped Supabase adapter. It performs fixed/batched reads and never
 * enters the public `unstable_cache` catalogue path. The caller must pass the
 * authenticated request client so RLS remains the boundary for user rows.
 */
export function createSupabaseScholarshipMatchingContextRepository(
  supabase: SupabaseClient,
): ScholarshipMatchingContextRepository {
  return {
    readProfile: (userId) => readOne(
      'student_profiles',
      supabase.from('student_profiles').select(PROFILE_SELECT).eq('user_id', userId).maybeSingle(),
      (value) => {
        const row = record(value);
        return row ? profileFromRow(row) : null;
      },
    ),

    readEvidence: async (userId) => {
      const [achievements, activities, englishTests, standardizedTests] = await Promise.all([
        readMany(
          'student_achievements',
          supabase
            .from('student_achievements')
            .select('id, title, category, level, year, detail')
            .eq('user_id', userId)
            .order('sort_order', { ascending: true }),
          (row) => ({ ...row, __kind: 'achievement' }),
        ),
        readMany(
          'student_activities',
          supabase
            .from('student_activities')
            .select('id, title, category, level, period, description')
            .eq('user_id', userId)
            .order('sort_order', { ascending: true }),
          (row) => ({ ...row, __kind: 'activity' }),
        ),
        readMany(
          'english_test_scores',
          supabase
            .from('english_test_scores')
            .select('id, test_type, overall_score')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
          (row) => ({ ...row, __kind: 'english' }),
        ),
        readMany(
          'standardized_test_scores',
          supabase
            .from('standardized_test_scores')
            .select('id, test_type, score')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
          (row) => ({ ...row, __kind: 'standardized' }),
        ),
      ]);

      const allUnavailable = [achievements, activities, englishTests, standardizedTests]
        .every((read) => read.status === 'unavailable');
      const anyUnavailable = [achievements, activities, englishTests, standardizedTests]
        .some((read) => read.status === 'unavailable');
      const evidence: MatchingAcademicEvidence = {
        achievements: achievements.value
          ? evidenceFromRows(achievements.value as unknown as readonly UnknownRecord[]).achievements
          : null,
        activities: activities.value
          ? evidenceFromRows(activities.value as unknown as readonly UnknownRecord[]).activities
          : null,
        englishTests: englishTests.value
          ? evidenceFromRows(englishTests.value as unknown as readonly UnknownRecord[]).englishTests
          : null,
        standardizedTests: standardizedTests.value
          ? evidenceFromRows(standardizedTests.value as unknown as readonly UnknownRecord[]).standardizedTests
          : null,
      };
      const messages = [achievements, activities, englishTests, standardizedTests]
        .map((read) => read.message)
        .filter((message): message is string => message !== null);
      return {
        value: evidence,
        status: allUnavailable ? 'unavailable' : anyUnavailable ? 'unavailable' : 'present',
        message: messages.length > 0 ? messages.join('; ') : null,
      };
    },

    readSavedUniversities: (userId) => readMany(
      'user_universities',
        supabase
        .from('user_universities')
        .select('id, university_id, status, added_at, updated_at, universities(id, name, country, city, type, tuition_usd, living_cost_usd, housing)')
        .eq('user_id', userId)
        .order('added_at', { ascending: true })
        .order('id', { ascending: true }),
      savedUniversityFromRow,
    ),

    readApplications: ({ userId, applicationId, selectedProgrammeId }) => {
      if (!applicationId && !selectedProgrammeId) return Promise.resolve(emptyRead());
      let query = supabase
        .from('course_applications')
        .select(APPLICATION_SELECT)
        .eq('user_id', userId)
        .not('status', 'in', '("rejected","withdrawn","archived")');
      query = applicationId
        ? query.eq('id', applicationId)
        : query.eq('course_id', selectedProgrammeId!);
      return readMany(
        'course_applications',
        query.order('created_at', { ascending: false }),
        applicationFromRow,
      );
    },

    readProgrammes: (ids) => {
      const uniqueIds = [...new Set(ids.filter((id) => id.trim().length > 0))];
      if (uniqueIds.length === 0) return Promise.resolve(emptyRead());
      return readMany(
        'courses',
        supabase.from('courses').select(COURSE_SELECT).in('id', uniqueIds),
        programmeFromRow,
      );
    },

    readUniversities: (ids) => {
      const uniqueIds = [...new Set(ids.filter((id) => Number.isFinite(id)))];
      if (uniqueIds.length === 0) return Promise.resolve(emptyRead());
      return readMany(
        'universities',
        supabase.from('universities').select(UNIVERSITY_SELECT).in('id', uniqueIds),
        (row) => universityFromRow(row),
      );
    },

    readScholarships: (ids) => {
      const uniqueIds = [...new Set(ids.filter((id) => Number.isFinite(id)))];
      if (uniqueIds.length === 0) return Promise.resolve(emptyRead());
      return readMany(
        'scholarships',
        supabase
          .from('scholarships')
          .select(SCHOLARSHIP_SELECT)
          .eq('status', 'published')
          .in('id', uniqueIds)
          .order('id', { ascending: true }),
        scholarshipFromRow,
      );
    },
  };
}

function requestedScholarshipIds(request: MatchingContextRequest): number[] {
  return [...new Set((request.scholarshipIds ?? []).filter((id) => Number.isFinite(id)))].sort((a, b) => a - b);
}

function requestedProgrammeIds(
  request: MatchingContextRequest,
  applications: readonly MatchingApplicationSource[],
): string[] {
  return [
    ...(request.selectedProgrammeId ? [request.selectedProgrammeId] : []),
    ...applications.flatMap((application) => application.courseId ? [application.courseId] : []),
  ].filter((id, index, values) => values.indexOf(id) === index);
}

function requestedUniversityIds(
  request: MatchingContextRequest,
  applications: readonly MatchingApplicationSource[],
  programmes: readonly MatchingProgrammeSource[],
  savedUniversities: readonly SavedUniversitySource[],
): number[] {
  return [
    ...(request.selectedUniversityId != null ? [request.selectedUniversityId] : []),
    ...applications.flatMap((application) => application.universityId != null ? [application.universityId] : []),
    ...programmes.flatMap((programme) => programme.universityId != null ? [programme.universityId] : []),
    ...savedUniversities.map((saved) => saved.universityId),
  ].filter((id, index, values) => values.indexOf(id) === index);
}

function diagnosticsForReads(reads: Array<{ source: MatchingSourceKind; read: MatchingRead<unknown> }>): MatchingContextDiagnostic[] {
  return reads
    .map(({ source, read }) => readStatusDiagnostic(source, read))
    .filter((diagnostic): diagnostic is MatchingContextDiagnostic => diagnostic !== null);
}

/**
 * Compose the pure context from user-scoped repositories. The only reads that
 * can expand with catalogue size are the explicit scholarship ids and saved
 * university ids; both are issued as bounded `in (...)` batches.
 */
export async function loadScholarshipMatchingContext(args: {
  supabase: SupabaseClient;
  request: MatchingContextRequest;
  sources?: ScholarshipMatchingContextRepository;
}): Promise<ScholarshipMatchingContext> {
  const sources = args.sources ?? createSupabaseScholarshipMatchingContextRepository(args.supabase);
  const request = args.request;

  const [profile, evidence, savedUniversities, applications] = await Promise.all([
    sources.readProfile(request.userId),
    sources.readEvidence(request.userId),
    sources.readSavedUniversities(request.userId),
    sources.readApplications({
      userId: request.userId,
      applicationId: request.applicationId ?? null,
      selectedProgrammeId: request.selectedProgrammeId ?? null,
    }),
  ]);

  const applicationRows = applications.value ?? [];
  const savedRows = savedUniversities.value ?? [];
  const programmeRead = await sources.readProgrammes(requestedProgrammeIds(request, applicationRows));
  const programmeRows = programmeRead.value ?? [];
  const [universityRead, scholarshipRead] = await Promise.all([
    sources.readUniversities(
      requestedUniversityIds(request, applicationRows, programmeRows, savedRows),
    ),
    sources.readScholarships(requestedScholarshipIds(request)),
  ]);

  const contextSources: MatchingContextSources = {
    profile,
    evidence,
    savedUniversities,
    applications,
    programmes: programmeRead,
    universities: universityRead,
    scholarships: scholarshipRead,
    diagnostics: diagnosticsForReads([
      { source: 'student-profile', read: profile },
      { source: 'saved-university', read: savedUniversities },
      { source: 'application', read: applications },
      { source: 'programme', read: programmeRead },
      { source: 'university', read: universityRead },
      { source: 'scholarship-catalogue', read: scholarshipRead },
    ]),
  };

  return buildScholarshipMatchingContext(request, contextSources);
}
