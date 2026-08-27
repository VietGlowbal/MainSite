import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getLatestApplicationMatchingAnalysis,
  saveApplicationMatchingAnalysis,
  getApplicationProfileAnalysisVersion,
  stableHash,
  type MatchingAnalysisRecord,
} from '@/features/apply/api';
import { regeneratePersonalReport } from '@/features/apply/api/personal-report-generation';
import { resolveTargetProfile } from '@/lib/ai/target-profile/generation';
import { MATCHING_ENGINE_VERSION, MATCHING_PROMPT_BUNDLE_VERSION } from './domain';
import { composeMatchingReport } from './report';
import { REPORT_PROMPT_VERSIONS } from '../runtime/prompt-registry';
import { TARGET_PROFILE_SCHEMA_VERSION } from '../target-profile/domain';
import { F5_ENGINE_VERSION, type ProgrammeFitInput } from '@/shared/evaluation/f5-programme-fit';
import { buildApplicantStateFromSnapshot } from '../applicant-state/context-builder';
import { isOpenAIConfigured, defaultOpenAIModel } from '../openai-client';
import { matchLabel, maxMatchLabel } from '@/lib/match-insights';
import type { EvidenceBank } from '@/shared/evidence/domain';

export async function generateApplicationMatchingReport(args: {
  supabase: SupabaseClient;
  userId: string;
  applicationId: string;
  force?: boolean;
}): Promise<
  | { status: 'cached'; record: MatchingAnalysisRecord }
  | { status: 'regenerated'; record: MatchingAnalysisRecord; reusedCriterionIds: string[] }
  | { status: 'not_ready'; reason: string }
  | { status: 'migration_missing' }
  | { status: 'not_configured' }
> {
  const { supabase, userId, applicationId, force = false } = args;

  if (!isOpenAIConfigured()) {
    return { status: 'not_configured' };
  }

  const { data: application, error: appError } = await supabase
    .from('applications')
    .select('id, user_id, programme_id')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .single();

  if (appError || !application) {
    return { status: 'not_ready', reason: 'Application not found or unauthorized' };
  }

  const personalRes = await regeneratePersonalReport({
    supabase,
    userId,
    applicationId,
    trigger: 'matching_report',
    force: false,
  });

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

  if (!analysisRes.analysis) {
    return { status: 'not_ready', reason: 'Source profile analysis version not found' };
  }

  const analysis = analysisRes.analysis;

  const targetRes = await resolveTargetProfile({
    supabase,
    userId,
    programmeId: application.programme_id,
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
    evidenceBankVersion: analysis.moduleVersions['evidence'],
    matchingEngineVersion: MATCHING_ENGINE_VERSION,
    f5EngineVersion: F5_ENGINE_VERSION,
    promptBundleVersion: MATCHING_PROMPT_BUNDLE_VERSION,
    criterionPromptVersion: REPORT_PROMPT_VERSIONS.matching_criterion_reasoning,
    summaryPromptVersion: REPORT_PROMPT_VERSIONS.matching_report_summary,
  });

  if (!force) {
    const cached = await getLatestApplicationMatchingAnalysis(supabase, { userId, applicationId });
    if (cached.record && cached.record.inputHash === inputHash && cached.record.reportV2) {
      return { status: 'cached', record: cached.record };
    }
  }

  const { record: latestRecord } = await getLatestApplicationMatchingAnalysis(
    supabase,
    { userId, applicationId }
  );

  const state = await buildApplicantStateFromSnapshot({
    supabase,
    userId,
    applicationId,
    snapshotId: confirmedSnapshotId,
  });

  const programmeFitInput: ProgrammeFitInput = {
    eligibility: { requiredSubjects: 'unknown', minimumQualification: 'unknown', languageRequirement: 'unknown', citizenshipRequirement: 'unknown', deadline: 'unknown' },
    academicBand: 'unknown',
    dimensions: {
      academicCompetitiveness: { status: 'not_available', score: null, summary: '', strengths: [], gaps: [], evidenceRefs: [], limitation: '' },
      personaAlignment: { status: 'not_available', score: null, summary: '', strengths: [], gaps: [], evidenceRefs: [], limitation: '' },
      financialFeasibility: { status: 'not_available', score: null, summary: '', strengths: [], gaps: [], evidenceRefs: [], limitation: '' },
      careerDirection: { status: 'not_available', score: null, summary: '', strengths: [], gaps: [], evidenceRefs: [], limitation: '' },
      applicationReadiness: { status: 'not_available', score: null, summary: '', strengths: [], gaps: [], evidenceRefs: [], limitation: '' },
    }
  };

  const reportV2 = await composeMatchingReport({
    targetProfile,
    academicProfile: state.academicProfile ?? { records: [] },
    evidenceBank: analysis.evidenceBank as unknown as EvidenceBank,
    personalContext: {
      coreIdentity: [personalRecord.reportV2.coreIdentity.interpretation].filter((x): x is string => Boolean(x)),
      motivations: [personalRecord.reportV2.drivingForce.explanation].filter((x): x is string => Boolean(x)),
      direction: [],
    },
    previousReport: latestRecord?.reportV2 || null,
    lineage: {
      targetProfileVersionId,
      personalReportVersionId: personalRecord.id,
      sourceAnalysisVersionId,
      confirmedSnapshotId,
      evidenceBankVersion: analysis.moduleVersions['evidence']
    },
    programmeFitInput
  });

  const saved = await saveApplicationMatchingAnalysis(supabase, {
    applicationId,
    userId,
    inputHash,
    promptVersion: MATCHING_PROMPT_BUNDLE_VERSION,
    legacy: {
      currentMatchScore: reportV2.overall.fitScore,
      maxPossibleMatchScore: reportV2.overall.fitScore,
      scoreLabel: matchLabel(reportV2.overall.fitScore),
      maxScoreLabel: maxMatchLabel(reportV2.overall.fitScore),
      pillars: {},
      confidence: reportV2.programmeFit.confidence,
      inputsPresent: {},
      strengths: reportV2.strengths.map(s => s.title),
      weaknesses: reportV2.gaps.map(g => g.title),
      improvementActions: [],
      explanation: reportV2.overall.summary,
    },
    reportV2,
    modelName: defaultOpenAIModel(),
    targetProfileVersionId,
    sourceAnalysisVersionId,
    confirmedSnapshotId,
    sourcePersonalReportVersionId: personalRecord.id,
    sourcePersonalReportInputHash: personalRecord.inputHash,
    f5EngineVersion: F5_ENGINE_VERSION,
    fitDimensions: reportV2.programmeFit.dimensions as Record<string, unknown>,
    fitEligibility: reportV2.programmeFit.eligibility,
    fitClassification: reportV2.programmeFit.classification,
    fitConfidence: reportV2.programmeFit.confidence,
    fitLimitations: reportV2.programmeFit.limitations,
  });

  if (saved.migrationMissing) return { status: 'migration_missing' };
  if (!saved.record) return { status: 'not_ready', reason: 'Failed to save analysis' };

  return {
    status: 'regenerated',
    record: saved.record,
    reusedCriterionIds: reportV2.metadata.reusedCriterionIds,
  };
}
