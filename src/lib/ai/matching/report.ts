import { normalizeTargetProfile } from './criteria';
import { toMatchingEvidence, retrieveEvidenceForCriterion, validateEvidenceReferences } from './evidence';
import { evaluateHardRequirements, calculateEvidenceCoverage, deriveStrengths, deriveGaps, derivePositioningOpportunities, buildDependencyIndex } from './aggregation';
import { reasonAboutCriteria, generateMatchingSummary } from './reasoner';
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
  previousMetadata?: {
    contractVersion: string;
    matchingEngineVersion: string;
    promptVersion: string;
    criterionPromptVersion: string;
  };
}): {
  reusable: FitSignal[];
  needsRecompute: MatchingCriterion[];
} {
  const { criteria, previousSignals, currentEvidence, evidenceByCriterion, personalContext } = args;
  const reusable: FitSignal[] = [];
  const needsRecompute: MatchingCriterion[] = [];
  
  if (!previousSignals || !args.previousMetadata ||
      args.previousMetadata.contractVersion !== MATCHING_REPORT_CONTRACT_VERSION ||
      args.previousMetadata.matchingEngineVersion !== MATCHING_ENGINE_VERSION ||
      args.previousMetadata.promptVersion !== MATCHING_PROMPT_BUNDLE_VERSION ||
      args.previousMetadata.criterionPromptVersion !== REPORT_PROMPT_VERSIONS.matching_criterion_reasoning) {
    return { reusable, needsRecompute: criteria };
  }

  const currentEvidenceIds = new Set(currentEvidence.map((evidence) => evidence.id));
  const prevSignalMap = new Map(previousSignals.map(s => [s.criterionId, s]));

  for (const criterion of criteria) {
    const prev = prevSignalMap.get(criterion.id);
    if (!prev) {
      needsRecompute.push(criterion);
      continue;
    }

    if (prev.applicantEvidenceIds.some((id) => !currentEvidenceIds.has(id))) {
      needsRecompute.push(criterion);
      continue;
    }

    const evidence = evidenceByCriterion[criterion.id] || [];
    const hash = stableHash({
      criterion,
      retrievedEvidence: evidence.map((item) => ({
        id: item.id,
        category: item.category,
        statement: item.statement,
        sourceRefs: item.sourceRefs,
        interpretationRefs: item.interpretationRefs,
        status: item.status,
        competencies: item.competencies,
        criteria: item.criteria,
        direct: item.direct,
      })),
      personalContext: {
        coreIdentity: personalContext.coreIdentity,
        motivations: personalContext.motivations,
        direction: personalContext.direction,
      },
      engineVersion: MATCHING_ENGINE_VERSION,
      criterionPromptVersion: REPORT_PROMPT_VERSIONS.matching_criterion_reasoning,
    });

    if (prev.inputHash !== hash || prev.category !== criterion.category ||
        prev.criterionLabel !== criterion.label ||
        JSON.stringify(prev.criterionSourceRefs) !== JSON.stringify(criterion.sourceRefs)) {
      needsRecompute.push(criterion);
      continue;
    }

    try {
      const validated = validateEvidenceReferences({
        criterionId: prev.criterionId,
        alignment: prev.alignment,
        evidenceIds: prev.applicantEvidenceIds,
        directEvidenceIds: prev.directEvidenceIds,
        supportingEvidenceIds: prev.supportingEvidenceIds,
        reasoning: prev.reasoning,
        missingEvidence: prev.missingEvidence,
        evidenceQuality: prev.evidenceQuality,
        confidence: prev.confidence,
        ...(prev.opportunity ? { positioningOpportunity: prev.opportunity } : {}),
      }, evidence);
      if (
        validated.alignment !== prev.alignment ||
        JSON.stringify(validated.directEvidenceIds) !== JSON.stringify(prev.directEvidenceIds) ||
        JSON.stringify(validated.supportingEvidenceIds) !== JSON.stringify(prev.supportingEvidenceIds)
      ) {
        needsRecompute.push(criterion);
        continue;
      }
      reusable.push(prev);
    } catch {
      // A stale/unknown reference is not silently removed from a previous
      // report: the criterion must be recomputed against the current batch.
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
  const scholarshipHardRequirements = evaluateHardRequirements({
    criteria,
    academicProfile: args.academicProfile,
    evidenceBank: args.evidenceBank,
    includeScholarship: true,
  }).filter((requirement) => criteria.find((criterion) => criterion.id === requirement.criterionId)?.category === 'scholarship');

  // 4. retrieveEvidenceForCriterion (semantic and scholarship criteria only)
  const semanticCriteria = criteria.filter((c) => c.requirementType !== 'hard');
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
    previousMetadata: args.previousReport
      ? {
          contractVersion: args.previousReport.contractVersion,
          matchingEngineVersion: args.previousReport.metadata.matchingEngineVersion,
          promptVersion: args.previousReport.metadata.promptVersion,
          criterionPromptVersion: args.previousReport.metadata.criterionPromptVersion,
        }
      : undefined,
  });

  // 7. reasonAboutCriteria
  let newSignals: FitSignal[] = [];
  if (needsRecompute.length > 0) {
    newSignals = await reasonAboutCriteria({
      criteria: needsRecompute,
      evidenceByCriterion,
      personalContext: args.personalContext,
      generate: args.generate,
    });
  }

  // 8. Merge and validate each with validateEvidenceReferences
  const allSignals = [...reusable, ...newSignals].map((signal) => {
    const criterion = criteria.find((item) => item.id === signal.criterionId);
    if (!criterion) throw new Error(`Signal references unknown criterion: ${signal.criterionId}`);
    const evidenceForCrit = evidenceByCriterion[signal.criterionId] || [];
    if (signal.category !== criterion.category ||
        JSON.stringify(signal.criterionSourceRefs) !== JSON.stringify(criterion.sourceRefs)) {
      throw new Error(`Signal provenance does not match criterion: ${signal.criterionId}`);
    }
    const validated = validateEvidenceReferences({
      criterionId: signal.criterionId,
      alignment: signal.alignment,
      evidenceIds: signal.applicantEvidenceIds,
      directEvidenceIds: signal.directEvidenceIds,
      supportingEvidenceIds: signal.supportingEvidenceIds,
      reasoning: signal.reasoning,
      missingEvidence: signal.missingEvidence,
      evidenceQuality: signal.evidenceQuality,
      confidence: signal.confidence,
      ...(signal.opportunity ? { positioningOpportunity: signal.opportunity } : {}),
    }, evidenceForCrit);
    return {
      ...signal,
      alignment: validated.alignment,
      applicantEvidenceIds: validated.evidenceIds,
      directEvidenceIds: validated.directEvidenceIds,
      supportingEvidenceIds: validated.supportingEvidenceIds,
      opportunity: validated.positioningOpportunity ?? null,
    };
  });
  const signalIds = new Set(allSignals.map((signal) => signal.criterionId));
  if (signalIds.size !== semanticCriteria.length || semanticCriteria.some((criterion) => !signalIds.has(criterion.id))) {
    throw new Error('Matching report does not contain exactly one result for every semantic criterion.');
  }

  // 9. Separate scholarship signals from programme signals
  const programmeAlignment = allSignals.filter(s => s.category !== 'scholarship');
  const scholarshipSignals = allSignals.filter(s => s.category === 'scholarship');

  // 10. assessProgrammeFit
  const programmeFitResult = assessProgrammeFit(args.programmeFitInput);
  const fitScore = programmeFitResult.matchPercent;
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
  const strengths = deriveStrengths(criteria, programmeAlignment);
  const gaps = deriveGaps(criteria, academicRequirements, programmeAlignment);
  const positioningOpportunities = derivePositioningOpportunities(criteria, programmeAlignment);
  const dependencyIndex = buildDependencyIndex(allSignals);

  const scholarshipStrengths = deriveStrengths(criteria, scholarshipSignals);
  const scholarshipGaps = deriveGaps(criteria, scholarshipHardRequirements, scholarshipSignals);
  
  const scholarshipAlignment = scholarshipHardRequirements.length > 0 || scholarshipSignals.length > 0 ? {
    hardRequirements: scholarshipHardRequirements,
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
      fitScore,
      fitLabel: fitScore === null
        ? 'not_assessed'
        : fitScore >= 75
          ? 'strong_current_alignment'
          : fitScore >= 50
            ? 'moderate_current_alignment'
            : 'limited_current_alignment',
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
