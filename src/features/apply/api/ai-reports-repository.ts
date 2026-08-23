import type { SupabaseClient } from '@supabase/supabase-js';
import {
  MATCH_PROMPT_VERSION_V2,
  enforceFitClassification,
  matchingReportNarrativeSchema,
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

function analysisFromRow(row: Record<string, unknown> | null): MatchingAnalysisView | null {
  if (!row?.fit_dimensions || !row.fit_eligibility || !row.fit_classification) return null;
  const parsed = programmeFitSchema.safeParse({
    classification: row.fit_classification,
    confidence: row.fit_confidence ?? 0,
    limitations: row.fit_limitations ?? [],
    eligibility: row.fit_eligibility,
    dimensions: row.fit_dimensions,
  });
  if (!parsed.success) return null;
  // Narrative is optional twice over: the column may predate the migration
  // (key absent) and a persisted value may fail today's stricter schema.
  const narrative = matchingReportNarrativeSchema.safeParse(row.match_report_narrative);
  return {
    fit: enforceFitClassification(parsed.data),
    createdAt: String(row.created_at),
    promptVersion: String(row.prompt_version),
    inputHash: typeof row.input_hash === 'string' ? row.input_hash : null,
    strengths: stringArray(row.strengths),
    weaknesses: stringArray(row.weaknesses),
    narrative: narrative.success ? narrative.data : null,
  };
}

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

  const { data: analyses, error: analysisError } = await supabase
    .from('application_match_analyses')
    .select(
      'application_id,fit_dimensions,fit_eligibility,fit_classification,fit_confidence,fit_limitations,input_hash,prompt_version,strengths,weaknesses,created_at,match_report_narrative',
    )
    .in('application_id', ids)
    .eq('analysis_status', 'complete')
    .eq('prompt_version', MATCH_PROMPT_VERSION_V2)
    .order('created_at', { ascending: false });
  // The narrative column ships in supabase-match-report-narrative.sql; before
  // it runs, the whole list query would fail on the unknown column — retry
  // with the pre-narrative shape instead of losing every analysis.
  let analysesData = analyses as Array<Record<string, unknown>> | null;
  let analysesError = analysisError;
  if (analysisError && /match_report_narrative/i.test(analysisError.message ?? '')) {
    const retry = await supabase
      .from('application_match_analyses')
      .select(
        'application_id,fit_dimensions,fit_eligibility,fit_classification,fit_confidence,fit_limitations,input_hash,prompt_version,strengths,weaknesses,created_at',
      )
      .in('application_id', ids)
      .eq('analysis_status', 'complete')
      .eq('prompt_version', MATCH_PROMPT_VERSION_V2)
      .order('created_at', { ascending: false });
    analysesData = (retry.data ?? null) as Array<Record<string, unknown>> | null;
    analysesError = retry.error;
  }
  const missing =
    analysesError?.code === '42703' ||
    analysesError?.code === 'PGRST204' ||
    /fit_dimensions|fit_confidence|input_hash/i.test(analysesError?.message ?? '');
  const latestByApplication = new Map<string, MatchingAnalysisView>();
  for (const row of analysesData ?? []) {
    const applicationId = String(row.application_id);
    if (latestByApplication.has(applicationId)) continue;
    const analysis = analysisFromRow(row);
    if (analysis) latestByApplication.set(applicationId, analysis);
  }

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
  const [analysisResult, universityResult, scholarshipLinksResult] = await Promise.all([
    supabase
      .from('application_match_analyses')
      .select(
        'fit_dimensions,fit_eligibility,fit_classification,fit_confidence,fit_limitations,input_hash,prompt_version,strengths,weaknesses,created_at,match_report_narrative',
      )
      .eq('application_id', applicationId)
      .eq('analysis_status', 'complete')
      .eq('prompt_version', MATCH_PROMPT_VERSION_V2)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
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
  // Narrative column not migrated yet — refetch the pre-narrative shape so
  // the report page still renders its deterministic sections.
  let analysisRowResult = analysisResult;
  if (analysisResult.error && /match_report_narrative/i.test(analysisResult.error.message ?? '')) {
    analysisRowResult = await supabase
      .from('application_match_analyses')
      .select(
        'fit_dimensions,fit_eligibility,fit_classification,fit_confidence,fit_limitations,input_hash,prompt_version,strengths,weaknesses,created_at',
      )
      .eq('application_id', applicationId)
      .eq('analysis_status', 'complete')
      .eq('prompt_version', MATCH_PROMPT_VERSION_V2)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
  }
  const migrationMissing =
    analysisRowResult.error?.code === '42703' ||
    analysisRowResult.error?.code === 'PGRST204' ||
    /fit_dimensions|fit_confidence|input_hash/i.test(analysisRowResult.error?.message ?? '');
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
      analysis: analysisFromRow((analysisRowResult.data ?? null) as Record<string, unknown> | null),
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
