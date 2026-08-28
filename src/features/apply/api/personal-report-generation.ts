import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildPersonalReport,
  PERSONAL_REPORT_CONTRACT_VERSION,
  type PersonalReportTrigger,
} from '../domain';
import { buildPersonalCanvasDetails } from '../domain/personal-canvas-details';
import {
  applyPersonalReportSupplements,
  buildProfileEvaluationInput,
  PERSONAL_REPORT_EXTRACTION_VERSION,
} from '@/lib/ai/personal-report-v2';
import { isOpenAIConfigured } from '@/lib/ai/openai-client';
import { applyNarrativeSynthesis, synthesizePersonalReportNarrative } from '@/lib/ai/personal-report-narrative-synthesis';
import {
  ENGINE_VERSION,
  runProfileEvaluation,
  shouldRegenerate,
  type ProfileEvaluation,
  type ProfileEvaluationInput,
} from '@/shared/evaluation';
import { candidateContextHash, loadCandidateContext, stableHash } from './candidate-context';
import {
  buildApplicantStateFromSnapshot,
  candidateContextFromState,
  SnapshotNotFoundError,
} from '@/lib/ai/applicant-state/context-builder';
import type { ApplicantAIState } from '@/lib/ai/applicant-state/domain';
import { buildEvidenceBank } from '@/shared/evidence/build-evidence-bank';
import type { EvidenceBank } from '@/shared/evidence/domain';
import {
  getLatestApplicationProfileAnalysis,
  saveApplicationProfileAnalysis,
} from './application-analysis-repository';
import {
  createPersonalReportV2Version,
  findPersonalReportV2ByCacheKey,
  getApplicationPersonalReportSupplements,
  getLatestApplicationPersonalReportV2,
  getLatestPersonalReportV2,
  getPersonalReportSupplements,
} from './personal-report-v2-repository';
import type {
  ApplicationPersonalReportV2Record,
  PersonalReportV2Record,
} from './personal-report-v2-repository';
import { randomUUID } from 'node:crypto';
import { REPORT_PROMPT_VERSIONS } from '@/lib/ai/runtime/prompt-registry';

/**
 * The one place that decides whether the Personal Report needs a new
 * version and, if so, produces it. Called from two places: the report
 * page's own "Create report" / answer-a-question actions
 * (`trigger: 'manual'` / `'supplement_answer'`), and — new — right after a
 * Matching Report finishes generating (`trigger: 'matching_report'`), so
 * the two reports stay in step without a student having to visit the
 * Personal Report page and click anything.
 *
 * No time-based cooldown: regeneration is gated purely on whether the
 * input actually changed (`shouldRegenerate`, checked before any AI call is
 * made, so an unchanged profile costs nothing extra when this runs
 * opportunistically alongside a Matching Report). The previous 24h
 * free-tier cooldown was built around a manual "regenerate" button; once
 * per-application onboarding made editing achievements/reflections
 * possible again for every new application, students kept tripping that
 * wall on unrelated applications and the report would silently stop
 * updating — see `known-issues.md` for the incident this replaced.
 */
export type RegeneratePersonalReportResult =
  | { status: 'cached'; record: PersonalReportV2Record }
  | { status: 'regenerated'; record: PersonalReportV2Record }
  | { status: 'snapshot_missing' }
  | { status: 'insufficient_evidence' }
  | { status: 'migration_missing' }
  | { status: 'not_configured' }
  | { status: 'error'; message: string; record: PersonalReportV2Record | null };

type RegeneratePersonalReportArgs = {
  supabase: SupabaseClient;
  userId: string;
  applicationId?: string;
  trigger: PersonalReportTrigger;
  force?: boolean;
  idempotencyKey?: string;
};

import { logger, startTimer } from '@/server/observability';

const ANALYSIS_MODULE_VERSIONS = {
  applicantState: 'applicant-state-v1',
  reflection: 'reflection-analysis-v1',
  evidence: 'eb-v1',
  extraction: PERSONAL_REPORT_EXTRACTION_VERSION,
} as const;

type StoredAnalysisOutputs = {
  evaluation?: ProfileEvaluation;
  evaluationInput?: ProfileEvaluationInput;
};

function reportRecord(args: {
  id: string;
  generatedAt: string;
  reportV2: PersonalReportV2Record['reportV2'];
  evaluation: ProfileEvaluation;
  inputHash: string;
  modelName: string;
  trigger: PersonalReportTrigger;
  applicationId: string;
  confirmedSnapshotId: string;
  sourceAnalysisVersionId: string;
  cacheKey: string;
}): ApplicationPersonalReportV2Record {
  return {
    id: args.id,
    reportV2: args.reportV2,
    evaluation: args.evaluation,
    inputHash: args.inputHash,
    engineVersion: ENGINE_VERSION,
    promptVersion: PERSONAL_REPORT_EXTRACTION_VERSION,
    modelName: args.modelName,
    trigger: args.trigger,
    generatedAt: args.generatedAt,
    createdAt: args.generatedAt,
    applicationId: args.applicationId,
    confirmedSnapshotId: args.confirmedSnapshotId,
    sourceAnalysisVersionId: args.sourceAnalysisVersionId,
    reportContractVersion: PERSONAL_REPORT_CONTRACT_VERSION,
    cacheKey: args.cacheKey,
  };
}

function stateEvidenceBank(
  state: ApplicantAIState,
  supplements: Record<string, string>,
  interpretations: EvidenceBank['interpretations'],
): EvidenceBank {
  const activities = [...state.achievements, ...state.activities].map((item) => {
    const prefix = item.id.startsWith('achievement:') ? 'achievement:' : 'activity:';
    return {
      id: item.id.slice(prefix.length),
      kind: prefix === 'achievement:' ? ('achievement' as const) : ('activity' as const),
      title: item.title,
      freeText: item.freeText,
      evidenceKey: item.evidenceKey ?? null,
      metadata: {
        organisation: item.organisation ?? null,
        level: item.level ?? null,
        year: item.year ?? null,
        period: item.period ?? null,
        competition: item.competition ?? null,
        reviewStatus: item.reviewStatus ?? null,
        sourceType: item.sourceType ?? null,
        sources: item.sources ?? [],
        reflection: item.reflection ?? null,
        reflectionCard: item.reflectionCard ?? null,
      },
    };
  });
  const documents = state.evidenceBank
    .filter((item) => item.kind === 'document')
    .map((item) => {
      const raw = (item.raw ?? {}) as { id?: unknown; fileName?: unknown; storageKey?: unknown };
      return {
        id: typeof raw.id === 'string' ? raw.id : item.id.slice('document:'.length),
        fileName: typeof raw.fileName === 'string' ? raw.fileName : item.label,
        storageKey: typeof raw.storageKey === 'string' ? raw.storageKey : null,
      };
    });
  const followUpAnswers = state.activities.flatMap((item) => item.followUpAnswers ?? []);
  const profileFields = Object.fromEntries(
    state.evidenceBank
      .filter((item) => item.kind === 'profile')
      .map((item) => [item.id.slice('profile:'.length), item.raw]),
  );

  return buildEvidenceBank({
    academicRecords: state.academicProfile?.records ?? [],
    activities,
    followUpAnswers,
    documents,
    supplements: Object.entries(supplements).map(([fieldKey, answer]) => ({ fieldKey, answer })),
    profileFields,
    interpretations,
  });
}

function interpretationsFromEvaluationInput(
  input: ProfileEvaluationInput,
): EvidenceBank['interpretations'] {
  return [
    ...(input.reflectionRecords ?? []).map((record) => ({
      id: `cmcaitf:${record.id}`,
      origin: 'ai_extraction' as const,
      module: 'cmcaitf_extraction',
      payload: record.cmcaitf,
      sourceRefs: [record.id],
    })),
    ...(input.competencyClaims ?? []).map((claim) => ({
      id: `competency:${claim.id}`,
      origin: 'ai_extraction' as const,
      module: 'competency_extraction',
      payload: claim,
      sourceRefs: claim.evidenceRefs.map((ref) => ref.id),
    })),
    ...(input.narrativeActivities ?? []).map((activity) => ({
      id: `narrative:${activity.id}`,
      origin: 'ai_extraction' as const,
      module: 'narrative_activity_extraction',
      payload: { role: activity.role, domainTheme: activity.domainTheme },
      sourceRefs: [activity.id],
    })),
  ];
}

function reusableAnalysis(
  analysis: Awaited<ReturnType<typeof getLatestApplicationProfileAnalysis>>,
  snapshotId: string,
  inputHash: string,
): analysis is NonNullable<typeof analysis> & { id: string; evidenceBank: EvidenceBank } {
  if (!analysis || analysis.confirmedSnapshotId !== snapshotId || analysis.inputHash !== inputHash) return false;
  const moduleVersions = analysis.moduleVersions;
  if (
    Object.keys(ANALYSIS_MODULE_VERSIONS).some(
      (key) => moduleVersions[key] !== ANALYSIS_MODULE_VERSIONS[key as keyof typeof ANALYSIS_MODULE_VERSIONS],
    ) || Object.keys(moduleVersions).length !== Object.keys(ANALYSIS_MODULE_VERSIONS).length
  ) {
    return false;
  }
  const outputs = analysis.structuredOutputs as StoredAnalysisOutputs;
  return Boolean(
    outputs.evaluation &&
      outputs.evaluationInput &&
      analysis.evidenceBank &&
      Array.isArray((analysis.evidenceBank as EvidenceBank).claims),
  );
}

async function regenerateApplicationPersonalReport(
  args: Required<Pick<RegeneratePersonalReportArgs, 'applicationId'>> &
    Omit<RegeneratePersonalReportArgs, 'applicationId'>,
): Promise<RegeneratePersonalReportResult> {
  const { supabase, userId, applicationId, trigger, force = false, idempotencyKey } = args;
  const getElapsed = startTimer();
  logger.info('personal_report_generate', {
    userId,
    applicationId,
    trigger,
    stage: 'started',
    outcome: 'started',
  });

  let state: ApplicantAIState;
  try {
    state = await buildApplicantStateFromSnapshot({ supabase, userId, applicationId });
  } catch (error) {
    if (error instanceof SnapshotNotFoundError) {
      logger.warn('personal_report_generate', {
        userId,
        applicationId,
        trigger,
        stage: 'validated',
        outcome: 'not_ready',
        durationMs: getElapsed(),
      });
      return { status: 'snapshot_missing' };
    }
    throw error;
  }

  const [latest, latestAnalysis, supplements] = await Promise.all([
    getLatestApplicationPersonalReportV2(supabase, { userId, applicationId }),
    getLatestApplicationProfileAnalysis(supabase, { userId, applicationId }),
    getApplicationPersonalReportSupplements(supabase, { userId, applicationId }),
  ]);
  if (latest.migrationMissing) {
    logger.warn('personal_report_generate', {
      userId,
      applicationId,
      trigger,
      stage: 'validated',
      outcome: 'migration_missing',
      durationMs: getElapsed(),
    });
    return { status: 'migration_missing' };
  }

  const context = applyPersonalReportSupplements(candidateContextFromState(state), supplements);
  const inputHash = stableHash({
    snapshotId: state.snapshotId,
    context,
    academicRecords: state.academicProfile?.records ?? [],
    followUpAnswers: state.activities.flatMap((item) => item.followUpAnswers ?? []),
    supplements,
  });
  const baseCacheKey = stableHash({
    applicationId,
    snapshotId: state.snapshotId,
    inputHash,
    engineVersion: ENGINE_VERSION,
    promptVersion: PERSONAL_REPORT_EXTRACTION_VERSION,
    narrativePromptVersion: REPORT_PROMPT_VERSIONS.report_narrative_synthesis,
    reportContractVersion: PERSONAL_REPORT_CONTRACT_VERSION,
  });
  const cacheKey = idempotencyKey
    ? stableHash({ baseCacheKey, idempotencyKey })
    : force
      ? stableHash({ baseCacheKey, forceNonce: randomUUID() })
      : baseCacheKey;

  if (idempotencyKey) {
    const idempotent = await findPersonalReportV2ByCacheKey(
      supabase,
      { userId, applicationId },
      cacheKey,
    );
    if (idempotent.record) return { status: 'cached', record: idempotent.record };
  }
  const current = latest.record;
  const currentMatches = Boolean(
    current &&
      current.applicationId === applicationId &&
      current.confirmedSnapshotId === state.snapshotId &&
      current.inputHash === inputHash &&
      current.engineVersion === ENGINE_VERSION &&
      current.promptVersion === PERSONAL_REPORT_EXTRACTION_VERSION &&
      current.reportContractVersion === PERSONAL_REPORT_CONTRACT_VERSION &&
      current.cacheKey === baseCacheKey,
  );
  if (current && !force && currentMatches) {
    return { status: 'cached', record: current };
  }

  let evaluation: ProfileEvaluation;
  let evaluationInput: ProfileEvaluationInput;
  let evidenceBank: EvidenceBank;
  let sourceAnalysisVersionId: string;

  if (reusableAnalysis(latestAnalysis, state.snapshotId, inputHash)) {
    const outputs = latestAnalysis.structuredOutputs as StoredAnalysisOutputs;
    evaluation = outputs.evaluation!;
    evaluationInput = outputs.evaluationInput!;
    evidenceBank = latestAnalysis.evidenceBank;
    sourceAnalysisVersionId = latestAnalysis.id;
  } else {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !isOpenAIConfigured()) {
      return { status: 'not_configured' };
    }

    try {
      const generatedAt = new Date().toISOString();
      evaluationInput = await buildProfileEvaluationInput({
        context,
        subjectId: userId,
        generatedAt,
        apiKey,
      });
      evaluation = runProfileEvaluation(evaluationInput);
      evidenceBank = stateEvidenceBank(
        state,
        supplements,
        interpretationsFromEvaluationInput(evaluationInput),
      );
    } catch (error) {
      logger.error('personal_report_generate', error, {
        userId,
        applicationId,
        trigger,
        stage: 'failed',
        outcome: 'extractor_failed',
        durationMs: getElapsed(),
      });
      return {
        status: 'error',
        message: 'The AI could not produce a valid report. Your previous report, if any, has been kept.',
        record: current,
      };
    }

    const savedAnalysis = await saveApplicationProfileAnalysis(supabase, {
      userId,
      applicationId,
      confirmedSnapshotId: state.snapshotId,
      inputHash,
      moduleVersions: ANALYSIS_MODULE_VERSIONS,
      structuredOutputs: { evaluation, evaluationInput },
      evidenceBank,
      generationMetadata: { trigger, engineVersion: ENGINE_VERSION },
    });
    if (!savedAnalysis.versionId) {
      return savedAnalysis.migrationMissing
        ? { status: 'migration_missing' }
        : { status: 'error', message: 'Could not save the application analysis.', record: current };
    }
    sourceAnalysisVersionId = savedAnalysis.versionId;
  }

  const generatedAt = new Date().toISOString();
  const deterministicReport = buildPersonalReport({
    evaluation,
    activities: evaluationInput.narrativeActivities,
    intendedDirection: evaluationInput.intendedDirection,
    generatedAt,
    evidenceBank,
  });
  if (
    !deterministicReport.coreIdentity.available &&
    !deterministicReport.drivingForce.available &&
    !deterministicReport.signaturePattern.available &&
    !deterministicReport.emergingThemes.available &&
    !deterministicReport.personalPositioning.available &&
    !deterministicReport.proofOfMe.available
  ) {
    return { status: 'insufficient_evidence' };
  }
  const modelName = process.env.OPENAI_MODEL || 'gpt-4o';
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !isOpenAIConfigured()) return { status: 'not_configured' };
  let narrativeFailure = 'unknown';
  const synthesis = await synthesizePersonalReportNarrative({
    report: deterministicReport,
    intendedDirection: evaluationInput.intendedDirection,
    apiKey,
    model: modelName,
    grounding: { evaluationInput, evaluation, evidenceBank },
    onFailure: (code) => {
      narrativeFailure = code;
    },
  });
  if (!synthesis) {
    return {
      status: 'error',
      message: `Personal Report narrative generation failed (${narrativeFailure}). Generation will retry automatically.`,
      record: current,
    };
  }
  let reportV2 = applyNarrativeSynthesis(deterministicReport, synthesis);

  reportV2 = {
    ...reportV2,
    canvasDetails: buildPersonalCanvasDetails({
      activities: evaluationInput.narrativeActivities,
      coreIdentity: reportV2.coreIdentity,
      drivingForce: reportV2.drivingForce,
      emergingThemes: reportV2.emergingThemes,
      personalPositioning: reportV2.personalPositioning,
      proofOfMe: reportV2.proofOfMe,
      intendedDirection: evaluationInput.intendedDirection,
      profileCapabilityClaims: (evaluation.competencies?.claims ?? [])
        .filter((claim) => claim.evidenceRefs.some((ref) => ref.kind === 'profile_reflection'))
        .map((claim) => ({ label: claim.label, evidenceRefs: claim.evidenceRefs })),
    }),
  } as PersonalReportV2Record['reportV2'];

  const inserted = await createPersonalReportV2Version(supabase, {
    userId,
    applicationId,
    confirmedSnapshotId: state.snapshotId,
    sourceAnalysisVersionId,
    reportContractVersion: PERSONAL_REPORT_CONTRACT_VERSION,
    cacheKey,
    reportV2,
    evaluation,
    inputHash,
    engineVersion: ENGINE_VERSION,
    promptVersion: PERSONAL_REPORT_EXTRACTION_VERSION,
    modelName,
    trigger,
  });
  if (inserted.error || !inserted.record) {
    if (inserted.error?.migrationMissing) return { status: 'migration_missing' };
    return { status: 'error', message: 'Could not save the report.', record: current };
  }

  const record = reportRecord({
    id: inserted.record.id,
    generatedAt: inserted.record.generatedAt,
    reportV2,
    evaluation,
    inputHash,
    modelName,
    trigger,
    applicationId,
    confirmedSnapshotId: state.snapshotId,
    sourceAnalysisVersionId,
    cacheKey,
  });
  logger.info('personal_report_generate', {
    userId,
    applicationId,
    trigger,
    stage: 'completed',
    outcome: 'success',
    durationMs: getElapsed(),
    cached: false,
  });
  return { status: 'regenerated', record };
}

export async function regeneratePersonalReport(
  args: RegeneratePersonalReportArgs,
): Promise<RegeneratePersonalReportResult> {
  return args.applicationId
    ? regenerateApplicationPersonalReport(args as Required<Pick<RegeneratePersonalReportArgs, 'applicationId'>> & Omit<RegeneratePersonalReportArgs, 'applicationId'>)
    : regenerateLegacyPersonalReport(args);
}

async function regenerateLegacyPersonalReport(
  args: Pick<RegeneratePersonalReportArgs, 'supabase' | 'userId' | 'trigger'>,
): Promise<RegeneratePersonalReportResult> {
  const { supabase, userId, trigger } = args;
  const getElapsed = startTimer();

  logger.info('personal_report_generate', {
    userId,
    trigger,
    stage: 'started',
    outcome: 'started',
  });

  const [rawContext, latest, supplements] = await Promise.all([
    loadCandidateContext(supabase, userId),
    getLatestPersonalReportV2(supabase, userId),
    getPersonalReportSupplements(supabase, userId),
  ]);
  if (latest.migrationMissing) {
    logger.warn('personal_report_generate', {
      userId,
      stage: 'validated',
      outcome: 'migration_missing',
      trigger,
      durationMs: getElapsed(),
    });
    return { status: 'migration_missing' };
  }

  // Report-only answers overlay the profile for this generation only — see
  // `applyPersonalReportSupplements`'s own doc comment for why they never
  // touch `student_profiles` itself. Hashed as part of the effective
  // context so answering one is enough to trigger a regeneration.
  const context = applyPersonalReportSupplements(rawContext, supplements);
  const inputHash = candidateContextHash(context);
  const current = latest.record;
  const extractionChanged = Boolean(current && current.promptVersion !== PERSONAL_REPORT_EXTRACTION_VERSION);
  const regenerate =
    shouldRegenerate(
      { inputHash },
      current ? { inputHash: current.inputHash, engineVersion: current.engineVersion ?? '' } : null,
    ) || extractionChanged;

  if (current && !regenerate) {
    logger.info('personal_report_generate', {
      userId,
      stage: 'cache_hit',
      outcome: 'cached',
      cached: true,
      inputHash,
      trigger,
      durationMs: getElapsed(),
    });
    return { status: 'cached', record: current };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !isOpenAIConfigured()) {
    logger.warn('personal_report_generate', {
      userId,
      stage: 'validated',
      outcome: 'not_configured',
      trigger,
      durationMs: getElapsed(),
    });
    return { status: 'not_configured' };
  }

  try {
    const generatedAt = new Date().toISOString();
    const evaluationInput = await buildProfileEvaluationInput({
      context,
      subjectId: userId,
      generatedAt,
      apiKey,
    });
    const evaluation = runProfileEvaluation(evaluationInput);
    const deterministicReport = buildPersonalReport({
      evaluation,
      activities: evaluationInput.narrativeActivities,
      intendedDirection: evaluationInput.intendedDirection,
      generatedAt,
    });

    const modelName = process.env.OPENAI_MODEL || 'gpt-4o';
    const synthesis = await synthesizePersonalReportNarrative({
      report: deterministicReport,
      intendedDirection: evaluationInput.intendedDirection,
      apiKey,
      model: modelName,
      grounding: { evaluationInput, evaluation, evidenceBank: null },
    });
    if (!synthesis) {
      return {
        status: 'error',
        message: 'The AI could not produce a complete evidence-grounded report.',
        record: current,
      };
    }
    const synthesizedReport = applyNarrativeSynthesis(deterministicReport, synthesis);

    // Personal Canvas visual data is generated once and stored with this
    // append-only report version. The UI therefore never invents a new score
    // on render, and revisiting a historical report always shows the same
    // stars/bars/pathways that belonged to that snapshot.
    const reportV2 = {
      ...synthesizedReport,
      canvasDetails: buildPersonalCanvasDetails({
        activities: evaluationInput.narrativeActivities,
        coreIdentity: synthesizedReport.coreIdentity,
        drivingForce: synthesizedReport.drivingForce,
        emergingThemes: synthesizedReport.emergingThemes,
        personalPositioning: synthesizedReport.personalPositioning,
        proofOfMe: synthesizedReport.proofOfMe,
        intendedDirection: evaluationInput.intendedDirection,
        profileCapabilityClaims: (evaluation.competencies?.claims ?? [])
          .filter((claim) => claim.evidenceRefs.some((ref) => ref.kind === 'profile_reflection'))
          .map((claim) => ({ label: claim.label, evidenceRefs: claim.evidenceRefs })),
      }),
    };

    const { record: inserted, error } = await createPersonalReportV2Version(supabase, {
      userId,
      reportV2,
      evaluation,
      inputHash,
      engineVersion: ENGINE_VERSION,
      promptVersion: PERSONAL_REPORT_EXTRACTION_VERSION,
      modelName,
      trigger,
    });
    if (error || !inserted) {
      if (error?.migrationMissing) {
        logger.warn('personal_report_generate', {
          userId,
          stage: 'persisted',
          outcome: 'migration_missing',
          trigger,
          durationMs: getElapsed(),
        });
        return { status: 'migration_missing' };
      }
      logger.error('personal_report_generate', error, {
        userId,
        stage: 'persisted',
        trigger,
        inputHash,
        durationMs: getElapsed(),
      });
      return { status: 'error', message: 'Could not save the report.', record: current };
    }

    const durationMs = getElapsed();
    logger.info('personal_report_generate', {
      userId,
      stage: 'completed',
      outcome: 'success',
      durationMs,
      modelName,
      promptVersion: PERSONAL_REPORT_EXTRACTION_VERSION,
      engineVersion: ENGINE_VERSION,
      inputHash,
      trigger,
      cached: false,
    });

    return {
      status: 'regenerated',
      record: {
        id: inserted.id,
        reportV2,
        evaluation,
        inputHash,
        engineVersion: ENGINE_VERSION,
        promptVersion: PERSONAL_REPORT_EXTRACTION_VERSION,
        modelName,
        trigger,
        generatedAt: inserted.generatedAt,
        createdAt: inserted.generatedAt,
        // Lineage fields arrive with Task 8's application-scoped orchestrator;
        // the legacy global path keeps writing archive rows (all NULL).
        applicationId: null,
        confirmedSnapshotId: null,
        sourceAnalysisVersionId: null,
        reportContractVersion: null,
        cacheKey: null,
      },
    };
  } catch (error) {
    logger.error('personal_report_generate', error, {
      userId,
      stage: 'failed',
      trigger,
      inputHash,
      durationMs: getElapsed(),
    });
    return {
      status: 'error',
      message: 'The AI could not produce a valid report. Your previous report, if any, has been kept.',
      record: current,
    };
  }
}
