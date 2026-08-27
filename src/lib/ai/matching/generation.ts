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
import { MATCHING_ENGINE_VERSION, MATCHING_PROMPT_BUNDLE_VERSION } from './domain';
import { composeMatchingReport } from './report';
import { normalizeTargetProfile } from './criteria';
import { evaluateHardRequirements } from './aggregation';
import { REPORT_PROMPT_VERSIONS } from '../runtime/prompt-registry';
import { TARGET_PROFILE_SCHEMA_VERSION } from '../target-profile/domain';
import {
  academicBandFromScore,
  buildProgrammeFitPlaceholder,
  F5_DIMENSION_KEYS,
  F5_ENGINE_VERSION,
  type ProgrammeFitInput,
} from '@/shared/evaluation/f5-programme-fit';
import { buildApplicantStateFromSnapshot } from '../applicant-state/context-builder';
import { defaultOpenAIModel, isOpenAIConfigured } from '../openai-client';
import { matchLabel, maxMatchLabel } from '@/lib/match-insights';
import type { EvidenceBank } from '@/shared/evidence/domain';
import { EVIDENCE_BANK_VERSION } from '@/shared/evidence/domain';
import { programmeFitSchema } from '@/features/apply/domain';
import { toMatchingEvidence } from './evidence';
import type { AcademicProfile } from '../applicant-state/domain';

function programmeFitInputFromRecord(
  record: MatchingAnalysisRecord | null,
  evidenceBank: EvidenceBank,
): ProgrammeFitInput {
  const storedFit = record?.reportV2?.programmeFit ?? (
    record?.fitDimensions && record.fitEligibility && record.fitClassification
      ? {
          classification: record.fitClassification,
          confidence: record.fitConfidence ?? 0,
          limitations: record.fitLimitations ?? [],
          eligibility: record.fitEligibility,
          dimensions: record.fitDimensions,
        }
      : null
  );
  const parsed = programmeFitSchema.safeParse(storedFit);
  if (!parsed.success) {
    const placeholder = buildProgrammeFitPlaceholder();
    return {
      eligibility: placeholder.eligibility,
      academicBand: placeholder.academicBand,
      dimensions: placeholder.dimensions,
    };
  }

  const evidenceById = new Map(toMatchingEvidence(evidenceBank).map((item) => [item.id, item]));
  const dimensions = Object.fromEntries(
    F5_DIMENSION_KEYS.map((key) => {
      const dimension = parsed.data.dimensions[key];
      return [key, {
        status: dimension.status,
        score: dimension.score,
        summary: dimension.summary,
        strengths: dimension.strengths,
        gaps: dimension.gaps,
        evidenceRefs: dimension.evidence.flatMap((id) => {
          const evidence = evidenceById.get(id);
          return evidence ? [{ id: evidence.id, kind: evidence.category, label: evidence.statement }] : [];
        }),
        ...(dimension.limitation ? { limitation: dimension.limitation } : {}),
      }];
    }),
  ) as ProgrammeFitInput['dimensions'];

  return {
    eligibility: parsed.data.eligibility,
    academicBand: academicBandFromScore(dimensions.academicCompetitiveness.score),
    dimensions,
  };
}

function currentEligibilityFromHardRequirements(args: {
  targetProfile: Parameters<typeof normalizeTargetProfile>[0];
  academicProfile: AcademicProfile;
  evidenceBank: EvidenceBank;
}): ProgrammeFitInput['eligibility'] {
  const criteria = normalizeTargetProfile(args.targetProfile);
  const requirements = evaluateHardRequirements({
    criteria,
    academicProfile: args.academicProfile,
    evidenceBank: args.evidenceBank,
  });
  const requirementById = new Map(requirements.map((requirement) => [requirement.criterionId, requirement]));
  const gate = (pattern: RegExp) => {
    const statuses = criteria
      .filter((criterion) => criterion.requirementType === 'hard' && pattern.test(`${criterion.label} ${criterion.description}`))
      .map((criterion) => requirementById.get(criterion.id)?.status)
      .filter((status): status is NonNullable<typeof status> => Boolean(status));
    if (statuses.some((status) => status === 'does_not_meet')) return 'not_met' as const;
    if (statuses.some((status) => status === 'meets')) return 'met' as const;
    return 'unknown' as const;
  };
  return {
    requiredSubjects: gate(/subject|coursework|prerequisite/i),
    minimumQualification: gate(/qualification|gpa|grade|degree|diploma/i),
    languageRequirement: gate(/language|english|ielts|toefl/i),
    citizenshipRequirement: gate(/citizenship|residen|nationality/i),
    deadline: gate(/deadline|closing|due date/i),
  };
}

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
    matchingEngineVersion: MATCHING_ENGINE_VERSION,
    f5EngineVersion: F5_ENGINE_VERSION,
    promptBundleVersion: MATCHING_PROMPT_BUNDLE_VERSION,
    criterionPromptVersion: REPORT_PROMPT_VERSIONS.matching_criterion_reasoning,
    summaryPromptVersion: REPORT_PROMPT_VERSIONS.matching_report_summary,
  });

  if (!force) {
    const cached = await getMatchingAnalysisByInputHash(
      supabase,
      { userId, applicationId },
      inputHash,
    );
    if (cached.migrationMissing) return { status: 'migration_missing' };
    if (cached.record && cached.record.inputHash === inputHash && cached.record.reportV2) {
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
  const programmeFitInput = programmeFitInputFromRecord(latestRecord, analysis.evidenceBank);
  programmeFitInput.eligibility = currentEligibilityFromHardRequirements({
    targetProfile,
    academicProfile: state.academicProfile ?? { records: [] },
    evidenceBank: analysis.evidenceBank,
  });

  const reportV2 = await composeMatchingReport({
    targetProfile,
    academicProfile: state.academicProfile ?? { records: [] },
    evidenceBank: analysis.evidenceBank,
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
    programmeFitInput,
  });

  const academicAssessment = await saveApplicationAcademicAssessment(supabase, {
    userId,
    applicationId,
    confirmedSnapshotId: confirmedSnapshotId,
    inputHash,
    assessment: reportV2.academicRequirements,
    moduleVersions: { academic: 'academic-analysis-v1' },
    generationMetadata: { targetProfileVersionId, matchingEngineVersion: MATCHING_ENGINE_VERSION },
  });
  if (!academicAssessment.versionId) {
    return academicAssessment.migrationMissing
      ? { status: 'migration_missing' }
      : { status: 'not_ready', reason: 'Academic assessment could not be persisted' };
  }

  const saved = await saveApplicationMatchingAnalysis(supabase, {
    applicationId,
    userId,
    inputHash,
    promptVersion: MATCHING_PROMPT_BUNDLE_VERSION,
    legacy: {
      currentMatchScore: reportV2.overall.fitScore,
      maxPossibleMatchScore: reportV2.overall.fitScore,
      scoreLabel: reportV2.overall.fitScore === null ? 'Not assessed' : matchLabel(reportV2.overall.fitScore),
      maxScoreLabel: reportV2.overall.fitScore === null ? 'Not assessed' : maxMatchLabel(reportV2.overall.fitScore),
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
  if (!saved.record) throw new Error('Failed to save matching analysis');

  return {
    status: 'regenerated',
    record: saved.record,
    reusedCriterionIds: reportV2.metadata.reusedCriterionIds,
  };
}
