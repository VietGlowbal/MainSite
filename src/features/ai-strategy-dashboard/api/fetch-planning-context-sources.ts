/**
 * CORE 1 — Gate 2: Source Adapter
 *
 * `fetchPlanningContextSources` is the ONLY public function in this file.
 *
 * Responsibility:
 *   1. Fetch all upstream sources from Supabase (using application + user auth)
 *   2. Validate / runtime-parse raw DB rows into typed domain objects
 *   3. Record one SourceDiagnostic per attempted source
 *   4. Populate and return PlanningContextSources
 *
 * This gate does NOT:
 *   - derive gaps, interventions, missing evidence, staleness, or contextHash
 *   - resolve which deadline candidate wins (precedence)
 *   - make any planning decisions
 *   - call any AI model
 *
 * The output is the validated, normalized input to compilePlanningContext()
 * (Gate 3), which must remain a pure function.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ApplicationRequirement,
  ApplicationStage,
  ApplicationTask,
  CourseApplicationStatus,
} from '@/lib/apply-types';
import { getLatestPersonalReportV2 } from '@/features/apply/api';
import {
  MATCH_PROMPT_VERSION_V2,
  enforceFitClassification,
  programmeFitSchema,
} from '@/features/apply/domain';
import { recommendationFromRow } from '../domain/recommendation';
import { strategyRecommendationFromRow } from '../domain/strategy-recommendation';
import type {
  DeadlineAuthority,
  DeadlineCandidate,
  PlanningContextSources,
  PlanningDeadlineSource,
  PlanningEvidenceDocument,
  PlanningEvidenceInventory,
  PlanningProgrammeSummary,
  SourceDiagnostic,
  SourceProvenance,
  UserConstraint,
} from '../domain/planning-context';
import {
  isProfileEvaluation,
  parseImprovementActions,
} from './planning-context-source-parsers';

// ─── Fatal error ──────────────────────────────────────────────────────────────

/** Thrown when the application cannot be found or does not belong to userId. */
export class ApplicationNotFoundError extends Error {
  constructor(applicationId: string) {
    super(`[fetchPlanningContextSources] application ${applicationId} not found or unauthorized`);
    this.name = 'ApplicationNotFoundError';
  }
}

// ─── Internal raw row types ───────────────────────────────────────────────────

/** Raw `course_applications` row — only the fields Gate 2 needs. */
type RawApplication = {
  id: string;
  user_id: string;
  course_id: string | null;
  university_id: number | null;
  university_name: string;
  course_name: string;
  course_url: string | null;
  degree_level: string | null;
  subject: string | null;
  study_mode: string | null;
  intake: string | null;
  country: string | null;
  application_method: string | null;
  application_code: string | null;
  status: CourseApplicationStatus;
  deadline: string | null;
  deadline_source: string | null;
  deadline_confidence: number | null;
};

/** Raw `application_requirements` row — all fields mapped to ApplicationRequirement. */
type RawRequirement = {
  id: string;
  application_id: string;
  course_id: string | null;
  requirement_type: string;
  title: string | null;
  requirement_text: string;
  is_mandatory: boolean;
  student_status: string;
  source_url: string | null;
  source_id: string | null;
  confidence: number;
  created_at: string;
  updated_at: string;
};

/** Raw `application_stages` row. */
type RawStage = {
  id: string;
  application_id: string;
  name: string;
  slug: string;
  description: string | null;
  order_num: number;
  status: string;
  is_required: boolean;
  icon: string | null;
  why_this_matters: string | null;
  ai_generated: boolean;
  confidence: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Raw `application_tasks` row. */
type RawTask = {
  id: string;
  application_id: string;
  stage_id: string | null;
  title: string;
  description: string | null;
  task_type: string;
  status: string;
  priority: string;
  due_date: string | null;
  action_label: string | null;
  action_type: string | null;
  action_target: string | null;
  source_url: string | null;
  confidence: number;
  sort_order: number;
  completed_at: string | null;
  created_by: string;
  pillar: string | null;
  estimated_uplift: number | null;
  created_at: string;
  updated_at: string;
};

/** Raw `uploaded_documents` row — only the fields Gate 2 needs. */
type RawDocument = {
  id: string;
  type: string | null;
  file_name: string | null;
  is_active: boolean | null;
};

// ─── Row-to-domain mappers ────────────────────────────────────────────────────

function requirementFromRow(row: RawRequirement): ApplicationRequirement {
  return {
    id: row.id,
    applicationId: row.application_id,
    ...(row.course_id !== null ? { courseId: row.course_id } : {}),
    requirementType: row.requirement_type as ApplicationRequirement['requirementType'],
    ...(row.title !== null ? { title: row.title } : {}),
    requirementText: row.requirement_text,
    isMandatory: row.is_mandatory,
    studentStatus: row.student_status as ApplicationRequirement['studentStatus'],
    ...(row.source_url !== null ? { sourceUrl: row.source_url } : {}),
    ...(row.source_id !== null ? { sourceId: row.source_id } : {}),
    confidence: row.confidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function stageFromRow(row: RawStage): ApplicationStage {
  return {
    id: row.id,
    applicationId: row.application_id,
    name: row.name,
    slug: row.slug,
    ...(row.description !== null ? { description: row.description } : {}),
    orderNum: row.order_num,
    status: row.status as ApplicationStage['status'],
    isRequired: row.is_required,
    ...(row.icon !== null ? { icon: row.icon } : {}),
    ...(row.why_this_matters !== null ? { whyThisMatters: row.why_this_matters } : {}),
    aiGenerated: row.ai_generated,
    confidence: row.confidence,
    ...(row.started_at !== null ? { startedAt: row.started_at } : {}),
    ...(row.completed_at !== null ? { completedAt: row.completed_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function taskFromRow(row: RawTask): ApplicationTask {
  return {
    id: row.id,
    applicationId: row.application_id,
    ...(row.stage_id !== null ? { stageId: row.stage_id } : {}),
    title: row.title,
    ...(row.description !== null ? { description: row.description } : {}),
    taskType: row.task_type as ApplicationTask['taskType'],
    status: row.status as ApplicationTask['status'],
    priority: row.priority as ApplicationTask['priority'],
    ...(row.due_date !== null ? { dueDate: row.due_date } : {}),
    ...(row.action_label !== null ? { actionLabel: row.action_label } : {}),
    ...(row.action_type !== null
      ? { actionType: row.action_type as NonNullable<ApplicationTask['actionType']> }
      : {}),
    ...(row.action_target !== null ? { actionTarget: row.action_target } : {}),
    ...(row.source_url !== null ? { sourceUrl: row.source_url } : {}),
    confidence: row.confidence,
    sortOrder: row.sort_order,
    ...(row.completed_at !== null ? { completedAt: row.completed_at } : {}),
    createdBy: row.created_by,
    ...(row.pillar !== null ? { pillar: row.pillar } : {}),
    ...(row.estimated_uplift !== null ? { estimatedUplift: row.estimated_uplift } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function documentFromRow(row: RawDocument): PlanningEvidenceDocument {
  return {
    id: row.id,
    type: row.type ?? null,
    fileName: row.file_name ?? null,
    // `is_active` was added by `supabase-apply-v2.sql` with DEFAULT TRUE.
    // Treat a null column (pre-migration row) as active — same as the default.
    active: row.is_active ?? true,
  };
}

// ─── Programme summary normalizer ─────────────────────────────────────────────

function programmeSummaryFromRow(
  app: RawApplication,
  universityRow: Record<string, unknown> | null,
): PlanningProgrammeSummary {
  return {
    applicationId: app.id,
    courseId: app.course_id ?? null,
    universityId: app.university_id ?? null,
    universityName: app.university_name,
    courseName: app.course_name,
    courseUrl: app.course_url ?? null,
    degreeLevel: app.degree_level ?? null,
    subject: app.subject ?? null,
    country: app.country ?? null,
    studyMode: app.study_mode ?? null,
    intake: app.intake ?? null,
    applicationMethod: app.application_method ?? null,
    applicationCode: app.application_code ?? null,
    applicationStatus: app.status,
    // university-level deadline used separately in deadlineCandidates; not here.
    // universityName is already on the application row — no fallback needed.
    ...(universityRow && {
      // Prefer application-level values; fill in only truly missing descriptive
      // facts from the university row (same convention as the matching route).
      universityName: app.university_name || (String(universityRow.name ?? '') || app.university_name),
    }),
  };
}

// ─── Deadline candidate builder ───────────────────────────────────────────────

/**
 * Map `deadline_source` text to a `DeadlineAuthority`.
 *
 * The `deadline_source` column records where the deadline value was extracted
 * from (e.g. 'extracted_from_page', 'user_set'). Storage location alone does
 * NOT guarantee official authority; only explicit source metadata can.
 */
function authorityFromDeadlineSource(deadlineSource: string | null): DeadlineAuthority {
  if (!deadlineSource) return 'unknown';
  const lower = deadlineSource.toLowerCase();
  if (lower === 'user_set' || lower === 'manual') return 'user_set';
  if (lower === 'official' || lower === 'university_page' || lower === 'course_page') return 'official';
  if (lower === 'extracted_from_page' || lower === 'ai_extracted') return 'derived';
  return 'unknown';
}

function buildDeadlineCandidates(
  app: RawApplication,
  universityRow: Record<string, unknown> | null,
): DeadlineCandidate[] {
  const candidates: DeadlineCandidate[] = [];

  // Application-level deadline (course_applications.deadline)
  if (app.deadline) {
    const source: PlanningDeadlineSource = 'course_application';
    candidates.push({
      date: app.deadline,
      kind: 'application',
      source,
      authority: authorityFromDeadlineSource(app.deadline_source),
      confidence: typeof app.deadline_confidence === 'number' ? app.deadline_confidence : null,
      sourceReference: app.deadline_source ?? null,
    });
  }

  // University-level deadline (universities.application_deadline)
  // Only included when a university row was fetched and the column is a
  // non-empty string. This is a TEXT column in universities, not a DATE.
  if (universityRow && typeof universityRow.application_deadline === 'string' && universityRow.application_deadline) {
    candidates.push({
      date: universityRow.application_deadline,
      kind: 'application',
      source: 'university',
      // University-level deadline text is not user-set and is not per-
      // application; it is catalogue data. Authority is unknown unless
      // proven official.
      authority: 'unknown',
      confidence: null,
      sourceReference: 'universities.application_deadline',
    });
  }

  return candidates;
}

// ─── User constraint mapper ───────────────────────────────────────────────────

function userConstraintsFromProfile(
  profile: Record<string, unknown> | null,
): UserConstraint[] {
  if (!profile) return [];
  const out: UserConstraint[] = [];

  // Only populate constraints from fields that are explicitly in
  // UserConstraintKind and actually stored in student_profiles.
  if (typeof profile.budget_range === 'string' && profile.budget_range) {
    out.push({ kind: 'budget', value: profile.budget_range });
  } else if (typeof profile.tuition_budget_usd === 'string' && profile.tuition_budget_usd) {
    // Only fall back to tuition_budget_usd if budget_range is absent, to
    // avoid duplicating overlapping budget semantics.
    out.push({ kind: 'budget', value: profile.tuition_budget_usd });
  }
  if (typeof profile.target_intake === 'string' && profile.target_intake) {
    out.push({ kind: 'target_intake', value: profile.target_intake });
  }
  if (typeof profile.study_mode_preference === 'string' && profile.study_mode_preference) {
    out.push({ kind: 'study_mode', value: profile.study_mode_preference });
  }
  if (typeof profile.funding_source === 'string' && profile.funding_source) {
    out.push({ kind: 'funding_source', value: profile.funding_source });
  }

  return out;
}

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * Gate 2: Fetch, validate, and normalize all upstream planning sources.
 *
 * @throws ApplicationNotFoundError if the application does not exist or does
 *         not belong to `userId`.
 */
export async function fetchPlanningContextSources(
  supabase: SupabaseClient,
  applicationId: string,
  userId: string,
): Promise<PlanningContextSources> {
  const diagnostics: SourceDiagnostic[] = [];

  // ── 1. Application (FATAL) ─────────────────────────────────────────────────
  const APPLICATION_SELECT =
    'id,user_id,course_id,university_id,university_name,course_name,course_url,' +
    'degree_level,subject,study_mode,intake,country,application_method,' +
    'application_code,status,deadline,deadline_source,deadline_confidence';

  const { data: appRow, error: appError } = await supabase
    .from('course_applications')
    .select(APPLICATION_SELECT)
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (appError || !appRow) {
    throw new ApplicationNotFoundError(applicationId);
  }

  const app = appRow as unknown as RawApplication;

  // ── 2. University (optional — for deadline candidates + programme summary) ─
  let universityRow: Record<string, unknown> | null = null;
  if (app.university_id != null) {
    const { data: uniData, error: uniError } = await supabase
      .from('universities')
      .select('name,application_deadline')
      .eq('id', app.university_id)
      .maybeSingle();
    if (uniError) {
      diagnostics.push({ source: 'universities', status: 'unavailable', message: 'university query failed' });
    } else if (!uniData) {
      diagnostics.push({ source: 'universities', status: 'missing' });
    } else {
      universityRow = uniData as Record<string, unknown>;
      diagnostics.push({ source: 'universities', status: 'present' });
    }
  } else {
    diagnostics.push({ source: 'universities', status: 'missing', message: 'no university_id on application' });
  }

  const programme = programmeSummaryFromRow(app, universityRow);
  const deadlineCandidates = buildDeadlineCandidates(app, universityRow);

  // ── 3. Requirements ────────────────────────────────────────────────────────
  let requirements: ApplicationRequirement[] = [];
  const { data: reqData, error: reqError } = await supabase
    .from('application_requirements')
    .select('id,application_id,course_id,requirement_type,title,requirement_text,' +
            'is_mandatory,student_status,source_url,source_id,confidence,created_at,updated_at')
    .eq('application_id', applicationId);

  if (reqError) {
    diagnostics.push({ source: 'application_requirements', status: 'unavailable', message: 'query failed' });
  } else if (!reqData || reqData.length === 0) {
    diagnostics.push({ source: 'application_requirements', status: 'missing' });
  } else {
    requirements = (reqData as unknown as RawRequirement[]).map(requirementFromRow);
    diagnostics.push({ source: 'application_requirements', status: 'present' });
  }

  // ── 4. Stages ──────────────────────────────────────────────────────────────
  let stages: ApplicationStage[] = [];
  const { data: stagesData, error: stagesError } = await supabase
    .from('application_stages')
    .select('id,application_id,name,slug,description,order_num,status,is_required,' +
            'icon,why_this_matters,ai_generated,confidence,started_at,completed_at,created_at,updated_at')
    .eq('application_id', applicationId)
    .order('order_num', { ascending: true });

  if (stagesError) {
    diagnostics.push({ source: 'application_stages', status: 'unavailable', message: 'query failed' });
  } else if (!stagesData || stagesData.length === 0) {
    diagnostics.push({ source: 'application_stages', status: 'missing' });
  } else {
    stages = (stagesData as unknown as RawStage[]).map(stageFromRow);
    diagnostics.push({ source: 'application_stages', status: 'present' });
  }

  // ── 5. Tasks ───────────────────────────────────────────────────────────────
  let tasks: ApplicationTask[] = [];
  const { data: tasksData, error: tasksError } = await supabase
    .from('application_tasks')
    .select('id,application_id,stage_id,title,description,task_type,status,priority,' +
            'due_date,action_label,action_type,action_target,source_url,confidence,' +
            'sort_order,completed_at,created_by,pillar,estimated_uplift,created_at,updated_at')
    .eq('application_id', applicationId)
    .order('sort_order', { ascending: true });

  if (tasksError) {
    diagnostics.push({ source: 'application_tasks', status: 'unavailable', message: 'query failed' });
  } else if (!tasksData || tasksData.length === 0) {
    diagnostics.push({ source: 'application_tasks', status: 'missing' });
  } else {
    tasks = (tasksData as unknown as RawTask[]).map(taskFromRow);
    diagnostics.push({ source: 'application_tasks', status: 'present' });
  }

  // ── 6. Legacy Recommendations (AI Strategy Dashboard rows) ────────────────
  // AI Strategy Dashboard rows have `category IS NOT NULL`.
  // The old workspace sidebar uses `category IS NULL` — see
  // application-workspace.ts and generate-recommendations.ts.
  // Gate 2 reads only the AI Strategy Dashboard's producer rows.
  // We explicitly do NOT filter `archived_at IS NULL` here because the locked
  // contract stores them under `legacyRecommendations` — historical state, not
  // an active-only list. Gate 3 / Core 2 decides what to do with archived rows.
  let recommendations: ReturnType<typeof recommendationFromRow>[] = [];
  const { data: recsData, error: recsError } = await supabase
    .from('application_recommendations')
    .select('*')
    .eq('application_id', applicationId)
    .not('category', 'is', null)
    .order('created_at', { ascending: false });

  if (recsError) {
    diagnostics.push({ source: 'application_recommendations', status: 'unavailable', message: 'query failed' });
  } else if (!recsData || recsData.length === 0) {
    diagnostics.push({ source: 'application_recommendations', status: 'missing' });
  } else {
    recommendations = (recsData as Record<string, unknown>[]).map(recommendationFromRow);
    diagnostics.push({ source: 'application_recommendations', status: 'present' });
  }

  // ── 7. Profile Evaluation (Personal Report V2 → structured_evaluation) ────
  let profileEvaluation: PlanningContextSources['profileEvaluation'] = null;

  // Reuse the repository's own query semantics (ordering, selection, userId filter).
  const { record: reportRecord, migrationMissing: reportMigMissing } =
    await getLatestPersonalReportV2(supabase, userId);

  if (reportMigMissing) {
    diagnostics.push({ source: 'student_personal_report_versions', status: 'unavailable', message: 'migration missing' });
  } else if (!reportRecord) {
    diagnostics.push({ source: 'student_personal_report_versions', status: 'missing' });
  } else if (!reportRecord.evaluation || !isProfileEvaluation(reportRecord.evaluation)) {
    // Row exists but structured_evaluation is null or failed the guard.
    diagnostics.push({ source: 'student_personal_report_versions', status: 'invalid', message: 'structured_evaluation absent or failed structural check' });
  } else {
    const provenance: SourceProvenance = {
      id: reportRecord.id,
      generatedAt: reportRecord.generatedAt,
      inputHash: reportRecord.inputHash ?? null,
      promptVersion: reportRecord.promptVersion ?? null,
      engineVersion: reportRecord.engineVersion ?? null,
      modelName: reportRecord.modelName ?? null,
      // Personal Report ancestry: not sourced from applicant_analyses or
      // application_match_analyses — these fields are only meaningful for F7.
      sourceAnalysisId: null,
      sourceMatchAnalysisId: null,
    };
    profileEvaluation = { data: reportRecord.evaluation, provenance };
    diagnostics.push({ source: 'student_personal_report_versions', status: 'present' });
  }

  // ── 8. Programme Fit (F5 — application_match_analyses) ────────────────────
  let programmeFit: PlanningContextSources['programmeFit'] = null;

  // Mirror the canonical runtime: filter by MATCH_PROMPT_VERSION_V2 and
  // analysis_status = 'complete', newest first.
  const { data: matchRow, error: matchError } = await supabase
    .from('application_match_analyses')
    .select(
      'id,fit_dimensions,fit_eligibility,fit_classification,fit_confidence,' +
      'fit_limitations,input_hash,prompt_version,model_name,improvement_actions,created_at',
    )
    .eq('application_id', applicationId)
    .eq('analysis_status', 'complete')
    .eq('prompt_version', MATCH_PROMPT_VERSION_V2)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (matchError) {
    diagnostics.push({ source: 'application_match_analyses', status: 'unavailable', message: 'query failed' });
  } else if (!matchRow) {
    diagnostics.push({ source: 'application_match_analyses', status: 'missing' });
  } else {
    const row = matchRow as unknown as Record<string, unknown>;
    const fitParsed = programmeFitSchema.safeParse({
      classification: row.fit_classification,
      confidence: row.fit_confidence ?? 0,
      limitations: row.fit_limitations ?? [],
      eligibility: row.fit_eligibility,
      dimensions: row.fit_dimensions,
    });

    const improvementActions = parseImprovementActions(row.improvement_actions);

    if (!fitParsed.success) {
      diagnostics.push({ source: 'application_match_analyses', status: 'invalid', message: 'programmeFitSchema parse failed' });
    } else if (improvementActions === null) {
      diagnostics.push({ source: 'application_match_analyses', status: 'invalid', message: 'improvement_actions failed structural validation' });
    } else {
      const provenance: SourceProvenance = {
        id: row.id as string,
        generatedAt: row.created_at as string,
        inputHash: typeof row.input_hash === 'string' ? row.input_hash : null,
        promptVersion: typeof row.prompt_version === 'string' ? row.prompt_version : null,
        engineVersion: null, // match analyses do not store an engine version
        modelName: typeof row.model_name === 'string' ? row.model_name : null,
        sourceAnalysisId: null,
        sourceMatchAnalysisId: null,
      };
      programmeFit = {
        data: enforceFitClassification(fitParsed.data),
        improvementActions,
        provenance,
      };
      diagnostics.push({ source: 'application_match_analyses', status: 'present' });
    }
  }

  // ── 9. Strategy Recommendation (F7) ───────────────────────────────────────
  let strategyRecommendation: PlanningContextSources['strategyRecommendation'] = null;

  // Mirror the GET route: newest first, no prompt_version filter (F7 does not
  // have the same version-gating as F5).
  const { data: stratRow, error: stratError } = await supabase
    .from('application_strategy_recommendations')
    .select(
      'id,application_id,source_analysis_id,source_match_analysis_id,' +
      'direction_options,chosen_direction,chosen_direction_why,narrative,' +
      'positioning_before,positioning_after,positioning_rationale,' +
      'portfolio_evaluations,differentiation_insight,differentiation_proposal,' +
      'roadmap,model_name,prompt_version,pdf_storage_path,created_at',
    )
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (stratError) {
    // Treat missing migration as 'unavailable' — same pattern as the GET route.
    const isMigration =
      stratError.code === '42P01' ||
      stratError.code === 'PGRST205' ||
      stratError.code === 'PGRST204';
    diagnostics.push({
      source: 'application_strategy_recommendations',
      status: 'unavailable',
      message: isMigration ? 'migration missing' : 'query failed',
    });
  } else if (!stratRow) {
    diagnostics.push({ source: 'application_strategy_recommendations', status: 'missing' });
  } else {
    const row = stratRow as unknown as Record<string, unknown>;
    const parsed = strategyRecommendationFromRow(row);
    if (!parsed) {
      diagnostics.push({ source: 'application_strategy_recommendations', status: 'invalid', message: 'strategyRecommendationSchema parse failed' });
    } else {
      const provenance: SourceProvenance = {
        id: parsed.id,
        generatedAt: parsed.createdAt,
        inputHash: null, // F7 does not store input_hash
        promptVersion: typeof row.prompt_version === 'string' ? row.prompt_version : null,
        engineVersion: null,
        modelName: typeof row.model_name === 'string' ? row.model_name : null,
        // F7 ancestry: source_analysis_id → applicant_analyses.id
        //              source_match_analysis_id → application_match_analyses.id
        sourceAnalysisId: parsed.sourceAnalysisId,
        sourceMatchAnalysisId: parsed.sourceMatchAnalysisId,
      };
      strategyRecommendation = {
        data: {
          directionOptions: parsed.directionOptions,
          chosenDirection: parsed.chosenDirection,
          chosenDirectionWhy: parsed.chosenDirectionWhy,
          narrative: parsed.narrative,
          positioningBefore: parsed.positioningBefore,
          positioningAfter: parsed.positioningAfter,
          positioningRationale: parsed.positioningRationale,
          portfolioEvaluations: parsed.portfolioEvaluations,
          differentiationInsight: parsed.differentiationInsight,
          differentiationProposal: parsed.differentiationProposal,
          roadmap: parsed.roadmap,
        },
        provenance,
      };
      diagnostics.push({ source: 'application_strategy_recommendations', status: 'present' });
    }
  }

  // ── 10. User constraints (from student_profiles) ───────────────────────────
  let userConstraints: UserConstraint[] = [];
  const { data: profileRow, error: profileError } = await supabase
    .from('student_profiles')
    .select('budget_range,tuition_budget_usd,target_intake,study_mode_preference,funding_source')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError) {
    diagnostics.push({ source: 'student_profiles', status: 'unavailable', message: 'query failed' });
  } else if (!profileRow) {
    diagnostics.push({ source: 'student_profiles', status: 'missing' });
    userConstraints = [];
  } else {
    userConstraints = userConstraintsFromProfile(profileRow as Record<string, unknown>);
    diagnostics.push({ source: 'student_profiles', status: 'present' });
  }

  // ── 11. Evidence inventory (uploaded_documents) ───────────────────────────
  let evidenceInventory: PlanningEvidenceInventory = { documents: [] };

  // Gate 2 performs a narrow query for only the fields required by the locked
  // PlanningEvidenceInventory contract. candidate-context.ts does not expose
  // the `is_active` field, so we issue our own query.
  const { data: docsData, error: docsError } = await supabase
    .from('uploaded_documents')
    .select('id,type,file_name,is_active')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (docsError) {
    diagnostics.push({ source: 'uploaded_documents', status: 'unavailable', message: 'query failed' });
  } else if (!docsData || docsData.length === 0) {
    diagnostics.push({ source: 'uploaded_documents', status: 'missing' });
  } else {
    const docs: PlanningEvidenceDocument[] = (docsData as RawDocument[]).map(documentFromRow);
    evidenceInventory = { documents: docs };
    diagnostics.push({ source: 'uploaded_documents', status: 'present' });
  }

  // ── Assemble ───────────────────────────────────────────────────────────────
  return {
    applicationId,
    userId,
    programme,
    requirements,
    stages,
    tasks,
    recommendations,
    deadlineCandidates,
    evidenceInventory,
    profileEvaluation,
    programmeFit,
    strategyRecommendation,
    userConstraints,
    diagnostics,
  };
}
