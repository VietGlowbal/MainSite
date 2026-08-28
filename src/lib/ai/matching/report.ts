import { normalizeTargetProfile } from './criteria';
import { toMatchingEvidence, retrieveEvidenceForCriterion, validateEvidenceReferences } from './evidence';
import { evaluateHardRequirements, calculateEvidenceCoverage, deriveStrengths, deriveGaps, derivePositioningOpportunities, buildDependencyIndex } from './aggregation';
import { reasonAboutCriteria, generateMatchingSummary, generateMatchingV3Summary, reasonAboutV3Metrics } from './reasoner';
import { matchingReportV2Schema, matchingReportV3Schema, MATCHING_REPORT_CONTRACT_VERSION, MATCHING_ENGINE_VERSION, MATCHING_PROMPT_BUNDLE_VERSION, MATCHING_REPORT_V3_CONTRACT_VERSION, MATCHING_ENGINE_V3_VERSION, MATCHING_PROMPT_BUNDLE_V3_VERSION, MATCHING_FORMULA_V3_VERSION, type MatchingReportV2, type MatchingReportV3, type MatchingV3Metric, type MatchingCriterion, type FitSignal, type MatchingEvidence, type MatchingV3MetricResult } from './domain';
import { stableHash } from '@/features/apply/api';
import { assessProgrammeFit, type F5Dimension, type ProgrammeFitInput } from '@/shared/evaluation/f5-programme-fit';
import { generateStructured } from '@/lib/ai/runtime/structured-generation';
import { REPORT_PROMPT_VERSIONS } from '@/lib/ai/runtime/prompt-registry';
import { defaultOpenAIModel } from '@/lib/ai/openai-client';
import type { TargetProfile } from '@/lib/ai/target-profile/domain';
import type { AcademicProfile } from '@/lib/ai/applicant-state/domain';
import type { EvidenceBank } from '@/shared/evidence/domain';
import type { ApplicantMatchingContext } from './applicant-context';
import { UNIVERSITY_FIT_METRICS, PROGRAMME_FIT_METRICS, targetSourceIndex, weightedScore, type V3MetricDefinition } from './v3-scoring';

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

type MatchingV3ComposeArgs = {
  targetProfile: TargetProfile;
  academicProfile: AcademicProfile;
  evidenceBank: EvidenceBank;
  applicantContext: ApplicantMatchingContext;
  previousReport: MatchingReportV3 | null;
  lineage: {
    targetProfileVersionId: string;
    targetProfileSchemaVersion: string;
    personalReportVersionId: string;
    personalReportInputHash: string;
    sourceAnalysisVersionId: string;
    confirmedSnapshotId: string;
    evidenceBankVersion: string;
  };
  selectedScholarshipKey?: string | null;
  selectedScholarshipVersionId?: string | null;
  modelName?: string;
  generate?: typeof generateStructured;
};

function v3Metric(
  definition: V3MetricDefinition,
  results: MatchingV3MetricResult[],
): MatchingV3Metric {
  const aggregate = weightedScore(results, definition.submetrics);
  const summary = results
    .map((result) => result.reasoning)
    .filter(Boolean)
    .join(' ')
    .slice(0, 3_900) || 'No grounded assessment was available.';
  return {
    id: definition.id,
    ...aggregate,
    summary,
    submetrics: results,
  };
}

type V3FitAggregate = {
  score: number | null;
  status: 'assessed' | 'limited' | 'not_available';
  confidence: number;
  coverage: number;
  summary: string;
  metrics: Record<string, MatchingV3Metric>;
};

function v3Fit(
  definitions: readonly V3MetricDefinition[],
  metrics: Record<string, MatchingV3Metric>,
  summary: string,
): V3FitAggregate {
  const available = definitions.flatMap((definition) => {
    const metric = metrics[definition.id];
    return metric.score === null ? [] : [{ definition, metric }];
  });
  const weight = available.reduce((sum, item) => sum + item.definition.weight, 0);
  const total = definitions.reduce((sum, item) => sum + item.weight, 0);
  const score = weight === 0
    ? null
    : Math.round(available.reduce((sum, item) => sum + (item.metric.score ?? 0) * item.definition.weight, 0) / weight);
  const confidence = weight === 0
    ? 0
    : Number((available.reduce((sum, item) => sum + item.metric.confidence * item.definition.weight, 0) / weight).toFixed(3));
  const coverage = Math.round(
    definitions.reduce((sum, definition) => sum + (metrics[definition.id].coverage * definition.weight), 0) / total,
  );
  const status = score === null ? 'not_available' : coverage === 100 ? 'assessed' : 'limited';
  return { score, status, confidence, coverage, summary, metrics };
}

function hardV3(args: {
  targetProfile: TargetProfile;
  academicProfile: AcademicProfile;
  evidenceBank: EvidenceBank;
}): MatchingReportV3['hardRequirements'] {
  const criteria = normalizeTargetProfile(args.targetProfile);
  const requirements = evaluateHardRequirements({
    criteria,
    academicProfile: args.academicProfile,
    evidenceBank: args.evidenceBank,
  });
  const byId = new Map(criteria.map((criterion) => [criterion.id, criterion]));
  const kind = (label: string): MatchingReportV3['hardRequirements'][number]['kind'] => {
    if (/language|english|ielts|toefl/i.test(label)) return 'language';
    if (/subject|coursework|prerequisite/i.test(label)) return 'subject';
    if (/qualification|gpa|grade|degree|diploma|test|sat|act/i.test(label)) return 'qualification';
    if (/document|transcript|portfolio|reference|essay/i.test(label)) return 'document';
    return 'other';
  };
  const mapped = requirements
    .filter((requirement) => byId.get(requirement.criterionId)?.category !== 'scholarship')
    .map((requirement) => {
      const criterion = byId.get(requirement.criterionId);
      return {
        id: requirement.criterionId,
        kind: kind(criterion?.label ?? requirement.criterionId),
        label: criterion?.label ?? requirement.criterionId,
        status: requirement.status === 'meets' ? 'met' as const : requirement.status === 'does_not_meet' ? 'not_met' as const : requirement.status === 'not_applicable' ? 'not_applicable' as const : 'unknown' as const,
        applicantValue: requirement.applicantValue,
        requiredValue: requirement.requiredValue,
        explanation: requirement.explanation,
        evidenceIds: requirement.evidenceIds,
        targetSourceRefs: criterion?.sourceRefs ?? [],
      };
    });
  const today = new Date();
  for (const [index, deadline] of args.targetProfile.deadlines.entries()) {
    const parsed = Date.parse(deadline.value);
    mapped.push({
      id: `deadline:${index}`,
      kind: 'deadline',
      label: deadline.label,
      status: Number.isFinite(parsed) ? (parsed >= today.getTime() ? 'met' : 'not_met') : 'unknown',
      applicantValue: null,
      requiredValue: deadline.value,
      explanation: Number.isFinite(parsed)
        ? `The canonical deadline is ${deadline.value}.`
        : 'The canonical source gives a deadline, but its date could not be evaluated deterministically.',
      evidenceIds: [],
      targetSourceRefs: deadline.sourceRefs,
    });
  }
  return mapped;
}

function insight(
  id: string,
  title: string,
  description: string,
  evidenceIds: string[],
  targetSourceRefs: string[],
): MatchingReportV3['strengths'][number] {
  return { id, title, description: description.slice(0, 3_900), evidenceIds: [...new Set(evidenceIds)], targetSourceRefs: [...new Set(targetSourceRefs)] };
}

function refsForMetric(metric: MatchingV3Metric) {
  return {
    evidenceIds: [...new Set(metric.submetrics.flatMap((item) => item.applicantEvidenceIds))],
    targetSourceRefs: [...new Set(metric.submetrics.flatMap((item) => item.targetSourceRefs))],
  };
}

function deterministicTakeawayCandidates(args: {
  universityFit: MatchingReportV3['universityFit'];
  programmeFit: MatchingReportV3['programmeFit'];
  hardRequirements: MatchingReportV3['hardRequirements'];
  strengths: MatchingReportV3['strengths'];
  gaps: MatchingReportV3['gaps'];
  context: ApplicantMatchingContext;
}): Record<string, MatchingReportV3['keyTakeaways'][keyof MatchingReportV3['keyTakeaways']]> {
  const allMetrics = [
    ...Object.values(args.universityFit.metrics),
    ...Object.values(args.programmeFit.metrics),
  ];
  const strongest = [...allMetrics].filter((metric) => metric.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const weakest = [...allMetrics].filter((metric) => metric.score !== null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
  const strongestRefs = strongest ? refsForMetric(strongest) : { evidenceIds: [], targetSourceRefs: [] };
  const weakestRefs = weakest ? refsForMetric(weakest) : { evidenceIds: [], targetSourceRefs: [] };
  const failed = args.hardRequirements.find((item) => item.status === 'not_met');
  const missingEvidence = allMetrics.flatMap((metric) => metric.submetrics.flatMap((item) => item.missingEvidence)).filter(Boolean);
  const positioning = args.context.personalPositioning.evidenceIds.length > 0
    ? args.context.personalPositioning.evidenceIds
    : strongestRefs.evidenceIds;
  const take = (title: string, body: string, evidenceIds: string[], targetSourceRefs: string[], metricIds: string[]) => ({
    title, body: body.slice(0, 3_900), evidenceIds: [...new Set(evidenceIds)], targetSourceRefs: [...new Set(targetSourceRefs)], metricIds: [...new Set(metricIds)],
  });
  return {
    strongestAlignment: take(
      strongest ? `${strongest.id} is the clearest alignment` : 'Strongest alignment is not available',
      strongest?.summary ?? 'No metric has enough evidence to establish a strongest alignment yet.',
      strongestRefs.evidenceIds,
      strongestRefs.targetSourceRefs,
      strongest ? [strongest.id] : [],
    ),
    criticalGap: take(
      failed?.label ?? (weakest ? `${weakest.id} needs attention` : 'Critical gap is not available'),
      failed?.explanation ?? weakest?.summary ?? 'No critical gap could be established from the current evidence.',
      failed?.evidenceIds ?? weakestRefs.evidenceIds,
      failed?.targetSourceRefs ?? weakestRefs.targetSourceRefs,
      weakest ? [weakest.id] : [],
    ),
    evidenceToAdd: take(
      'Evidence to add next',
      missingEvidence[0] ?? 'Add a concrete result, reflection, or document for the least-supported alignment area.',
      [],
      weakestRefs.targetSourceRefs,
      weakest ? [weakest.id] : [],
    ),
    positioningNextStep: take(
      'Positioning next step',
      args.strengths[0]?.description ?? 'Use the strongest evidence-backed alignment in the application narrative, without adding unsupported claims.',
      positioning,
      strongestRefs.targetSourceRefs,
      strongest ? [strongest.id] : [],
    ),
  };
}

export async function composeMatchingReportV3(args: MatchingV3ComposeArgs): Promise<MatchingReportV3> {
  const universityResult = await reasonAboutV3Metrics({
    definitions: UNIVERSITY_FIT_METRICS,
    context: args.applicantContext,
    targetProfile: args.targetProfile,
    previousReport: args.previousReport,
    generate: args.generate,
  });
  const programmeResult = await reasonAboutV3Metrics({
    definitions: PROGRAMME_FIT_METRICS,
    context: args.applicantContext,
    targetProfile: args.targetProfile,
    previousReport: args.previousReport,
    generate: args.generate,
  });
  const buildMetrics = (definitions: readonly V3MetricDefinition[], results: MatchingV3MetricResult[]) =>
    Object.fromEntries(definitions.map((definition) => [
      definition.id,
      v3Metric(definition, results.filter((result) => result.metricId === definition.id)),
    ]));
  const universityMetrics = buildMetrics(UNIVERSITY_FIT_METRICS, universityResult.results);
  const programmeMetrics = buildMetrics(PROGRAMME_FIT_METRICS, programmeResult.results);
  const hardRequirements = hardV3(args);
  const universityFit = v3Fit(UNIVERSITY_FIT_METRICS, universityMetrics, 'University alignment is weighted across the five named dimensions.') as unknown as MatchingReportV3['universityFit'];
  const programmeFit = {
    ...v3Fit(PROGRAMME_FIT_METRICS, programmeMetrics, 'Programme alignment is weighted across interest, capability, experience and future direction.'),
    strongestAlignment: Object.values(programmeMetrics).filter((metric) => metric.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3).map((metric) => metric.id),
    potentialGap: Object.values(programmeMetrics).filter((metric) => metric.score !== null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0]?.summary ?? null,
    strategicInterpretation: args.applicantContext.personalPositioning.statement,
  } as unknown as MatchingReportV3['programmeFit'];
  const evidenceIndex: MatchingReportV3['evidenceIndex'] = toMatchingEvidence(args.evidenceBank).map((item) => ({
    id: item.id,
    label: item.category,
    statement: item.statement,
    kind: 'applicant' as const,
    status: item.status,
    sourceRefs: item.sourceRefs,
    direct: item.direct,
  }));
  const rawSourceIds = new Set(Object.keys(args.evidenceBank.sources));
  for (const item of evidenceIndex) {
    if (item.sourceRefs.some((ref) => !rawSourceIds.has(ref))) {
      throw new Error(`Evidence references an unknown raw source: ${item.id}`);
    }
  }
  for (const requirement of hardRequirements) {
    if (!evidenceIndex.some((item) => item.id === requirement.id)) {
      // The hard requirement id is not applicant evidence; it is only a
      // namespace marker for the cross-contract prohibition in the schema.
      evidenceIndex.push({ id: requirement.id, label: requirement.label, statement: requirement.explanation, kind: 'hard_requirement', status: 'unverified', sourceRefs: [], direct: false });
    }
  }
  const sourceIndex = targetSourceIndex(args.targetProfile);
  const metricValues = [...Object.values(universityMetrics), ...Object.values(programmeMetrics)];
  const metricStrengths = metricValues
    .filter((metric) => metric.score !== null && metric.score >= 65)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5)
    .map((metric) => {
      const refs = refsForMetric(metric);
      return insight(`strength:${metric.id}`, metric.id, metric.summary, refs.evidenceIds, refs.targetSourceRefs);
    });
  const metricGaps = metricValues
    .filter((metric) => metric.score !== null && metric.score < 60 || metric.coverage < 50)
    .sort((a, b) => (a.score ?? 101) - (b.score ?? 101))
    .slice(0, 5)
    .map((metric) => {
      const refs = refsForMetric(metric);
      return insight(`gap:${metric.id}`, metric.id, metric.summary, refs.evidenceIds, refs.targetSourceRefs);
    });
  const strengths = metricStrengths;
  const gaps = metricGaps;
  const positioningOpportunities = strengths.slice(0, 3).map((item) => insight(
    `positioning:${item.id}`,
    `Use ${item.title} carefully in positioning`,
    `Use the evidence behind ${item.title} to demonstrate fit, while keeping the claim within the cited facts.`,
    item.evidenceIds,
    item.targetSourceRefs,
  ));
  const candidates = deterministicTakeawayCandidates({ universityFit, programmeFit, hardRequirements, strengths, gaps, context: args.applicantContext });
  const summaryResult = await generateMatchingV3Summary({
    candidate: { universityFit, programmeFit, hardRequirements, strengths, gaps, positioningOpportunities, candidates },
    evidenceIds: evidenceIndex.map((item) => item.id),
    targetSourceRefs: sourceIndex.map((item) => item.ref),
    metricIds: metricValues.map((item) => item.id),
    hardRequirements,
    generate: args.generate,
  });
  const allResults = [...universityResult.results, ...programmeResult.results];
  const allMetricDefinitions = [...UNIVERSITY_FIT_METRICS, ...PROGRAMME_FIT_METRICS];
  const overall = v3Fit(allMetricDefinitions, Object.fromEntries(metricValues.map((metric) => [metric.id, metric])), summaryResult.data.summary);
  const report = {
    contractVersion: MATCHING_REPORT_V3_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    overall: {
      summary: summaryResult.data.summary,
      overallAlignmentScore: overall.score,
      evidenceCoverage: overall.coverage,
      confidence: overall.confidence,
      strongestAlignment: [...metricValues].filter((metric) => metric.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3).map((metric) => metric.id),
      criticalGaps: gaps.map((item) => item.id),
      summaryEvidenceIds: [...new Set(allResults.flatMap((result) => result.applicantEvidenceIds))].slice(0, 30),
      summaryTargetSourceRefs: [...new Set(allResults.flatMap((result) => result.targetSourceRefs))].filter((ref) => sourceIndex.some((item) => item.ref === ref)).slice(0, 30),
    },
    universityFit,
    programmeFit,
    hardRequirements,
    scholarshipAlignment: null,
    strengths,
    gaps,
    positioningOpportunities,
    keyTakeaways: summaryResult.data.keyTakeaways,
    evidenceIndex,
    targetSourceIndex: sourceIndex,
    metadata: {
      matchingEngineVersion: MATCHING_ENGINE_V3_VERSION,
      promptVersion: MATCHING_PROMPT_BUNDLE_V3_VERSION,
      metricPromptVersion: 'matching-metric-v3.0.0',
      summaryPromptVersion: 'matching-summary-v3.0.0',
      formulaVersion: MATCHING_FORMULA_V3_VERSION,
      model: args.modelName ?? defaultOpenAIModel(),
      targetProfileVersionId: args.lineage.targetProfileVersionId,
      targetProfileSchemaVersion: args.lineage.targetProfileSchemaVersion,
      personalReportVersionId: args.lineage.personalReportVersionId,
      personalReportInputHash: args.lineage.personalReportInputHash,
      sourceAnalysisVersionId: args.lineage.sourceAnalysisVersionId,
      confirmedSnapshotId: args.lineage.confirmedSnapshotId,
      evidenceBankVersion: args.lineage.evidenceBankVersion,
      selectedScholarshipKey: args.selectedScholarshipKey ?? null,
      selectedScholarshipVersionId: args.selectedScholarshipVersionId ?? null,
      reusedMetricIds: [...new Set([...universityResult.reusedMetricIds, ...programmeResult.reusedMetricIds])],
      metricInputHashes: { ...universityResult.metricInputHashes, ...programmeResult.metricInputHashes },
      aiCallCount: {
        metricBatches: universityResult.metricBatches + programmeResult.metricBatches,
        providerCalls: universityResult.providerCalls + programmeResult.providerCalls + summaryResult.providerCalls,
        summary: 1 as const,
      },
    },
  };
  return matchingReportV3Schema.parse(report);
}

export type MatchingReportComposeArgs = {
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
    targetProfileSchemaVersion?: string;
    personalReportInputHash?: string;
  };
  programmeFitInput: ProgrammeFitInput;
  generate?: typeof generateStructured;
  version?: 'v2' | 'v3';
  applicantContext?: ApplicantMatchingContext;
  targetProfileSchemaVersion?: string;
  personalReportInputHash?: string;
  modelName?: string;
  selectedScholarshipKey?: string | null;
  selectedScholarshipVersionId?: string | null;
  previousV3Report?: MatchingReportV3 | null;
};

export function composeMatchingReport(args: MatchingReportComposeArgs & { version: 'v3' }): Promise<MatchingReportV3>;
export function composeMatchingReport(args: MatchingReportComposeArgs & { version?: 'v2' }): Promise<MatchingReportV2>;
export async function composeMatchingReport(args: MatchingReportComposeArgs): Promise<MatchingReportV2 | MatchingReportV3> {
  if (args.version === 'v3') {
    if (!args.applicantContext || !args.personalReportInputHash || !args.targetProfileSchemaVersion) {
      throw new Error('V3 matching composition requires structured applicant context and complete lineage.');
    }
    return composeMatchingReportV3({
      targetProfile: args.targetProfile,
      academicProfile: args.academicProfile,
      evidenceBank: args.evidenceBank,
      applicantContext: args.applicantContext,
      previousReport: args.previousV3Report ?? null,
      lineage: {
        ...args.lineage,
        targetProfileSchemaVersion: args.targetProfileSchemaVersion,
        personalReportInputHash: args.personalReportInputHash,
      },
      selectedScholarshipKey: args.selectedScholarshipKey,
      selectedScholarshipVersionId: args.selectedScholarshipVersionId,
      modelName: args.modelName,
      generate: args.generate,
    });
  }
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
