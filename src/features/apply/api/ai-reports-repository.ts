import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { matchingReportV2Schema, matchingReportV3Schema, type MatchingReportV2, type MatchingReportV3 } from '@/lib/ai/matching/domain';
import { buildProgrammeFitPlaceholder } from '@/shared/evaluation/f5-programme-fit';
import {
  MATCH_PROMPT_VERSION_V2,
  enforceFitClassification,
  programmeFitSchema,
  type MatchingAnalysisView,
  type MatchingApplicationSummary,
  type MatchingReportPageData,
} from '../domain';

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').slice(0, 12)
    : [];
}

function legacyAnalysisFromRow(row: Record<string, unknown>): MatchingAnalysisView | null {
  if (!row.fit_dimensions || !row.fit_eligibility || !row.fit_classification) return null;
  const parsed = programmeFitSchema.safeParse({
    classification: row.fit_classification,
    confidence: row.fit_confidence ?? 0,
    limitations: row.fit_limitations ?? [],
    eligibility: row.fit_eligibility,
    dimensions: row.fit_dimensions,
  });
  if (!parsed.success) return null;
  return {
    fit: enforceFitClassification(parsed.data),
    createdAt: String(row.created_at),
    promptVersion: String(row.prompt_version),
    inputHash: typeof row.input_hash === 'string' ? row.input_hash : null,
    strengths: stringArray(row.strengths),
    weaknesses: stringArray(row.weaknesses),
  };
}

function reportFromRow(row: Record<string, unknown>): MatchingReportV2 | null {
  const parsed = matchingReportV2Schema.safeParse(row.report_v2);
  return parsed.success ? parsed.data : null;
}

function reportV3FromRow(row: Record<string, unknown>): MatchingReportV3 | null {
  const parsed = matchingReportV3Schema.safeParse(row.report_v2);
  return parsed.success ? parsed.data : null;
}

function v3CompatibilityFit(): MatchingAnalysisView['fit'] {
  const placeholder = buildProgrammeFitPlaceholder();
  return programmeFitSchema.parse({
    classification: placeholder.classification,
    confidence: placeholder.confidencePercent,
    limitations: placeholder.limitations,
    eligibility: placeholder.eligibility,
    dimensions: Object.fromEntries(
      Object.entries(placeholder.dimensions).map(([key, dimension]) => [key, {
        status: dimension.status,
        score: dimension.score,
        summary: dimension.summary || 'Not assessed',
        strengths: dimension.strengths,
        gaps: dimension.gaps,
        evidence: dimension.evidenceRefs.map((ref) => ref.id),
        limitation: dimension.limitation,
      }]),
    ),
  });
}

export function analysisFromRow(row: Record<string, unknown> | null): MatchingAnalysisView | null {
  if (!row) return null;
  const reportV3 = reportV3FromRow(row);
  if (reportV3) {
    const legacy = legacyAnalysisFromRow(row);
    return {
      fit: legacy?.fit ?? v3CompatibilityFit(),
      createdAt: String(row.created_at),
      promptVersion: reportV3.metadata.promptVersion,
      inputHash: typeof row.input_hash === 'string' ? row.input_hash : null,
      strengths: reportV3.strengths.map((item) => item.title),
      weaknesses: reportV3.gaps.map((item) => item.title),
      reportV3,
      reportV2: null,
    };
  }
  const reportV2 = reportFromRow(row);
  if (reportV2) {
    const fit = programmeFitSchema.safeParse(reportV2.programmeFit);
    if (fit.success) {
      return {
        fit: enforceFitClassification(fit.data),
        createdAt: String(row.created_at),
        promptVersion: reportV2.metadata.promptVersion,
        inputHash: typeof row.input_hash === 'string' ? row.input_hash : null,
        strengths: reportV2.strengths.map((item) => item.title),
        weaknesses: reportV2.gaps.map((item) => item.title),
        reportV2,
      };
    }
  }
  return legacyAnalysisFromRow(row);
}

function latestAnalysisFromRows(rows: Array<Record<string, unknown>>): MatchingAnalysisView | null {
  // Prefer the newest valid V3, then V2, then legacy artifact. A malformed
  // newest row must not hide an older valid report.
  for (const row of rows) {
    if (reportV3FromRow(row)) return analysisFromRow(row);
  }
  for (const row of rows) {
    if (reportFromRow(row)) return analysisFromRow(row);
  }
  for (const row of rows) {
    const analysis = analysisFromRow(row);
    if (analysis) return analysis;
  }
  return null;
}

function latestRecordFromRows(rows: Array<Record<string, unknown>>): MatchingAnalysisRecord | null {
  for (const row of rows) {
    if (reportV3FromRow(row)) return toMatchingAnalysisRecord(row);
  }
  for (const row of rows) {
    if (reportFromRow(row)) return toMatchingAnalysisRecord(row);
  }
  for (const row of rows) {
    if (analysisFromRow(row)) return toMatchingAnalysisRecord(row);
  }
  return null;
}

const MATCHING_ANALYSIS_SELECT =
  'id,application_id,user_id,analysis_status,current_match_score,max_possible_match_score,score_label,max_score_label,pillars,inputs_present,improvement_actions,explanation,fit_dimensions,fit_eligibility,fit_classification,fit_confidence,fit_limitations,input_hash,prompt_version,strengths,weaknesses,created_at,report_v2,report_contract_version,matching_engine_version,target_profile_version_id,source_analysis_version_id,confirmed_snapshot_id,source_personal_report_version_id,source_personal_report_input_hash,f5_engine_version';
const LEGACY_ANALYSIS_SELECT =
  'application_id,fit_dimensions,fit_eligibility,fit_classification,fit_confidence,fit_limitations,input_hash,prompt_version,strengths,weaknesses,created_at';

export async function listMatchingApplications(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ applications: MatchingApplicationSummary[]; migrationMissing: boolean }> {
  const { data: applications, error } = await supabase
    .from('course_applications')
    .select('id,university_name,course_name,country,degree_level,deadline,created_at')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('[matching-report] application list failed', error);
    return { applications: [], migrationMissing: false };
  }
  const ids = (applications ?? []).map((application) => application.id);
  if (ids.length === 0) return { applications: [], migrationMissing: false };

  const matchingResult = await supabase
    .from('application_match_analyses')
    .select(MATCHING_ANALYSIS_SELECT)
    .in('application_id', ids)
    .eq('user_id', userId)
    .eq('analysis_status', 'complete')
    .order('created_at', { ascending: false });
  let analyses = (matchingResult.data ?? []) as Array<Record<string, unknown>>;
  let analysisError = matchingResult.error;
  if (analysisError && isMigrationMissing(analysisError)) {
    const legacyResult = await supabase
      .from('application_match_analyses')
      .select(LEGACY_ANALYSIS_SELECT)
      .in('application_id', ids)
      .eq('user_id', userId)
      .eq('analysis_status', 'complete')
      .eq('prompt_version', MATCH_PROMPT_VERSION_V2)
      .order('created_at', { ascending: false });
    analyses = (legacyResult.data ?? []) as Array<Record<string, unknown>>;
    analysisError = legacyResult.error;
  }
  const missing =
    isMigrationMissing(analysisError) || /fit_dimensions|fit_confidence|input_hash|report_v2/i.test(analysisError?.message ?? '');
  const rowsByApplication = new Map<string, Array<Record<string, unknown>>>();
  for (const row of analyses) {
    const applicationId = String(row.application_id);
    const rows = rowsByApplication.get(applicationId) ?? [];
    rows.push(row);
    rowsByApplication.set(applicationId, rows);
  }
  const latestByApplication = new Map(
    [...rowsByApplication.entries()].flatMap(([id, rows]) => {
      const analysis = latestAnalysisFromRows(rows);
      return analysis ? [[id, analysis] as const] : [];
    }),
  );

  return {
    applications: (applications ?? []).map((application) => ({
      id: application.id,
      universityName: application.university_name,
      courseName: application.course_name,
      country: application.country,
      degreeLevel: application.degree_level,
      deadline: application.deadline,
      analysis: latestByApplication.get(application.id) ?? null,
    })),
    migrationMissing: Boolean(missing),
  };
}

export async function getMatchingReportPageData(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
): Promise<{ data: MatchingReportPageData | null; migrationMissing: boolean }> {
  const { data: application, error } = await supabase
    .from('course_applications')
    .select('*,courses(*)')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !application) return { data: null, migrationMissing: false };

  const universityId = application.university_id ?? application.courses?.university_id ?? null;
  const matchingResult = await supabase
    .from('application_match_analyses')
    .select(MATCHING_ANALYSIS_SELECT)
    .eq('application_id', applicationId)
    .eq('user_id', userId)
    .eq('analysis_status', 'complete')
    .order('created_at', { ascending: false });
  let analysisRows = (matchingResult.data ?? []) as Array<Record<string, unknown>>;
  let analysisError = matchingResult.error;
  if (analysisError && isMigrationMissing(analysisError)) {
    const legacyResult = await supabase
      .from('application_match_analyses')
      .select(LEGACY_ANALYSIS_SELECT)
      .eq('application_id', applicationId)
      .eq('user_id', userId)
      .eq('analysis_status', 'complete')
      .eq('prompt_version', MATCH_PROMPT_VERSION_V2)
      .order('created_at', { ascending: false });
    analysisRows = (legacyResult.data ?? []) as Array<Record<string, unknown>>;
    analysisError = legacyResult.error;
  }
  const [universityResult, scholarshipLinksResult] = await Promise.all([
    universityId == null
      ? Promise.resolve({ data: null, error: null })
      : supabase.from('universities').select('*').eq('id', universityId).maybeSingle(),
    universityId == null
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from('scholarship_universities')
          .select(
            'scholarships(id,name,coverage,eligibility,deadline_date,deadline_text,source_url,status)',
          )
          .eq('university_id', universityId)
          .eq('scholarships.status', 'published')
          .limit(8),
  ]);
  const migrationMissing =
    isMigrationMissing(analysisError) ||
    /fit_dimensions|fit_confidence|input_hash|report_v2/i.test(analysisError?.message ?? '');
  const university = universityResult.data as Record<string, unknown> | null;
  const course = (application.courses ?? {}) as Record<string, unknown>;
  const scholarshipLinks = (scholarshipLinksResult.data ?? []) as Array<{
    scholarships: Record<string, unknown> | Record<string, unknown>[] | null;
  }>;
  const scholarships = scholarshipLinks.flatMap((link) => {
    const raw = Array.isArray(link.scholarships) ? link.scholarships[0] : link.scholarships;
    if (!raw) return [];
    return [
      {
        id: String(raw.id),
        name: String(raw.name),
        coverage: typeof raw.coverage === 'string' ? raw.coverage : null,
        eligibility: typeof raw.eligibility === 'string' ? raw.eligibility : null,
        deadline:
          typeof raw.deadline_date === 'string'
            ? raw.deadline_date
            : typeof raw.deadline_text === 'string'
              ? raw.deadline_text
              : null,
        sourceUrl: typeof raw.source_url === 'string' ? raw.source_url : null,
      },
    ];
  });

  const universityText = (key: string) =>
    typeof university?.[key] === 'string' && university[key] ? String(university[key]) : null;
  const courseText = (key: string) =>
    typeof course[key] === 'string' && course[key] ? String(course[key]) : null;

  return {
    data: {
      id: application.id,
      universityName: application.university_name,
      courseName: application.course_name,
      country: application.country ?? courseText('country') ?? universityText('country'),
      degreeLevel: application.degree_level ?? courseText('degree_level'),
      deadline: application.deadline ?? universityText('application_deadline'),
      analysis: latestAnalysisFromRows(
        analysisRows,
      ),
      universityId,
      courseUrl: application.course_url ?? courseText('course_url'),
      studyMode: application.study_mode ?? courseText('study_mode'),
      intake: application.intake ?? courseText('intake'),
      status: application.status,
      course: {
        summary: application.ai_summary,
        duration: courseText('duration'),
        tuition: courseText('tuition_fee_text'),
        entryRequirements: courseText('entry_requirements_summary'),
        englishRequirements: courseText('english_requirements_summary'),
        sourceConfidence:
          typeof course.source_confidence === 'number' ? course.source_confidence : null,
        lastExtractedAt: courseText('last_extracted_at'),
      },
      university: university
        ? {
            logoUrl: universityText('logo_url'),
            imageUrl: universityText('image_url'),
            qsRank: typeof university.qs_rank === 'number' ? university.qs_rank : null,
            theRank: typeof university.the_rank === 'number' ? university.the_rank : null,
            insight: universityText('specific_insight'),
            bestFor: universityText('best_for'),
            teachingStyle: universityText('teaching_style'),
            requirements: [
              universityText('gpa_range'),
              universityText('english_requirement'),
              universityText('standardized_test'),
              universityText('special_test'),
            ].filter((entry): entry is string => Boolean(entry)),
            tuition: universityText('tuition_usd'),
            livingCost: universityText('living_cost_usd'),
            scholarship: universityText('scholarship'),
            careerOutcomes: [
              universityText('employability'),
              universityText('industry_connections'),
              universityText('internship_coop'),
            ].filter((entry): entry is string => Boolean(entry)),
          }
        : null,
      scholarships,
    },
    migrationMissing: Boolean(migrationMissing),
  };
}

export interface MatchingAnalysisRecord {
  id: string;
  applicationId: string;
  userId: string;
  inputHash: string | null;
  promptVersion: string;
  createdAt: string;
  analysisStatus: string;
  // Legacy columns (always present)
  currentMatchScore: number | null;
  maxPossibleMatchScore: number | null;
  scoreLabel: string | null;
  pillars: Record<string, unknown> | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  improvementActions: unknown[] | null;
  // F5 columns (present if migrated)
  fitDimensions: Record<string, unknown> | null;
  fitEligibility: Record<string, unknown> | null;
  fitClassification: string | null;
  fitConfidence: number | null;
  fitLimitations: string[] | null;
  // V2 columns (present if report_v2 exists)
  reportV2: MatchingReportV2 | null;
  reportV3: MatchingReportV3 | null;
  reportContractVersion: string | null;
  matchingEngineVersion: string | null;
  targetProfileVersionId: string | null;
  sourceAnalysisVersionId: string | null;
  confirmedSnapshotId: string | null;
  // Lineage
  sourcePersonalReportVersionId: string | null;
  sourcePersonalReportInputHash: string | null;
  f5EngineVersion: string | null;
}

export function isMigrationMissing(error: PostgrestError | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    error.code === 'PGRST205' ||
    /(?:report_v2|report_contract_version|matching_engine_version|target_profile_version_id|source_analysis_version_id|confirmed_snapshot_id|source_personal_report|f5_engine_version)/i.test(error.message ?? '')
  );
}

export function toMatchingAnalysisRecord(row: Record<string, unknown>): MatchingAnalysisRecord {
  let parsedReport: MatchingReportV2 | null = null;
  let parsedReportV3: MatchingReportV3 | null = null;
  if (row.report_v2) {
    const parsedV3 = matchingReportV3Schema.safeParse(row.report_v2);
    if (parsedV3.success) parsedReportV3 = parsedV3.data;
    const parsed = matchingReportV2Schema.safeParse(row.report_v2);
    if (parsed.success) {
      parsedReport = parsed.data;
    }
  }

  return {
    id: String(row.id || ''),
    applicationId: String(row.application_id || ''),
    userId: String(row.user_id || ''),
    inputHash: typeof row.input_hash === 'string' ? row.input_hash : null,
    promptVersion: String(row.prompt_version || ''),
    createdAt: String(row.created_at || ''),
    analysisStatus: String(row.analysis_status || ''),

    currentMatchScore: typeof row.current_match_score === 'number' ? row.current_match_score : null,
    maxPossibleMatchScore: typeof row.max_possible_match_score === 'number' ? row.max_possible_match_score : null,
    scoreLabel: typeof row.score_label === 'string' ? row.score_label : null,
    pillars: row.pillars && typeof row.pillars === 'object' ? (row.pillars as Record<string, unknown>) : null,
    strengths: Array.isArray(row.strengths) ? row.strengths.filter((s) => typeof s === 'string') : null,
    weaknesses: Array.isArray(row.weaknesses) ? row.weaknesses.filter((w) => typeof w === 'string') : null,
    improvementActions: Array.isArray(row.improvement_actions) ? row.improvement_actions : null,

    fitDimensions: row.fit_dimensions && typeof row.fit_dimensions === 'object' ? (row.fit_dimensions as Record<string, unknown>) : null,
    fitEligibility: row.fit_eligibility && typeof row.fit_eligibility === 'object' ? (row.fit_eligibility as Record<string, unknown>) : null,
    fitClassification: typeof row.fit_classification === 'string' ? row.fit_classification : null,
    fitConfidence: typeof row.fit_confidence === 'number' ? row.fit_confidence : null,
    fitLimitations: Array.isArray(row.fit_limitations) ? row.fit_limitations.filter((l) => typeof l === 'string') : null,

    reportV2: parsedReport,
    reportV3: parsedReportV3,
    reportContractVersion: typeof row.report_contract_version === 'string' ? row.report_contract_version : null,
    matchingEngineVersion: typeof row.matching_engine_version === 'string' ? row.matching_engine_version : null,
    targetProfileVersionId: typeof row.target_profile_version_id === 'string' ? row.target_profile_version_id : null,
    sourceAnalysisVersionId: typeof row.source_analysis_version_id === 'string' ? row.source_analysis_version_id : null,
    confirmedSnapshotId: typeof row.confirmed_snapshot_id === 'string' ? row.confirmed_snapshot_id : null,

    sourcePersonalReportVersionId: typeof row.source_personal_report_version_id === 'string' ? row.source_personal_report_version_id : null,
    sourcePersonalReportInputHash: typeof row.source_personal_report_input_hash === 'string' ? row.source_personal_report_input_hash : null,
    f5EngineVersion: typeof row.f5_engine_version === 'string' ? row.f5_engine_version : null,
  };
}

export async function getLatestApplicationMatchingAnalysis(
  supabase: SupabaseClient,
  scope: { userId: string; applicationId: string },
  filter?: { promptVersion?: string; analysisStatus?: string },
): Promise<{ record: MatchingAnalysisRecord | null; migrationMissing: boolean }> {
  let query = supabase
    .from('application_match_analyses')
    .select(MATCHING_ANALYSIS_SELECT)
    .eq('application_id', scope.applicationId)
    .eq('user_id', scope.userId);

  if (filter?.promptVersion) {
    query = query.eq('prompt_version', filter.promptVersion);
  }
  if (filter?.analysisStatus) {
    query = query.eq('analysis_status', filter.analysisStatus);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(20);

  if (error) {
    const missing = isMigrationMissing(error);
    if (!missing) console.error('[matching-analysis] read failed', error);
    return { record: null, migrationMissing: missing };
  }

  const rows = (Array.isArray(data) ? data : data ? [data] : []) as Array<Record<string, unknown>>;
  return { record: latestRecordFromRows(rows), migrationMissing: false };
}

export async function getMatchingAnalysisByInputHash(
  supabase: SupabaseClient,
  scope: { userId: string; applicationId: string },
  inputHash: string,
  identity?: { contractVersion?: string; engineVersion?: string; promptVersion?: string },
): Promise<{ record: MatchingAnalysisRecord | null; migrationMissing: boolean }> {
  let query = supabase
    .from('application_match_analyses')
    .select(MATCHING_ANALYSIS_SELECT)
    .eq('application_id', scope.applicationId)
    .eq('user_id', scope.userId)
    .eq('input_hash', inputHash)
    .eq('analysis_status', 'complete');
  if (identity?.contractVersion) query = query.eq('report_contract_version', identity.contractVersion);
  if (identity?.engineVersion) query = query.eq('matching_engine_version', identity.engineVersion);
  if (identity?.promptVersion) query = query.eq('prompt_version', identity.promptVersion);
  const { data, error } = await query.maybeSingle();

  if (error) {
    const missing = isMigrationMissing(error);
    if (!missing) console.error('[matching-analysis] read failed by hash', error);
    return { record: null, migrationMissing: missing };
  }

  if (!data) return { record: null, migrationMissing: false };

  return { record: toMatchingAnalysisRecord(data), migrationMissing: false };
}

export async function saveApplicationMatchingAnalysis(
  supabase: SupabaseClient,
  args: {
    applicationId: string;
    userId: string;
    inputHash: string;
    promptVersion: string;
    // Legacy columns
    legacy: {
      currentMatchScore: number | null;
      maxPossibleMatchScore: number | null;
      scoreLabel: string;
      maxScoreLabel: string;
      pillars: Record<string, unknown>;
      confidence: number;
      inputsPresent: Record<string, boolean>;
      strengths: string[];
      weaknesses: string[];
      improvementActions: unknown[];
      explanation: string;
    };
    // V2 report
    reportV2: MatchingReportV2 | MatchingReportV3;
    // Lineage
    modelName: string;
    targetProfileVersionId: string;
    sourceAnalysisVersionId: string;
    confirmedSnapshotId: string;
    sourcePersonalReportVersionId: string;
    sourcePersonalReportInputHash: string;
    f5EngineVersion: string;
    // F5 fit
    fitDimensions: Record<string, unknown>;
    fitEligibility: Record<string, unknown>;
    fitClassification: string;
    fitConfidence: number;
    fitLimitations: string[];
  },
): Promise<{ record: MatchingAnalysisRecord | null; migrationMissing: boolean }> {
  const commonRow = {
    application_id: args.applicationId,
    user_id: args.userId,
    input_hash: args.inputHash,
    prompt_version: args.promptVersion,
    analysis_status: 'complete',

    // The original table requires these legacy fields even when report_v2 is
    // the canonical V3 payload. Keep an explicit unassessed compatibility
    // value; V3 consumers must read report_v2 instead of these fields.
    profile_version: 1,
    current_match_score: args.legacy.currentMatchScore ?? 0,
    max_possible_match_score: args.legacy.maxPossibleMatchScore,
    score_label: args.legacy.scoreLabel,
    max_score_label: args.legacy.maxScoreLabel,
    pillars: args.legacy.pillars,
    confidence: args.legacy.confidence,
    inputs_present: args.legacy.inputsPresent,
    strengths: args.legacy.strengths,
    weaknesses: args.legacy.weaknesses,
    improvement_actions: args.legacy.improvementActions,
    explanation: args.legacy.explanation,
    model_name: args.modelName,

    fit_dimensions: args.fitDimensions,
    fit_eligibility: args.fitEligibility,
    fit_classification: args.fitClassification,
    fit_confidence: args.fitConfidence,
    fit_limitations: args.fitLimitations,
  };

  const v2Columns = {
    report_v2: args.reportV2,
    report_contract_version: args.reportV2.contractVersion,
    matching_engine_version: args.reportV2.metadata.matchingEngineVersion,
    target_profile_version_id: args.targetProfileVersionId,
    source_analysis_version_id: args.sourceAnalysisVersionId,
    confirmed_snapshot_id: args.confirmedSnapshotId,
    source_personal_report_version_id: args.sourcePersonalReportVersionId,
    source_personal_report_input_hash: args.sourcePersonalReportInputHash,
    f5_engine_version: args.f5EngineVersion,
  };

  const { data, error } = await supabase
    .from('application_match_analyses')
    .insert({ ...commonRow, ...v2Columns })
    .select('*')
    .single();

  if (error) {
    console.error('[matching-analysis] insert failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    if (error.code === '23505') {
      const existing = await getMatchingAnalysisByInputHash(
        supabase,
        { userId: args.userId, applicationId: args.applicationId },
        args.inputHash,
        {
          contractVersion: args.reportV2.contractVersion,
          engineVersion: args.reportV2.metadata.matchingEngineVersion,
          promptVersion: args.promptVersion,
        },
      );
      if (existing.record?.analysisStatus === 'complete' && (existing.record.reportV2 || existing.record.reportV3)) {
        return existing;
      }
    }
    if (isMigrationMissing(error)) {
      return { record: null, migrationMissing: true };
    }
    return { record: null, migrationMissing: false };
  }

  return { record: toMatchingAnalysisRecord(data), migrationMissing: false };
}
