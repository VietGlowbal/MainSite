import type { SupabaseClient } from '@supabase/supabase-js';
import type { PillarBreakdown, PillarKey } from '@/lib/match-insights';
import {
  EMPTY_NARRATIVE,
  narrativeFromRow,
  runEvaluation,
  type EvaluationResult,
  type EvidenceInput,
  type ProgrammeFacts,
  type UniversityFacts,
  type VaguenessField,
} from '../domain';

/**
 * Assemble a full F1–F6 evaluation for one application.
 *
 * The only I/O in the engine's path: six reads, then `runEvaluation`, which is
 * pure. Nothing here calls a model — the F1/F4 narrative is whatever was last
 * generated and stored by
 * `POST /api/applications/[id]/strategy/applicant-analysis`.
 *
 * ─── A MISSING NARRATIVE IS NOT A MISSING PAGE ───────────────────────────────
 *
 * If no analysis has been generated yet, the narrative comes back
 * `EMPTY_NARRATIVE` and the evaluation still runs. Four of the six frameworks
 * need no model at all, so a student with achievements entered still gets a
 * real evidence hierarchy, real competency scores and a real programme fit —
 * and the portrait shows the sections it can with a count of those waiting.
 * Returning null here instead would throw away four working frameworks because
 * a fifth had not run.
 *
 * ─── THE UNIVERSITY JOIN IS ALLOWED TO FAIL ──────────────────────────────────
 *
 * `course_applications.university_id` is resolved by a matcher during the parse
 * and does not always land. Every consumer of `UniversityFacts` treats null as
 * "we don't have the directory entry", not as an error: the fit page falls back
 * to the course's own fields. A course whose university we cannot match is
 * still a course the student is applying to.
 */

type Client = SupabaseClient;

/** The free-text fields F6 grades. Labels are what the report shows. */
const WRITTEN_FIELDS: readonly { column: string; field: string; label: string }[] = [
  { column: 'goals', field: 'careerGoals', label: 'Career goals' },
];

const STATEMENT_FIELDS: readonly { key: string; field: string; label: string }[] = [
  { key: 'motivations', field: 'motivations', label: 'What motivates you' },
  { key: 'goals', field: 'statementGoals', label: 'Your goals' },
  { key: 'dreamCareer', field: 'dreamCareer', label: 'Dream career' },
  { key: 'reasonsAbroad', field: 'reasonsAbroad', label: 'Why study abroad' },
];

function toUniversityFacts(row: Record<string, unknown> | null): UniversityFacts | null {
  if (!row) return null;
  const text = (key: string): string | null => {
    const value = row[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  };
  const int = (key: string): number | null => {
    const value = row[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };

  return {
    name: text('name') ?? '',
    localName: text('local_name'),
    country: text('country'),
    type: text('type'),
    qsRank: int('qs_rank'),
    theRank: int('the_rank'),
    imageUrl: text('image_url'),
    logoUrl: text('logo_url'),
    strengths: text('strengths'),
    specificInsight: text('specific_insight'),
    teachingStyle: text('teaching_style'),
    bestFor: text('best_for'),
    gpaRange: text('gpa_range'),
    englishRequirement: text('english_requirement'),
    standardisedTest: text('standardized_test'),
    admissionDifficulty: text('admission_difficulty'),
    acceptRate: text('accept_rate'),
    tuitionUsd: text('tuition_usd'),
    livingCostUsd: text('living_cost_usd'),
    housing: text('housing'),
    scholarship: text('scholarship'),
  };
}

export async function loadEvaluation(
  supabase: Client,
  userId: string,
  applicationId: string,
): Promise<EvaluationResult | null> {
  const { data: application } = await supabase
    .from('course_applications')
    .select(
      'id, course_id, university_id, university_name, course_name, course_url, degree_level, subject, study_mode, intake, deadline',
    )
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!application) return null;

  const [
    { data: analysisRow },
    { data: matchRow },
    { data: profile },
    { data: achievements },
    { data: activities },
  ] = await Promise.all([
    supabase
      .from('applicant_analyses')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('application_match_analyses')
      .select('*')
      .eq('application_id', applicationId)
      .eq('analysis_status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('student_profiles')
      .select('goals, personal_statement_answers')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('student_achievements')
      .select('id, category, title, competition, organisation, level, year, evidence_key')
      .eq('user_id', userId)
      .order('sort_order'),
    supabase
      .from('student_activities')
      .select('id, category, title, organisation, level, period')
      .eq('user_id', userId)
      .order('sort_order'),
  ]);

  // The universities row is a best-effort join — see the header.
  let universityRow: Record<string, unknown> | null = null;
  if (application.university_id) {
    const numericId = Number(application.university_id);
    if (Number.isFinite(numericId)) {
      const { data } = await supabase
        .from('universities')
        .select('*')
        .eq('id', numericId)
        .maybeSingle();
      universityRow = data ?? null;
    }
  }

  // Tuition and requirements summaries live on `courses`, not
  // `course_applications` — same join `src/lib/api/application-workspace.ts`
  // uses. `course_id` is nullable (a course row does not always land), so this
  // is best-effort too.
  let courseRow: { tuition_fee_text: string | null; entry_requirements_summary: string | null; english_requirements_summary: string | null } | null =
    null;
  if (application.course_id) {
    const { data } = await supabase
      .from('courses')
      .select('tuition_fee_text, entry_requirements_summary, english_requirements_summary')
      .eq('id', application.course_id)
      .maybeSingle();
    courseRow = data ?? null;
  }

  const statementAnswers = (profile?.personal_statement_answers ?? {}) as Record<string, unknown>;

  const writtenFields: VaguenessField[] = [
    ...WRITTEN_FIELDS.map(({ column, field, label }) => ({
      field,
      label,
      value: (profile?.[column as keyof typeof profile] as string | null | undefined) ?? null,
    })),
    ...STATEMENT_FIELDS.map(({ key, field, label }) => ({
      field,
      label,
      value: typeof statementAnswers[key] === 'string' ? (statementAnswers[key] as string) : null,
    })),
  ];

  const evidence: EvidenceInput[] = [
    ...(achievements ?? []).map(
      (row): EvidenceInput => ({
        id: String(row.id),
        kind: 'achievement',
        title: String(row.title ?? ''),
        category: String(row.category ?? ''),
        organisation: row.organisation ?? null,
        competition: row.competition ?? null,
        level: row.level ?? null,
        when: row.year == null ? null : String(row.year),
        hasDocument: Boolean(row.evidence_key),
      }),
    ),
    ...(activities ?? []).map(
      (row): EvidenceInput => ({
        id: String(row.id),
        kind: 'activity',
        title: String(row.title ?? ''),
        category: String(row.category ?? ''),
        organisation: row.organisation ?? null,
        competition: null,
        level: row.level ?? null,
        when: row.period ?? null,
        // student_activities has no evidence_key column — an activity can never
        // be verified. Recorded in ACTIVITY_EVIDENCE_UNSUPPORTED.
        hasDocument: false,
      }),
    ),
  ];

  const pillars = (matchRow?.pillars ?? {}) as Record<PillarKey, PillarBreakdown>;
  const rawConfidence = typeof matchRow?.confidence === 'number' ? matchRow.confidence : 0;

  return runEvaluation({
    applicationId,
    writtenFields,
    evidence,
    narrative: analysisRow ? narrativeFromRow(analysisRow) : EMPTY_NARRATIVE,
    pillars: normalisePillars(pillars),
    overallFitPercent: matchRow?.current_match_score ?? 0,
    goalFitPercent: matchRow?.max_possible_match_score ?? 0,
    matchConfidence: rawConfidence >= 70 ? 'high' : rawConfidence >= 40 ? 'medium' : 'low',
    university: toUniversityFacts(universityRow),
    programme: {
      courseName: application.course_name ?? '',
      universityName: application.university_name ?? '',
      degreeLevel: application.degree_level ?? null,
      subject: application.subject ?? null,
      studyMode: application.study_mode ?? null,
      intake: application.intake ?? null,
      deadline: application.deadline ?? null,
      tuitionFee: courseRow?.tuition_fee_text ?? null,
      entryRequirementsSummary: courseRow?.entry_requirements_summary ?? null,
      englishRequirementsSummary: courseRow?.english_requirements_summary ?? null,
      courseUrl: application.course_url ?? null,
    } satisfies ProgrammeFacts,
    generatedAt: analysisRow?.created_at ?? new Date().toISOString(),
  });
}

const EMPTY_PILLAR: PillarBreakdown = {
  current: 0,
  max: 0,
  assessed: false,
  summary: '',
  evidenceQuotes: [],
  strengths: [],
  gaps: [],
  improvements: [],
};

const PILLAR_KEYS: readonly PillarKey[] = ['academic', 'activities', 'essays', 'impact', 'personal'];

/**
 * Guarantee all five pillars exist.
 *
 * `application_match_analyses.pillars` is a JSON blob written by an older
 * version of the scorer for some rows, and F2 indexes all five by key. A
 * missing key would be `undefined` at runtime despite the type saying
 * otherwise — the exact class of bug `noUncheckedIndexedAccess` exists to
 * catch, and one a stored row can reintroduce at any time.
 */
function normalisePillars(
  pillars: Record<PillarKey, PillarBreakdown>,
): Record<PillarKey, PillarBreakdown> {
  const complete = {} as Record<PillarKey, PillarBreakdown>;
  for (const key of PILLAR_KEYS) {
    complete[key] = pillars[key] ?? EMPTY_PILLAR;
  }
  return complete;
}
