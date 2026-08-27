import { NextResponse } from 'next/server';
import { strategyRecommendationFromRow, strategyReportV2FromRow } from '@/features/ai-strategy-dashboard/domain';
import { getLatestApplicationPersonalReportV2, stableHash } from '@/features/apply/api';
import { enforceFitClassification, programmeFitSchema, type ProgrammeFit } from '@/features/apply/domain';
import {
  generateStrategyRecommendation,
  generateStrategyReportV2,
  STRATEGY_RECOMMENDATION_PROMPT_VERSION,
  STRATEGY_REPORT_V2_PROMPT_VERSION,
} from '@/lib/ai/strategy-recommendation';
import { defaultOpenAIModel } from '@/lib/ai/openai-client';
import { createClient } from '@/lib/supabase/server';
import { logger, startTimer } from '@/server/observability';
import { F5_ENGINE_VERSION } from '@/shared/evaluation/f5-programme-fit';

/**
 * GET  /api/applications/[id]/strategy/recommendation — latest F8 report, or null.
 * POST /api/applications/[id]/strategy/recommendation — generate a fresh one.
 *
 * F8 synthesises the structured Personal Report V2 and the Matching Report (F5)
 * into an actionable Strategic Recommendation.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

async function loadApplication(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applicationId: string,
  userId: string,
) {
  const { data } = await supabase
    .from('course_applications')
    .select('id, university_name, course_name, subject, degree_level, university_id, courses(subject, degree_level)')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

function fitFromRow(row: Record<string, unknown> | null): { fit: ProgrammeFit; id: string } | null {
  if (!row?.fit_dimensions || !row.fit_eligibility || !row.fit_classification) return null;
  const parsed = programmeFitSchema.safeParse({
    classification: row.fit_classification,
    confidence: row.fit_confidence ?? 0,
    limitations: row.fit_limitations ?? [],
    eligibility: row.fit_eligibility,
    dimensions: row.fit_dimensions,
  });
  if (!parsed.success) return null;
  return { fit: enforceFitClassification(parsed.data), id: String(row.id) };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const application = await loadApplication(supabase, applicationId, user.id);
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const { data: latest } = await supabase
    .from('application_strategy_recommendations')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const recommendation = latest ? strategyRecommendationFromRow(latest) : null;
  const reportV2 = latest ? strategyReportV2FromRow(latest) : null;
  return NextResponse.json({ recommendation, reportV2 });
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const getElapsed = startTimer();
  const { id: applicationId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  logger.info('strategy_recommendation_generate', {
    userId: user.id,
    applicationId,
    stage: 'started',
    outcome: 'started',
  });

  const application = await loadApplication(supabase, applicationId, user.id);
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('strategy_recommendation_generate', {
      userId: user.id,
      applicationId,
      stage: 'validated',
      outcome: 'not_configured',
      durationMs: getElapsed(),
    });
    return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
  }

  const [
    personalReportResult,
    { data: matchRow },
    { data: achievements },
    { data: activities },
    universityResult,
  ] = await Promise.all([
    getLatestApplicationPersonalReportV2(supabase, { userId: user.id, applicationId }),
    supabase
      .from('application_match_analyses')
      .select('*')
      .eq('application_id', applicationId)
      .eq('user_id', user.id)
      .eq('analysis_status', 'complete')
      .eq('f5_engine_version', F5_ENGINE_VERSION)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('student_achievements').select('category, title, detail').eq('user_id', user.id),
    supabase.from('student_activities').select('category, title, description').eq('user_id', user.id),
    application.university_id == null
      ? Promise.resolve({ data: null })
      : supabase
          .from('universities')
          .select('employability, industry_connections, internship_coop')
          .eq('id', application.university_id)
          .maybeSingle(),
  ]);

  const personalRecord = personalReportResult.record;
  const fitResult = matchRow ? fitFromRow(matchRow) : null;

  if (!personalRecord || !fitResult) {
    logger.warn('strategy_recommendation_generate', {
      userId: user.id,
      applicationId,
      stage: 'validated',
      outcome: 'missing_inputs',
      durationMs: getElapsed(),
    });
    return NextResponse.json(
      {
        error: 'Generate your Personal Report and Matching Report first — the Strategic Recommendation Report builds on both.',
        needsInputs: true,
      },
      { status: 422 },
    );
  }

  const university = universityResult.data as Record<string, unknown> | null;
  const courses = application.courses as { subject?: string | null; degree_level?: string | null } | null;
  const modelName = process.env.OPENAI_MODEL || defaultOpenAIModel();
  // Both shapes count as "current" for cache identity — which one lands is an
  // implementation detail of this request, not a change of inputs.
  const PROMPT_VERSIONS = [STRATEGY_REPORT_V2_PROMPT_VERSION, STRATEGY_RECOMMENDATION_PROMPT_VERSION];

  const careerOutcomes = university
    ? [university.employability, university.industry_connections, university.internship_coop]
        .filter(Boolean)
        .join(' ') || null
    : null;

  const programmeInput = {
    universityName: application.university_name ?? 'Not specified',
    courseName: application.course_name ?? 'Not specified',
    subject: application.subject ?? courses?.subject ?? null,
    degreeLevel: application.degree_level ?? courses?.degree_level ?? null,
    careerOutcomes,
  };

  const inputHash = stableHash({
    personalReportVersionId: personalRecord.id,
    personalReportInputHash: personalRecord.inputHash ?? null,
    personalReportPromptVersion: personalRecord.promptVersion ?? null,
    matchAnalysisId: fitResult.id,
    matchAnalysisInputHash: matchRow?.input_hash ?? null,
    matchAnalysisPromptVersion: matchRow?.prompt_version ?? null,
    matchAnalysisF5EngineVersion: matchRow?.f5_engine_version ?? null,
    programme: programmeInput,
    achievements: achievements ?? [],
    activities: activities ?? [],
    model: modelName,
    promptVersions: PROMPT_VERSIONS,
  });

  // Idempotency / cache check
  const { data: latestStrategy } = await supabase
    .from('application_strategy_recommendations')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Primary signal: content hash over ALL canonical inputs (requires
  // supabase-strategy-recommendation-lineage.sql). Fallback: exact source
  // lineage — BOTH ids and the prompt version must match a non-null value, so
  // a legacy row without lineage can only miss the cache, never stale-hit it.
  const latestHashMatches =
    typeof latestStrategy?.input_hash === 'string' &&
    latestStrategy.input_hash.length > 0 &&
    latestStrategy.input_hash === inputHash;
  const latestLineageMatches =
    !!latestStrategy &&
    latestStrategy.source_match_analysis_id === fitResult.id &&
    latestStrategy.source_personal_report_version_id === personalRecord.id &&
    PROMPT_VERSIONS.includes(String(latestStrategy.prompt_version));

  if (latestStrategy && (latestHashMatches || latestLineageMatches)) {
    logger.info('strategy_recommendation_generate', {
      userId: user.id,
      applicationId,
      stage: 'cache_hit',
      outcome: 'cached',
      cached: true,
      inputHash,
      durationMs: getElapsed(),
    });
    return NextResponse.json({
      recommendation: strategyRecommendationFromRow(latestStrategy),
      reportV2: strategyReportV2FromRow(latestStrategy),
      cached: true,
    });
  }

  // ─── Generation: five-section F8 (v3) first, legacy F7 as degraded fallback.
  let result;
  let usedPromptVersion = STRATEGY_REPORT_V2_PROMPT_VERSION;
  try {
    result = await generateStrategyReportV2({
      personalReport: personalRecord.reportV2,
      fit: fitResult.fit,
      programme: programmeInput,
      achievements: achievements ?? [],
      activities: activities ?? [],
      apiKey,
      model: modelName,
    });
  } catch (v2Err) {
    logger.error('strategy_recommendation_generate', v2Err, {
      userId: user.id,
      applicationId,
      stage: 'generated',
      metadata: { detail: 'f8-v3 generation failed — falling back to legacy prompt' },
      durationMs: getElapsed(),
    });

    try {
      result = await generateStrategyRecommendation({
        personalReport: personalRecord.reportV2,
        fit: fitResult.fit,
        programme: programmeInput,
        achievements: achievements ?? [],
        activities: activities ?? [],
        apiKey,
        model: modelName,
      });
      usedPromptVersion = STRATEGY_RECOMMENDATION_PROMPT_VERSION;
    } catch (legacyErr) {
      logger.error('strategy_recommendation_generate', legacyErr, {
        userId: user.id,
        applicationId,
        stage: 'generated',
        durationMs: getElapsed(),
      });
      return NextResponse.json({ error: 'Strategy generation failed. Please try again.' }, { status: 502 });
    }
  }

  const isV2 = usedPromptVersion === STRATEGY_REPORT_V2_PROMPT_VERSION;

  const payload: Record<string, unknown> = {
    application_id: applicationId,
    user_id: user.id,
    // Legacy column keeps its original applicant_analyses semantics — a
    // personal-report-version id written here violates its FK (23503) on
    // every insert. Personal-report lineage goes in its own typed column.
    source_match_analysis_id: fitResult.id,
    model_name: modelName,
    prompt_version: usedPromptVersion,
    input_hash: inputHash,
    source_personal_report_version_id: personalRecord.id,
  };
  if (isV2) {
    payload.report_v2 = result;
  } else {
    const legacy = result as Awaited<ReturnType<typeof generateStrategyRecommendation>>;
    Object.assign(payload, {
      direction_options: legacy.directionOptions,
      chosen_direction: legacy.chosenDirection,
      chosen_direction_why: legacy.chosenDirectionWhy,
      narrative: legacy.narrative,
      positioning_before: legacy.positioningBefore,
      positioning_after: legacy.positioningAfter,
      positioning_rationale: legacy.positioningRationale,
      portfolio_evaluations: legacy.portfolioEvaluations,
      differentiation_insight: legacy.differentiationInsight,
      differentiation_proposal: legacy.differentiationProposal,
      roadmap: legacy.roadmap,
    });
  }

  let { data: inserted, error: insErr } = await supabase
    .from('application_strategy_recommendations')
    .insert(payload)
    .select()
    .single();

  // Degraded mode A: the report_v2 column hasn't been applied yet — regenerate
  // with the legacy prompt and save the pre-F8 shape so generation never dies
  // on a pending migration.
  if (
    isV2 &&
    insErr &&
    ['42P01', '42703', 'PGRST204'].includes(insErr.code ?? '') &&
    /report_v2/i.test(insErr.message ?? '')
  ) {
    logger.error('strategy_recommendation_generate', insErr, {
      userId: user.id,
      applicationId,
      stage: 'persisted',
      metadata: { detail: 'report_v2 column unavailable — falling back to legacy shape' },
      durationMs: getElapsed(),
    });
    try {
      const legacy = await generateStrategyRecommendation({
        personalReport: personalRecord.reportV2,
        fit: fitResult.fit,
        programme: programmeInput,
        achievements: achievements ?? [],
        activities: activities ?? [],
        apiKey,
        model: modelName,
      });
      usedPromptVersion = STRATEGY_RECOMMENDATION_PROMPT_VERSION;
      delete payload.report_v2;
      Object.assign(payload, {
        direction_options: legacy.directionOptions,
        chosen_direction: legacy.chosenDirection,
        chosen_direction_why: legacy.chosenDirectionWhy,
        narrative: legacy.narrative,
        positioning_before: legacy.positioningBefore,
        positioning_after: legacy.positioningAfter,
        positioning_rationale: legacy.positioningRationale,
        portfolio_evaluations: legacy.portfolioEvaluations,
        differentiation_insight: legacy.differentiationInsight,
        differentiation_proposal: legacy.differentiationProposal,
        roadmap: legacy.roadmap,
      });
      ({ data: inserted, error: insErr } = await supabase
        .from('application_strategy_recommendations')
        .insert(payload)
        .select()
        .single());
    } catch (fallbackErr) {
      logger.error('strategy_recommendation_generate', fallbackErr, {
        userId: user.id,
        applicationId,
        stage: 'generated',
        durationMs: getElapsed(),
      });
      return NextResponse.json({ error: 'Strategy generation failed. Please try again.' }, { status: 502 });
    }
  }

  // Degraded mode B: lineage columns unavailable or a constraint rejected one.
  // Retry once without them; cache lookups then simply miss until the lineage
  // migration runs — the same cost as pre-cache behaviour, never a false hit.
  if (insErr && ['42P01', '42703', 'PGRST204', '23503'].includes(insErr.code ?? '')) {
    const degradeReason = insErr.code ?? 'unknown';
    const legacyPayload = { ...payload } as Record<string, unknown>;
    delete legacyPayload.input_hash;
    delete legacyPayload.source_personal_report_version_id;
    const retry = await supabase
      .from('application_strategy_recommendations')
      .insert(legacyPayload)
      .select()
      .single();
    if (!retry.error) {
      inserted = retry.data;
      insErr = null;
      logger.warn('strategy_recommendation_generate', {
        userId: user.id,
        applicationId,
        stage: 'persisted',
        outcome: 'migration_missing',
        metadata: {
          detail: `lineage columns unavailable (${degradeReason}) — saved without idempotency key`,
        },
        durationMs: getElapsed(),
      });
    }
  }

  if (insErr) {
    logger.error('strategy_recommendation_generate', insErr, {
      userId: user.id,
      applicationId,
      stage: 'persisted',
      durationMs: getElapsed(),
    });
    return NextResponse.json(
      { error: 'Could not save your strategy. If this persists, the database migration may be missing.' },
      { status: 500 },
    );
  }

  logger.info('strategy_recommendation_generate', {
    userId: user.id,
    applicationId,
    stage: 'completed',
    outcome: 'success',
    durationMs: getElapsed(),
    modelName,
    promptVersion: usedPromptVersion,
    inputHash,
  });

  return NextResponse.json({
    recommendation: strategyRecommendationFromRow(inserted),
    reportV2: strategyReportV2FromRow(inserted),
  });
}

