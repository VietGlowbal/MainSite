import type { SupabaseClient } from '@supabase/supabase-js';
import { getLatestApplicationMatchingAnalysis, saveApplicationMatchingAnalysis, type MatchingAnalysisRecord } from '@/features/apply/api/ai-reports-repository';
import { regeneratePersonalReport } from '@/features/apply/api/personal-report-generation';
import { getApplicationProfileAnalysisVersion } from '@/features/apply/api/application-analysis-repository';
import { resolveTargetProfile } from '@/lib/ai/target-profile/generation';
import { MATCHING_ENGINE_VERSION, MATCHING_PROMPT_BUNDLE_VERSION, MATCHING_REPORT_CONTRACT_VERSION } from './domain';
import { composeMatchingReport } from './report';
import { stableHash } from '@/features/apply/api/candidate-context';
import { REPORT_PROMPT_VERSIONS } from '../runtime/prompt-registry';
import { TARGET_PROFILE_SCHEMA_VERSION } from '../target-profile/domain';
import { F5_ENGINE_VERSION, type ProgrammeFitInput } from '@/shared/evaluation/f5-programme-fit';
import { buildApplicantStateFromSnapshot } from '../applicant-state/context-builder';
import { isOpenAIConfigured, defaultOpenAIModel } from '../openai-client';
import { matchLabel, maxMatchLabel, weightedScore } from '@/lib/match-insights';

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
  const { supabase, userId, applicationId, force } = args;

  const { data: application, error: appError } = await supabase
    .from('course_applications')
    .select('*, courses (university_id)')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .single();

  if (appError || !application) {
    return { status: 'not_ready', reason: 'Application not found' };
  }

  const personalGeneration = await regeneratePersonalReport({
    supabase,
    userId,
    applicationId,
    trigger: 'matching_report',
  });

  if (personalGeneration.status === 'migration_missing') return { status: 'migration_missing' };
  if (personalGeneration.status === 'not_configured') return { status: 'not_configured' };
  if (personalGeneration.status !== 'cached' && personalGeneration.status !== 'regenerated') {
    return { status: 'not_ready', reason: 'Personal Report must complete before Matching Report generation can start.' };
  }

  const personalRecord = personalGeneration.record;
  if (!personalRecord.sourceAnalysisVersionId) {
    return { status: 'not_ready', reason: 'Missing source analysis version.' };
  }

  const { analysis, migrationMissing } = await getApplicationProfileAnalysisVersion(
    supabase,
    { userId, applicationId },
    personalRecord.sourceAnalysisVersionId
  );
  if (migrationMissing) return { status: 'migration_missing' };
  if (!analysis) return { status: 'not_ready', reason: 'Source analysis not found.' };
  if (analysis.moduleVersions['evidence'] !== 'eb-v1') {
    return { status: 'not_ready', reason: 'Evidence bank version mismatch.' };
  }

  const state = await buildApplicantStateFromSnapshot({
    supabase,
    userId,
    applicationId,
    snapshotId: personalRecord.confirmedSnapshotId!
  });

  const programmeId = application.course_id;
  const targetResolution = await resolveTargetProfile({
    supabase,
    userId,
    programmeId
  });

  if (targetResolution.status === 'not_ready') {
    return { status: 'not_ready', reason: targetResolution.reason };
  }

  const targetProfileVersionId = targetResolution.versionId;
  const targetProfile = targetResolution.profile!;

  const inputHash = stableHash({
    confirmedSnapshotId: personalRecord.confirmedSnapshotId,
    sourceAnalysisVersionId: personalRecord.sourceAnalysisVersionId,
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

  const { record: latestRecord, migrationMissing: latestMigrationMissing } = await getLatestApplicationMatchingAnalysis(supabase, { userId, applicationId });
  if (latestMigrationMissing) return { status: 'migration_missing' };

  if (latestRecord?.inputHash === inputHash && latestRecord.analysisStatus === 'complete' && !force) {
    return { status: 'cached', record: latestRecord };
  }

  if (!process.env.OPENAI_API_KEY || !isOpenAIConfigured()) {
    return { status: 'not_configured' };
  }

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
    academicProfile: state.academicProfile!,
    evidenceBank: analysis.evidenceBank as any,
    personalContext: {
      coreIdentity: [personalRecord.reportV2.coreIdentity.interpretation].filter(Boolean),
      motivations: [personalRecord.reportV2.drivingForce.explanation].filter(Boolean),
      direction: [],
    },
    previousReport: latestRecord?.reportV2 || null,
    lineage: {
      targetProfileVersionId,
      personalReportVersionId: personalRecord.id,
      sourceAnalysisVersionId: personalRecord.sourceAnalysisVersionId,
      confirmedSnapshotId: personalRecord.confirmedSnapshotId!,
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
    sourceAnalysisVersionId: personalRecord.sourceAnalysisVersionId,
    confirmedSnapshotId: personalRecord.confirmedSnapshotId!,
    sourcePersonalReportVersionId: personalRecord.id,
    sourcePersonalReportInputHash: personalRecord.inputHash,
    f5EngineVersion: F5_ENGINE_VERSION,
    fitDimensions: reportV2.programmeFit.dimensions as any,
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
