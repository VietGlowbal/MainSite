import type { SupabaseClient } from '@supabase/supabase-js';
import { buildPersonalReport, type PersonalReportTrigger } from '../domain';
import { buildPersonalCanvasDetails } from '../domain/personal-canvas-details';
import {
  applyPersonalReportSupplements,
  buildProfileEvaluationInput,
  PERSONAL_REPORT_EXTRACTION_VERSION,
} from '@/lib/ai/personal-report-v2';
import { isOpenAIConfigured } from '@/lib/ai/openai-client';
import { applyNarrativeSynthesis, synthesizePersonalReportNarrative } from '@/lib/ai/personal-report-narrative-synthesis';
import { ENGINE_VERSION, runProfileEvaluation, shouldRegenerate } from '@/shared/evaluation';
import { candidateContextHash, loadCandidateContext } from './candidate-context';
import {
  createPersonalReportV2Version,
  getLatestPersonalReportV2,
  getPersonalReportSupplements,
} from './personal-report-v2-repository';
import type { PersonalReportV2Record } from './personal-report-v2-repository';

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
  | { status: 'migration_missing' }
  | { status: 'not_configured' }
  | { status: 'error'; message: string; record: PersonalReportV2Record | null };

import { logger, startTimer } from '@/server/observability';

export async function regeneratePersonalReport(args: {
  supabase: SupabaseClient;
  userId: string;
  trigger: PersonalReportTrigger;
}): Promise<RegeneratePersonalReportResult> {
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
    });
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
