import { normalizeTargetProfile } from './criteria';
import { toMatchingEvidence, retrieveEvidenceForCriterion } from './evidence';
import { evaluateHardRequirements, calculateEvidenceCoverage, deriveStrengths, deriveGaps, derivePositioningOpportunities, buildDependencyIndex } from './aggregation';
import { reasonAboutCriteria, generateMatchingSummary, BatchReasoningError } from './reasoner';
import { matchingReportV2Schema, MATCHING_REPORT_CONTRACT_VERSION, MATCHING_ENGINE_VERSION, MATCHING_PROMPT_BUNDLE_VERSION, type MatchingReportV2, type MatchingCriterion, type FitSignal, type MatchingEvidence } from './domain';
import { stableHash } from '@/features/apply/api';
import { assessProgrammeFit, type F5Dimension, type ProgrammeFitInput } from '@/shared/evaluation/f5-programme-fit';
import { generateStructured } from '@/lib/ai/runtime/structured-generation';
import { REPORT_PROMPT_VERSIONS } from '@/lib/ai/runtime/prompt-registry';
import { defaultOpenAIModel } from '@/lib/ai/openai-client';
import type { TargetProfile } from '@/lib/ai/target-profile/domain';
import type { AcademicProfile } from '@/lib/ai/applicant-state/domain';
import type { EvidenceBank } from '@/shared/evidence/domain';

export function partitionCriteriaForRecompute(args: {
  criteria: MatchingCriterion[];
  previousSignals: FitSignal[] | null;
  currentEvidence: MatchingEvidence[];
  evidenceByCriterion: Record<string, MatchingEvidence[]>;
  personalContext: {
    coreIdentity: string[];
    motivations: string[];
    direction: string[];
  };
}): {
  reusable: FitSignal[];
  needsRecompute: MatchingCriterion[];
} {
  const { criteria, previousSignals, currentEvidence, evidenceByCriterion, personalContext } = args;
  const reusable: FitSignal[] = [];
  const needsRecompute: MatchingCriterion[] = [];
  
  if (!previousSignals) {
    return { reusable, needsRecompute: criteria };
  }

  const currentEvidenceIds = new Set(currentEvidence.map(e => e.id));
  const prevSignalMap = new Map(previousSignals.map(s => [s.criterionId, s]));

  for (const criterion of criteria) {
    const prev = prevSignalMap.get(criterion.id);
    if (!prev) {
      needsRecompute.push(criterion);
      continue;
    }

    // Check if all evidence IDs in previous signal are still present
    const evidenceStillExists = prev.applicantEvidenceIds.every(id => currentEvidenceIds.has(id));
    if (!evidenceStillExists) {
      needsRecompute.push(criterion);
      continue;
    }

    // Compute hash
    const evidence = evidenceByCriterion[criterion.id] || [];
    const hash = stableHash({
      criterion,
      evidence,
      personalContext,
    });

    if (prev.inputHash === hash) {
      reusable.push(prev);
    } else {
      needsRecompute.push(criterion);
    }
  }

  return { reusable, needsRecompute };
}

export async function composeMatchingReport(args: {
  targetProfile: TargetProfile;
  academicProfile: AcademicProfile;
  evidenceBank: EvidenceBank;
  personalContext: {
    coreIdentity: string[];
    motivations: string[];
    direction: string[];
  };
  previousReport: MatchingReportV2 | null;
  lineage: {
    targetProfileVersionId: string;
    personalReportVersionId: string;
    sourceAnalysisVersionId: string;
    confirmedSnapshotId: string;
    evidenceBankVersion: string;
  };
  programmeFitInput: ProgrammeFitInput;
  generate?: typeof generateStructured;
}): Promise<MatchingReportV2> {
  // 1. normalizeTargetProfile
  const criteria = normalizeTargetProfile(args.targetProfile);
  
  // 2. toMatchingEvidence
  const currentEvidence = toMatchingEvidence(args.evidenceBank);
  
  // 3. evaluateHardRequirements
  const academicRequirements = evaluateHardRequirements({
    criteria,
    academicProfile: args.academicProfile,
    evidenceBank: args.evidenceBank,
  });

  // 4. retrieveEvidenceForCriterion (semantic and scholarship criteria only)
  const semanticCriteria = criteria.filter((c) => c.category !== 'academic_requirement' || c.requirementType !== 'hard');
  const evidenceByCriterion: Record<string, MatchingEvidence[]> = {};
  for (const criterion of semanticCriteria) {
    evidenceByCriterion[criterion.id] = retrieveEvidenceForCriterion({
      criterion,
      evidenceBank: args.evidenceBank,
    });
  }

  // 5 & 6. partitionCriteriaForRecompute
  const previousSignals = args.previousReport 
    ? [...args.previousReport.programmeAlignment, ...(args.previousReport.scholarshipAlignment?.criteria || [])] 
    : null;

  const { reusable, needsRecompute } = partitionCriteriaForRecompute({
    criteria: semanticCriteria,
    previousSignals,
    currentEvidence,
    evidenceByCriterion,
    personalContext: args.personalContext,
  });

  // 7. reasonAboutCriteria
  let newSignals: FitSignal[] = [];
  if (needsRecompute.length > 0) {
    try {
      newSignals = await reasonAboutCriteria({
        criteria: needsRecompute,
        evidenceByCriterion,
        personalContext: args.personalContext,
        generate: args.generate,
      });
    } catch (err: unknown) {
      if (err instanceof BatchReasoningError && err.partialSignals) {
        newSignals = err.partialSignals;
      } else {
        throw err;
      }
    }
  }

  // 8. Merge and validate each with validateEvidenceReferences
  const allSignals = [...reusable, ...newSignals].map((signal) => {
    const evidenceForCrit = evidenceByCriterion[signal.criterionId] || [];
    const validEvidenceIds = new Set(evidenceForCrit.map(e => e.id));
    
    const applicantEvidenceIds = signal.applicantEvidenceIds || [];
    const opportunity = signal.opportunity ?? null;

    return {
      ...signal,
      applicantEvidenceIds: applicantEvidenceIds.filter((id: string) => validEvidenceIds.has(id)),
      directEvidenceIds: (signal.directEvidenceIds || []).filter((id: string) => validEvidenceIds.has(id)),
      supportingEvidenceIds: (signal.supportingEvidenceIds || []).filter((id: string) => validEvidenceIds.has(id)),
      opportunity,
    };
  });

  // 9. Separate scholarship signals from programme signals
  const programmeAlignment = allSignals.filter(s => s.category !== 'scholarship');
  const scholarshipSignals = allSignals.filter(s => s.category === 'scholarship');

  // 10. assessProgrammeFit
  const programmeFitResult = assessProgrammeFit(args.programmeFitInput);
  const mapDimension = (dim: F5Dimension) => ({
    status: dim.status,
    score: dim.score,
    summary: dim.summary || 'Not assessed',
    strengths: dim.strengths || [],
    gaps: dim.gaps || [],
    evidence: (dim.evidenceRefs || []).map((e) => e.id),
    limitation: dim.limitation,
  });

  const programmeFit = {
    classification: programmeFitResult.classification,
    confidence: programmeFitResult.confidencePercent,
    limitations: programmeFitResult.limitations,
    eligibility: programmeFitResult.eligibility,
    dimensions: {
      academicCompetitiveness: mapDimension(programmeFitResult.dimensions.academicCompetitiveness),
      personaAlignment: mapDimension(programmeFitResult.dimensions.personaAlignment),
      financialFeasibility: mapDimension(programmeFitResult.dimensions.financialFeasibility),
      careerDirection: mapDimension(programmeFitResult.dimensions.careerDirection),
      applicationReadiness: mapDimension(programmeFitResult.dimensions.applicationReadiness),
    },
  };
  const evidenceCoverage = calculateEvidenceCoverage(criteria, allSignals);
  const strengths = deriveStrengths(criteria, allSignals);
  const gaps = deriveGaps(criteria, academicRequirements, allSignals);
  const positioningOpportunities = derivePositioningOpportunities(criteria, allSignals);
  const dependencyIndex = buildDependencyIndex(allSignals);

  const scholarshipStrengths = deriveStrengths(criteria, scholarshipSignals);
  const scholarshipGaps = deriveGaps(criteria, [], scholarshipSignals);
  
  const scholarshipAlignment = scholarshipSignals.length > 0 ? {
    criteria: scholarshipSignals,
    strengths: scholarshipStrengths,
    gaps: scholarshipGaps,
  } : null;

  // 12. generateMatchingSummary
  const summaryResult = await generateMatchingSummary({
    academicRequirements,
    programmeAlignment,
    strengths,
    gaps,
    positioningOpportunities,
    scholarshipAlignment,
    programmeFit,
    generate: args.generate,
  });

  // Calculate aiCallCount based on reasonAboutCriteria batches
  const BATCH_SIZE = 6;
  const criteriaByCategory = needsRecompute.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {} as Record<string, MatchingCriterion[]>);
  let criterionBatches = 0;
  for (const cat of Object.keys(criteriaByCategory)) {
    const catCriteria = criteriaByCategory[cat];
    for (let i = 0; i < catCriteria.length; i += BATCH_SIZE) {
      criterionBatches++;
    }
  }

  // 13. Assemble MatchingReportV2
  const reportData = {
    contractVersion: MATCHING_REPORT_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    overall: {
      summary: summaryResult.summary,
      summaryCriterionIds: summaryResult.criterionIds,
      summaryEvidenceIds: summaryResult.evidenceIds,
      strongestAlignment: strengths.slice(0, 3).map(s => s.id),
      mostImportantGaps: gaps.slice(0, 3).map(g => g.id),
      evidenceCoverage,
      fitScore: programmeFitResult.matchPercent ?? 0,
      fitLabel: programmeFitResult.matchPercent && programmeFitResult.matchPercent >= 75 ? 'strong_current_alignment' : 
                programmeFitResult.matchPercent && programmeFitResult.matchPercent >= 50 ? 'moderate_current_alignment' : 'limited_current_alignment',
    },
    criteria,
    academicRequirements,
    programmeAlignment,
    strengths,
    gaps,
    positioningOpportunities,
    scholarshipAlignment,
    programmeFit,
    dependencyIndex,
    metadata: {
      matchingEngineVersion: MATCHING_ENGINE_VERSION,
      promptVersion: MATCHING_PROMPT_BUNDLE_VERSION,
      criterionPromptVersion: REPORT_PROMPT_VERSIONS.matching_criterion_reasoning,
      summaryPromptVersion: REPORT_PROMPT_VERSIONS.matching_report_summary,
      model: defaultOpenAIModel(),
      targetProfileVersionId: args.lineage.targetProfileVersionId,
      personalReportVersionId: args.lineage.personalReportVersionId,
      sourceAnalysisVersionId: args.lineage.sourceAnalysisVersionId,
      confirmedSnapshotId: args.lineage.confirmedSnapshotId,
      evidenceBankVersion: args.lineage.evidenceBankVersion,
      reusedCriterionIds: reusable.map(s => s.criterionId),
      aiCallCount: { criterionBatches, summary: 1 },
    }
  };

  return matchingReportV2Schema.parse(reportData);
}
