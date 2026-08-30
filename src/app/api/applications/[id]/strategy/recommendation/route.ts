import { NextResponse } from 'next/server';
import {
  strategyRecommendationFromRow,
  strategyReportV2FromRow,
} from '@/features/ai-strategy-dashboard/domain';
import { getApplicationProfileAnalysisVersion, getLatestApplicationPersonalReportV2, stableHash } from '@/features/apply/api';
import { buildApplicantStateFromSnapshot } from '@/lib/ai/applicant-state/context-builder';
import { matchingReportV3Schema } from '@/lib/ai/matching/domain';
import { defaultOpenAIModel } from '@/lib/ai/openai-client';
import { getReportPrompt } from '@/lib/ai/runtime/prompt-registry';
import { getTargetProfileVersion } from '@/lib/ai/target-profile/repository';
import { buildStrategyInputContext, withStrategyLineage } from '@/lib/ai/strategy-v3/context';
import {
  STRATEGY_ENGINE_V3_VERSION,
  STRATEGY_REPORT_V3_CONTRACT_VERSION,
  strategyReportV3FromRow,
} from '@/lib/ai/strategy-v3/domain';
import { generateStrategyReportV3, StrategyGenerationError } from '@/lib/ai/strategy-v3/engine';
import { createClient } from '@/lib/supabase/server';
import { logger, startTimer } from '@/server/observability';

export const runtime = 'nodejs';
export const maxDuration = 120;

async function loadApplication(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applicationId: string,
  userId: string,
) {
  const { data } = await supabase
    .from('course_applications')
    .select(
      'id,user_id,university_name,course_name,subject,degree_level,university_id,course_id,country,intake,status,deadline,courses(*)',
    )
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  return data as Record<string, unknown> | null;
}

function rows(value: unknown): Record<string, unknown>[] {
  return (Array.isArray(value) ? value : value ? [value] : []) as Record<string, unknown>[];
}

async function loadCurrentMatching(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applicationId: string,
  userId: string,
  personalReportVersionId: string,
  confirmedSnapshotId: string,
) {
  const result = await supabase
    .from('application_match_analyses')
    .select('id,application_id,user_id,analysis_status,input_hash,report_v2,created_at')
    .eq('application_id', applicationId)
    .eq('user_id', userId)
    .eq('analysis_status', 'complete')
    .order('created_at', { ascending: false })
    .limit(20);
  if (result.error) return null;

  for (const row of rows(result.data)) {
    const parsed = matchingReportV3Schema.safeParse(row.report_v2);
    if (!parsed.success) continue;
    if (parsed.data.metadata.personalReportVersionId !== personalReportVersionId) continue;
    if (parsed.data.metadata.confirmedSnapshotId !== confirmedSnapshotId) continue;
    return { row, report: parsed.data };
  }
  return null;
}

async function loadStrategyRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applicationId: string,
) {
  const result = await supabase
    .from('application_strategy_recommendations')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(20);
  return result.error ? [] : rows(result.data);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await loadApplication(supabase, applicationId, user.id))) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const strategyRows = await loadStrategyRows(supabase, applicationId);
  const reportV3 = strategyRows.map(strategyReportV3FromRow).find(Boolean) ?? null;
  const reportV2 = strategyRows.map(strategyReportV2FromRow).find(Boolean) ?? null;
  const recommendation = strategyRows.map(strategyRecommendationFromRow).find(Boolean) ?? null;
  return NextResponse.json({ reportV3, reportV2, recommendation });
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const getElapsed = startTimer();
  const { id: applicationId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const application = await loadApplication(supabase, applicationId, user.id);
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const personalResult = await getLatestApplicationPersonalReportV2(supabase, {
    userId: user.id,
    applicationId,
  });
  const personalRecord = personalResult.record;
  if (!personalRecord?.confirmedSnapshotId) return missingInputs(applicationId, user.id, getElapsed());

  const matching = await loadCurrentMatching(
    supabase,
    applicationId,
    user.id,
    personalRecord.id,
    personalRecord.confirmedSnapshotId,
  );
  if (!matching) return missingInputs(applicationId, user.id, getElapsed());

  let snapshotState;
  try {
    snapshotState = await buildApplicantStateFromSnapshot({
      supabase,
      userId: user.id,
      applicationId,
      snapshotId: personalRecord.confirmedSnapshotId,
    });
  } catch {
    return missingInputs(applicationId, user.id, getElapsed());
  }

  const sourceAnalysisVersionId = matching.report.metadata.sourceAnalysisVersionId || personalRecord.sourceAnalysisVersionId;
  const sourceAnalysis = sourceAnalysisVersionId
    ? (await getApplicationProfileAnalysisVersion(
        supabase,
        { userId: user.id, applicationId },
        sourceAnalysisVersionId,
      )).analysis
    : null;
  if (
    sourceAnalysisVersionId &&
    (!sourceAnalysis || sourceAnalysis.confirmedSnapshotId !== personalRecord.confirmedSnapshotId)
  ) {
    return missingInputs(applicationId, user.id, getElapsed());
  }
  const programmeId = stringValue(application.course_id) ?? stringValue(record(application.courses).id);
  const targetProfile = matching.report.metadata.targetProfileVersionId && programmeId
    ? await getTargetProfileVersion(supabase, {
        programmeId,
        versionId: matching.report.metadata.targetProfileVersionId,
      })
    : null;

  const baseContext = buildStrategyInputContext({
    applicationId,
    application,
    personalReport: personalRecord.reportV2,
    matching: matching.report,
    snapshotState,
    sourceAnalysis,
    targetProfile: targetProfile ? { id: targetProfile.id, profile: targetProfile.profile } : null,
  });
  const contextWithLineage = withStrategyLineage(baseContext, {
    personalReportVersionId: personalRecord.id,
    personalReportInputHash: personalRecord.inputHash ?? null,
    sourceAnalysisVersionId,
    confirmedSnapshotId: personalRecord.confirmedSnapshotId,
    matchingReportId: String(matching.row.id),
    matchingInputHash: stringValue(matching.row.input_hash),
    matchingContractVersion: matching.report.contractVersion,
    matchingEngineVersion: matching.report.metadata.matchingEngineVersion,
    targetProfileVersionId: targetProfile?.id ?? matching.report.metadata.targetProfileVersionId ?? null,
    selectedScholarshipVersionId: matching.report.metadata.selectedScholarshipVersionId ?? null,
  });
  const modelName = process.env.OPENAI_MODEL || defaultOpenAIModel();
  const promptVersions = [
    getReportPrompt('strategy_profile_diagnosis').version,
    getReportPrompt('strategy_activity_analysis').version,
    getReportPrompt('strategy_report_synthesis').version,
  ];
  const inputHash = stableHash({ context: contextWithLineage, model: modelName, promptVersions });

  // Exact V3 cache resolution deliberately happens before API-key validation.
  const strategyRows = await loadStrategyRows(supabase, applicationId);
  const cached = strategyRows.find((row) => {
    const report = strategyReportV3FromRow(row);
    return Boolean(
      report &&
        row.input_hash === inputHash &&
        report.metadata.personalReportVersionId === personalRecord.id &&
        report.metadata.matchingReportId === String(matching.row.id),
    );
  });
  if (cached) {
    logger.info('strategy_recommendation_generate', {
      userId: user.id,
      applicationId,
      stage: 'cache_hit',
      outcome: 'cached',
      cached: true,
      inputHash,
      durationMs: getElapsed(),
    });
    return NextResponse.json({ reportV3: strategyReportV3FromRow(cached), reportV2: null, recommendation: null, cached: true });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('strategy_recommendation_generate', {
      userId: user.id,
      applicationId,
      stage: 'validated',
      outcome: 'not_configured',
      durationMs: getElapsed(),
    });
    return NextResponse.json({ error: 'AI service not configured', code: 'strategy_v3_not_configured' }, { status: 500 });
  }

  logger.info('strategy_recommendation_generate', {
    userId: user.id,
    applicationId,
    stage: 'started',
    outcome: 'started',
  });
  let report;
  try {
    report = await generateStrategyReportV3({ context: contextWithLineage, apiKey, model: modelName });
  } catch (error) {
    const code = error instanceof StrategyGenerationError ? error.code : 'invalid_output';
    logger.error('strategy_recommendation_generate', error, {
      userId: user.id,
      applicationId,
      stage: 'generated',
      metadata: { code },
      durationMs: getElapsed(),
    });
    return NextResponse.json(
      { error: 'Strategy generation failed. No partial report was saved.', code: `strategy_v3_${code}` },
      { status: 502 },
    );
  }

  const payload = {
    application_id: applicationId,
    user_id: user.id,
    source_match_analysis_id: matching.row.id,
    source_personal_report_version_id: personalRecord.id,
    model_name: modelName,
    prompt_version: getReportPrompt('strategy_report_synthesis').version,
    input_hash: inputHash,
    report_v2: report,
  };
  const insertedResult = await supabase
    .from('application_strategy_recommendations')
    .insert(payload)
    .select()
    .single();
  if (insertedResult.error || !insertedResult.data) {
    logger.error('strategy_recommendation_generate', insertedResult.error ?? new Error('No inserted row'), {
      userId: user.id,
      applicationId,
      stage: 'persisted',
      metadata: { contractVersion: STRATEGY_REPORT_V3_CONTRACT_VERSION, engineVersion: STRATEGY_ENGINE_V3_VERSION },
      durationMs: getElapsed(),
    });
    return NextResponse.json(
      { error: 'Could not save the Strategy Report. No fallback report was generated.', code: 'strategy_v3_persist_failed' },
      { status: 500 },
    );
  }

  logger.info('strategy_recommendation_generate', {
    userId: user.id,
    applicationId,
    stage: 'completed',
    outcome: 'success',
    modelName,
    inputHash,
    aiCallCount: report.metadata.aiCallCount,
    durationMs: getElapsed(),
  });
  return NextResponse.json({ reportV3: report, reportV2: null, recommendation: null });
}

function missingInputs(applicationId: string, userId: string, durationMs: number) {
  logger.warn('strategy_recommendation_generate', {
    userId,
    applicationId,
    stage: 'validated',
    outcome: 'missing_inputs',
    durationMs,
  });
  return NextResponse.json(
    {
      error: 'Generate the current Personal Report and Matching Report first — Strategy V3 requires the same confirmed inputs.',
      needsInputs: true,
      code: 'strategy_v3_missing_inputs',
    },
    { status: 422 },
  );
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
