import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getLatestApplicationMatchingAnalysis,
  getMatchingAnalysisByInputHash,
  saveApplicationMatchingAnalysis,
  saveApplicationAcademicAssessment,
  getApplicationProfileAnalysisVersion,
  stableHash,
  type MatchingAnalysisRecord,
} from '@/features/apply/api';
import { regeneratePersonalReport } from '@/features/apply/api/personal-report-generation';
import { resolveTargetProfile } from '@/lib/ai/target-profile/generation';
import {
  MATCHING_ENGINE_VERSION,
  MATCHING_PROMPT_BUNDLE_VERSION,
  MATCHING_ENGINE_V3_VERSION,
  MATCHING_PROMPT_BUNDLE_V3_VERSION,
  MATCHING_REPORT_V3_CONTRACT_VERSION,
  MATCHING_FORMULA_V3_VERSION,
  type MatchingReportV2,
  type MatchingReportV3,
} from './domain';
import { composeMatchingReport } from './report';
import { REPORT_PROMPT_VERSIONS } from '../runtime/prompt-registry';
import { TARGET_PROFILE_SCHEMA_VERSION } from '../target-profile/domain';
import {
  buildProgrammeFitPlaceholder,
  F5_ENGINE_VERSION,
} from '@/shared/evaluation/f5-programme-fit';
import { buildApplicantStateFromSnapshot } from '../applicant-state/context-builder';
import { defaultOpenAIModel, isOpenAIConfigured } from '../openai-client';
import { matchLabel, maxMatchLabel } from '@/lib/match-insights';
import type { EvidenceBank } from '@/shared/evidence/domain';
import { EVIDENCE_BANK_VERSION } from '@/shared/evidence/domain';
import { buildApplicantMatchingContext } from './applicant-context';

function isEvidenceBank(value: unknown): value is EvidenceBank {
  if (!value || typeof value !== 'object') return false;
  const bank = value as Partial<EvidenceBank>;
  return (
    bank.version === EVIDENCE_BANK_VERSION &&
    Array.isArray(bank.claims) &&
    Array.isArray(bank.interpretations) &&
    Array.isArray(bank.missingInformation) &&
    Boolean(bank.sources && typeof bank.sources === 'object')
  );
}

export async function generateApplicationMatchingReport(args: {
  supabase: SupabaseClient;
  userId: string;
  applicationId: string;
  force?: boolean;
  cooldownUntil?: string;
}): Promise<
  | { status: 'cached'; record: MatchingAnalysisRecord }
  | { status: 'regenerated'; record: MatchingAnalysisRecord; reusedCriterionIds: string[] }
  | { status: 'not_ready'; reason: string }
  | { status: 'migration_missing' }
  | { status: 'not_configured' }
  | { status: 'cooldown'; record: MatchingAnalysisRecord; nextRegenerationAt: string }
> {
  const { supabase, userId, applicationId, force = false, cooldownUntil } = args;

  const { data: application, error: appError } = await supabase
    .from('course_applications')
    .select('id, user_id, course_id')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .single();

  if (appError || !application) {
    return { status: 'not_ready', reason: 'Application not found or unauthorized' };
  }

  const migrationCheck = await getLatestApplicationMatchingAnalysis(
    supabase,
    { userId, applicationId },
    { analysisStatus: 'complete' },
  );
  if (migrationCheck.migrationMissing) return { status: 'migration_missing' };

  const personalRes = await regeneratePersonalReport({
    supabase,
    userId,
    applicationId,
    trigger: 'matching_report',
    force: false,
  });

  if (personalRes.status === 'migration_missing') return { status: 'migration_missing' };
  if (personalRes.status === 'not_configured') return { status: 'not_configured' };
  if (personalRes.status === 'error') throw new Error(personalRes.message);
  if (!('record' in personalRes) || !personalRes.record?.reportV2) {
    return { status: 'not_ready', reason: 'Personal report not ready' };
  }

  const personalRecord = personalRes.record;
  const { confirmedSnapshotId, sourceAnalysisVersionId } = personalRecord;
  if (!confirmedSnapshotId || !sourceAnalysisVersionId) {
    return { status: 'not_ready', reason: 'Personal report lineage is incomplete' };
  }

  const analysisRes = await getApplicationProfileAnalysisVersion(
    supabase,
    { userId, applicationId },
    sourceAnalysisVersionId
  );

  if (analysisRes.migrationMissing) return { status: 'migration_missing' };
  if (!analysisRes.analysis) {
    return { status: 'not_ready', reason: 'Source profile analysis version not found' };
  }

  const analysis = analysisRes.analysis;
  if (analysis.confirmedSnapshotId !== confirmedSnapshotId) {
    return { status: 'not_ready', reason: 'Source profile analysis snapshot does not match the report' };
  }
  if (analysis.moduleVersions.evidence !== EVIDENCE_BANK_VERSION || !isEvidenceBank(analysis.evidenceBank)) {
    return { status: 'not_ready', reason: 'Evidence Bank is missing or uses an unsupported version' };
  }
  if (typeof application.course_id !== 'string' || application.course_id.length === 0) {
    return { status: 'not_ready', reason: 'Application is not linked to a course' };
  }

  const targetRes = await resolveTargetProfile({
    supabase,
    userId,
    programmeId: application.course_id,
  });
  if ((targetRes.status !== 'ready' && targetRes.status !== 'cached' && targetRes.status !== 'stale') || !targetRes.profile) {
    return { status: 'not_ready', reason: 'Target profile not ready' };
  }

  const targetProfile = targetRes.profile;
  const targetProfileVersionId = targetRes.versionId;

  const inputHash = stableHash({
    confirmedSnapshotId: personalRecord.confirmedSnapshotId,
    sourceAnalysisVersionId,
    personalReportVersionId: personalRecord.id,
    personalReportInputHash: personalRecord.inputHash,
    targetProfileVersionId,
    targetProfileSchemaVersion: TARGET_PROFILE_SCHEMA_VERSION,
    evidenceBankVersion: EVIDENCE_BANK_VERSION,
    matchingEngineVersion: MATCHING_ENGINE_V3_VERSION,
    f5EngineVersion: F5_ENGINE_VERSION,
    promptBundleVersion: MATCHING_PROMPT_BUNDLE_V3_VERSION,
    contractVersion: MATCHING_REPORT_V3_CONTRACT_VERSION,
    formulaVersion: MATCHING_FORMULA_V3_VERSION,
    metricPromptVersion: REPORT_PROMPT_VERSIONS.matching_metric_reasoning,
    summaryPromptVersion: REPORT_PROMPT_VERSIONS.matching_report_summary_v3,
  });

  if (!force) {
    const cached = await getMatchingAnalysisByInputHash(
      supabase,
      { userId, applicationId },
      inputHash,
      {
        contractVersion: MATCHING_REPORT_V3_CONTRACT_VERSION,
        engineVersion: MATCHING_ENGINE_V3_VERSION,
        promptVersion: MATCHING_PROMPT_BUNDLE_V3_VERSION,
      },
    );
    if (cached.migrationMissing) return { status: 'migration_missing' };
    // V2 rows are not valid V3 cache hits. The second branch only keeps old
    // injected repository fixtures compatible; real records always expose the
    // additive reportV3 property.
    const legacyFixture = cached.record && !('reportV3' in cached.record);
    if (cached.record && cached.record.inputHash === inputHash && (cached.record.reportV3 || (legacyFixture && cached.record.reportV2))) {
      return { status: 'cached', record: cached.record };
    }
  }

  if (!force && cooldownUntil && new Date(cooldownUntil).getTime() > Date.now()) {
    const currentResult = await getLatestApplicationMatchingAnalysis(
      supabase,
      { userId, applicationId },
      { analysisStatus: 'complete' },
    );
    if (currentResult.migrationMissing) return { status: 'migration_missing' };
    if (currentResult.record) return { status: 'cooldown', record: currentResult.record, nextRegenerationAt: cooldownUntil };
  }

  const latestResult = await getLatestApplicationMatchingAnalysis(
    supabase,
    { userId, applicationId },
    { analysisStatus: 'complete' },
  );
  if (latestResult.migrationMissing) return { status: 'migration_missing' };
  const latestRecord = latestResult.record;

  if (!isOpenAIConfigured()) return { status: 'not_configured' };

  const state = await buildApplicantStateFromSnapshot({
    supabase,
    userId,
    applicationId,
    snapshotId: confirmedSnapshotId,
  });
  const context = buildApplicantMatchingContext({
    personalReport: personalRecord.reportV2,
    state,
    evidenceBank: analysis.evidenceBank,
  });
  // V3 scoring reads only the current snapshot/context and target profile.
  // Keep this compatibility shape for the overloaded composer and old tests;
  // V3 never reads it and therefore cannot inherit a previous F5 score.
  const programmeFitInput = buildProgrammeFitPlaceholder();

  const report = await composeMatchingReport({
    targetProfile,
    academicProfile: state.academicProfile ?? { records: [] },
    evidenceBank: analysis.evidenceBank,
    version: 'v3',
    applicantContext: context,
    targetProfileSchemaVersion: TARGET_PROFILE_SCHEMA_VERSION,
    personalReportInputHash: personalRecord.inputHash,
    personalContext: {
      coreIdentity: [],
      motivations: [],
      direction: [
        state.directionSignals?.intendedDirection,
        state.directionSignals?.academicDirection,
        state.directionSignals?.careerDirection,
        state.directionSignals?.preferredEnvironment,
      ].filter((x): x is string => Boolean(x?.trim())),
    },
    previousReport: latestRecord?.reportV2 || null,
    previousV3Report: latestRecord && 'reportV3' in latestRecord ? latestRecord.reportV3 : null,
    lineage: {
      targetProfileVersionId,
      personalReportVersionId: personalRecord.id,
      sourceAnalysisVersionId,
      confirmedSnapshotId,
      evidenceBankVersion: analysis.moduleVersions['evidence'],
      targetProfileSchemaVersion: TARGET_PROFILE_SCHEMA_VERSION,
      personalReportInputHash: personalRecord.inputHash,
    },
    programmeFitInput,
  }) as MatchingReportV2 | MatchingReportV3;

  const reportV3 = report.contractVersion === MATCHING_REPORT_V3_CONTRACT_VERSION ? report as MatchingReportV3 : null;
  const reportV2 = report.contractVersion === 'matching-report-v2' ? report as MatchingReportV2 : null;

  const academicAssessment = await saveApplicationAcademicAssessment(supabase, {
    userId,
    applicationId,
    confirmedSnapshotId: confirmedSnapshotId,
    inputHash,
    assessment: reportV3?.hardRequirements ?? reportV2?.academicRequirements ?? [],
    moduleVersions: { academic: 'academic-analysis-v1' },
    generationMetadata: { targetProfileVersionId, matchingEngineVersion: reportV3?.metadata.matchingEngineVersion ?? MATCHING_ENGINE_VERSION },
  });
  if (!academicAssessment.versionId) {
    return academicAssessment.migrationMissing
      ? { status: 'migration_missing' }
      : { status: 'not_ready', reason: 'Academic assessment could not be persisted' };
  }

  // V3 has no honest one-to-one mapping to the historical F5 dimensions.
  // Keep the legacy adapter explicitly unassessed instead of manufacturing
  // scores or a default match classification for old consumers.
  const legacyFit = reportV3 ? { dimensions: {}, eligibility: {} } : null;
  const saveReport = reportV3 ?? reportV2;
  if (!saveReport) throw new Error('Matching composer returned no report.');
  const saved = await saveApplicationMatchingAnalysis(supabase, {
    applicationId,
    userId,
    inputHash,
    promptVersion: reportV3?.metadata.promptVersion ?? MATCHING_PROMPT_BUNDLE_VERSION,
    legacy: {
      currentMatchScore: reportV3 ? null : reportV2?.overall.fitScore ?? null,
      maxPossibleMatchScore: reportV3 ? null : reportV2?.overall.fitScore ?? null,
      scoreLabel: reportV3 ? 'Not assessed' : reportV2?.overall.fitScore == null ? 'Not assessed' : matchLabel(reportV2.overall.fitScore),
      maxScoreLabel: reportV3 ? 'Not assessed' : reportV2?.overall.fitScore == null ? 'Not assessed' : maxMatchLabel(reportV2.overall.fitScore),
      pillars: {},
      confidence: reportV3 ? 0 : reportV2?.programmeFit.confidence ?? 0,
      inputsPresent: {},
      strengths: saveReport.strengths.map(s => s.title),
      weaknesses: saveReport.gaps.map(g => g.title),
      improvementActions: [],
      explanation: reportV3?.overall.summary ?? reportV2?.overall.summary ?? '',
    },
    reportV2: saveReport,
    modelName: defaultOpenAIModel(),
    targetProfileVersionId,
    sourceAnalysisVersionId,
    confirmedSnapshotId,
    sourcePersonalReportVersionId: personalRecord.id,
    sourcePersonalReportInputHash: personalRecord.inputHash,
    f5EngineVersion: F5_ENGINE_VERSION,
    fitDimensions: legacyFit?.dimensions ?? (reportV2?.programmeFit.dimensions as Record<string, unknown> | undefined) ?? {},
    fitEligibility: legacyFit?.eligibility ?? reportV2?.programmeFit.eligibility ?? {},
    fitClassification: reportV3 ? 'insufficient_data' : reportV2?.programmeFit.classification ?? 'insufficient_data',
    fitConfidence: reportV3 ? 0 : reportV2?.programmeFit.confidence ?? 0,
    fitLimitations: reportV3 ? reportV3.gaps.map((gap) => gap.description) : reportV2?.programmeFit.limitations ?? [],
  });

  if (saved.migrationMissing) return { status: 'migration_missing' };
  if (!saved.record) throw new Error('Failed to save matching analysis');

  return {
    status: 'regenerated',
    record: saved.record,
    reusedCriterionIds: reportV3?.metadata.reusedMetricIds ?? reportV2?.metadata.reusedCriterionIds ?? [],
  };
}
