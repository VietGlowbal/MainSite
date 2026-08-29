import { z } from 'zod';
import { generateStructured } from '@/lib/ai/runtime/structured-generation';
import { getReportPrompt } from '@/lib/ai/runtime/prompt-registry';
import { validateEvidenceReferences } from './evidence';
import {
  criterionMatchResultSchema,
  matchingSummaryResultSchema,
  type FitSignal,
  type HardRequirementMatch,
  type MatchingCriterion,
  type MatchingEvidence,
  type MatchingGap,
  type MatchingReportV2,
  type MatchingStrength,
  type MatchingSummaryResult,
  type PositioningOpportunity,
  MATCHING_ENGINE_VERSION,
  MATCHING_ENGINE_V3_VERSION,
  matchingV3MetricResultSchema,
  type MatchingV3MetricResult,
  v3KeyTakeawaysSchema,
} from './domain';
import type { ProgrammeFit } from '@/features/apply/domain';
import { stableHash } from '@/features/apply/api';
import type { ApplicantMatchingContext } from './applicant-context';
import type { TargetProfile } from '../target-profile/domain';
import type { V3MetricDefinition } from './v3-scoring';
import { normalizeAcademicRubricScore, targetRefsForMetric, targetStructuredFacts, UNIVERSITY_FIT_METRICS } from './v3-scoring';
import type { MatchingReportV3 } from './domain';

const BATCH_SIZE = 6;

export class BatchReasoningError extends Error {
  public partialSignals: FitSignal[];
  public errors: Error[];

  constructor(message: string, partialSignals: FitSignal[], errors: Error[]) {
    super(message);
    this.name = 'BatchReasoningError';
    this.partialSignals = partialSignals;
    this.errors = errors;
  }
}

export async function reasonAboutCriteria(args: {
  criteria: MatchingCriterion[];
  evidenceByCriterion: Record<string, MatchingEvidence[]>;
  personalContext: {
    coreIdentity: string[];
    motivations: string[];
    direction: string[];
  };
  generate?: typeof generateStructured;
}): Promise<FitSignal[]> {
  const generate = args.generate ?? generateStructured;
  const { systemPrompt, version: promptVersion } = getReportPrompt('matching_criterion_reasoning');
  
  // Batch criteria by category to avoid exceeding context or causing hallucination
  const batches: MatchingCriterion[][] = [];
  const criteriaByCategory = args.criteria.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {} as Record<string, MatchingCriterion[]>);

  for (const category of Object.keys(criteriaByCategory)) {
    const catCriteria = criteriaByCategory[category];
    for (let i = 0; i < catCriteria.length; i += BATCH_SIZE) {
      batches.push(catCriteria.slice(i, i + BATCH_SIZE));
    }
  }

  const allSignals: FitSignal[] = [];
  const batchErrors: Error[] = [];

  for (const batch of batches) {
    try {
      const criteriaList = batch.map(c => ({
        id: c.id,
        label: c.label,
        description: c.description,
        expectedSignals: c.expectedSignals,
      }));

      const evidenceData: Record<
        string,
        Array<{ id: string; statement: string; status: string; competencies: string[] }>
      > = {};
      batch.forEach(c => {
        const evidence = args.evidenceByCriterion[c.id] || [];
        evidenceData[c.id] = evidence.map(e => ({
          id: e.id,
          statement: e.statement,
          status: e.status,
          competencies: e.competencies,
        }));
      });

      const userPrompt = JSON.stringify({
        criteria: criteriaList,
        evidenceByCriterion: evidenceData,
        personalContext: args.personalContext,
      }, null, 2);

      const result = await generate({
        moduleId: 'matching_criterion_reasoning',
        promptVersion,
        schemaVersion: 'matching-criterion-v2.0.0',
        systemPrompt,
        userPrompt,
        schema: z.object({ results: z.array(criterionMatchResultSchema) }).strict(),
      });

      const batchResults = result.data.results;
      const expectedIds = new Set(batch.map((criterion) => criterion.id));
      const seenIds = new Set<string>();
      if (batchResults.length !== batch.length) {
        throw new Error(
          `Criterion batch returned ${batchResults.length} results for ${batch.length} criteria.`,
        );
      }

      for (const res of batchResults) {
        if (!expectedIds.has(res.criterionId)) {
          throw new Error(`Unknown criterion ID in batch: ${res.criterionId}`);
        }
        if (seenIds.has(res.criterionId)) {
          throw new Error(`Duplicate criterion ID in batch: ${res.criterionId}`);
        }
        seenIds.add(res.criterionId);
        const criterion = batch.find((c) => c.id === res.criterionId);
        if (!criterion) throw new Error(`Missing criterion in batch: ${res.criterionId}`);

        const evidence = args.evidenceByCriterion[criterion.id] || [];
        const validatedRes = validateEvidenceReferences(res, evidence);

        const inputHash = stableHash({
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
            coreIdentity: args.personalContext.coreIdentity,
            motivations: args.personalContext.motivations,
            direction: args.personalContext.direction,
          },
          engineVersion: MATCHING_ENGINE_VERSION,
          criterionPromptVersion: promptVersion,
        });

        allSignals.push({
          criterionId: validatedRes.criterionId,
          alignment: validatedRes.alignment,
          directEvidenceIds: validatedRes.directEvidenceIds,
          supportingEvidenceIds: validatedRes.supportingEvidenceIds,
          reasoning: validatedRes.reasoning,
          missingEvidence: validatedRes.missingEvidence,
          evidenceQuality: validatedRes.evidenceQuality,
          confidence: validatedRes.confidence,
          applicantEvidenceIds: validatedRes.evidenceIds,
          opportunity: validatedRes.positioningOpportunity ?? null,
          criterionLabel: criterion.label,
          category: criterion.category,
          criterionSourceRefs: criterion.sourceRefs,
          inputHash,
        });
      }
      if (seenIds.size !== expectedIds.size) {
        throw new Error('Criterion batch omitted one or more requested criteria.');
      }
    } catch (err) {
      console.error('Batch processing failed', err);
      batchErrors.push(err instanceof Error ? err : new Error(String(err)));
    }
  }

  if (batchErrors.length > 0) {
    throw new BatchReasoningError(
      `Failed to process ${batchErrors.length} out of ${batches.length} criteria batches.`,
      allSignals,
      batchErrors
    );
  }

  return allSignals;
}

export async function generateMatchingSummary(args: {
  academicRequirements: HardRequirementMatch[];
  programmeAlignment: FitSignal[];
  strengths: MatchingStrength[];
  gaps: MatchingGap[];
  positioningOpportunities: PositioningOpportunity[];
  scholarshipAlignment: MatchingReportV2['scholarshipAlignment'];
  programmeFit: ProgrammeFit;
  generate?: typeof generateStructured;
}): Promise<MatchingSummaryResult> {
  const generate = args.generate ?? generateStructured;
  const { systemPrompt, version: promptVersion } = getReportPrompt('matching_report_summary');

  const validCriterionIds = new Set<string>();
  const validEvidenceIds = new Set<string>();

  const collectIds = (items: Array<Record<string, unknown>> | undefined | null) => {
    if (!items || !Array.isArray(items)) return;
    for (const item of items) {
      if (typeof item.criterionId === 'string') validCriterionIds.add(item.criterionId);
      if (Array.isArray(item.criterionIds)) {
        item.criterionIds.forEach((id: unknown) => {
          if (typeof id === 'string') validCriterionIds.add(id);
        });
      }
      if (Array.isArray(item.evidenceIds)) {
        item.evidenceIds.forEach((id: unknown) => {
          if (typeof id === 'string') validEvidenceIds.add(id);
        });
      }
      if (Array.isArray(item.currentEvidenceIds)) {
        item.currentEvidenceIds.forEach((id: unknown) => {
          if (typeof id === 'string') validEvidenceIds.add(id);
        });
      }
      if (Array.isArray(item.applicantEvidenceIds)) {
        item.applicantEvidenceIds.forEach((id: unknown) => {
          if (typeof id === 'string') validEvidenceIds.add(id);
        });
      }
      if (Array.isArray(item.directEvidenceIds)) {
        item.directEvidenceIds.forEach((id: unknown) => {
          if (typeof id === 'string') validEvidenceIds.add(id);
        });
      }
      if (Array.isArray(item.supportingEvidenceIds)) {
        item.supportingEvidenceIds.forEach((id: unknown) => {
          if (typeof id === 'string') validEvidenceIds.add(id);
        });
      }
      if (typeof item.id === 'string' && (item.statement || item.status)) validEvidenceIds.add(item.id);
    }
  };

  collectIds(args.academicRequirements as unknown as Array<Record<string, unknown>>);
  collectIds(args.programmeAlignment as unknown as Array<Record<string, unknown>>);
  collectIds(args.strengths as unknown as Array<Record<string, unknown>>);
  collectIds(args.gaps as unknown as Array<Record<string, unknown>>);
  collectIds(args.positioningOpportunities as unknown as Array<Record<string, unknown>>);
  if (args.scholarshipAlignment) {
    collectIds((args.scholarshipAlignment.hardRequirements ?? []) as unknown as Array<Record<string, unknown>>);
    collectIds(args.scholarshipAlignment.criteria as unknown as Array<Record<string, unknown>>);
    collectIds(args.scholarshipAlignment.strengths as unknown as Array<Record<string, unknown>>);
    collectIds(args.scholarshipAlignment.gaps as unknown as Array<Record<string, unknown>>);
  }

  const inputData = {
    academicRequirements: args.academicRequirements,
    programmeAlignment: args.programmeAlignment,
    strengths: args.strengths,
    gaps: args.gaps,
    positioningOpportunities: args.positioningOpportunities,
    scholarshipAlignment: args.scholarshipAlignment,
    programmeFit: args.programmeFit,
  };

  const userPrompt = JSON.stringify(inputData, null, 2);

  const result = await generate({
    moduleId: 'matching_report_summary',
    promptVersion,
    schemaVersion: 'matching-summary-v2.0.0',
    systemPrompt,
    userPrompt,
    schema: matchingSummaryResultSchema,
  });

  const summary = result.data;

  // Validate criterionIds and evidenceIds
  const checkUnknown = (ids: string[] | undefined | null, validSet: Set<string>, type: string) => {
    if (!ids || !Array.isArray(ids)) return;
    for (const id of ids) {
      if (!validSet.has(id)) {
        throw new Error(`Unknown ${type} ID in summary: ${id}`);
      }
    }
  };

  checkUnknown(summary.evidenceIds, validEvidenceIds, 'evidence');
  checkUnknown(summary.criterionIds, validCriterionIds, 'criterion');

  const summaryStr = summary.summary.toLowerCase();
  const forbidden = [
    /admission\s+(?:chance|probability|likelihood|odds)/i,
    /(?:chance|probability|likelihood|odds)\s+of\s+(?:being\s+)?admitted/i,
    /probability\s+of\s+acceptance/i,
    /guaranteed\s+admission/i,
    /will\s+be\s+admitted/i,
  ];
  if (forbidden.some((pattern) => pattern.test(summaryStr))) {
    throw new Error('Summary contains admissions-probability language.');
  }

  const failedHard = [
    ...args.academicRequirements,
    ...(args.scholarshipAlignment?.hardRequirements ?? []),
  ].filter(
    (requirement) => requirement.status === 'does_not_meet',
  );
  if (
    failedHard.length > 0 &&
    /\b(?:all|every|each)\s+(?:entry\s+)?requirements?\s+(?:are\s+)?(?:met|satisfied)|fully\s+eligible\b/i.test(
      summaryStr,
    )
  ) {
    throw new Error('Summary contradicts a failed hard requirement.');
  }
  if (/\b(?:cannot|can not|unable to|incapable of|lacks the ability)\b/i.test(summaryStr)) {
    throw new Error('Summary turns missing evidence into an ability claim.');
  }

  return summary;
}

const V3_BATCH_SIZE = 6;

function targetFactsForMetric(profile: TargetProfile, metricId: string) {
  const targetRefs = targetRefsForMetric(profile, metricId);
  return [
    ...profile.requirements
      .filter((item) => item.sourceRefs.some((ref) => targetRefs.includes(ref)))
      .map((item) => ({ id: item.id, label: item.label, detail: item.detail, sourceRefs: item.sourceRefs })),
    ...targetStructuredFacts(profile).filter((item) => item.sourceRefs.some((ref) => targetRefs.includes(ref))),
  ];
}

function unavailableMetricResults(definition: V3MetricDefinition): MatchingV3MetricResult[] {
  return definition.submetrics.map((submetric) => ({
    metricId: definition.id,
    submetricId: submetric.id,
    status: 'not_available' as const,
    score: null,
    confidence: 0,
    reasoning: `No source-backed target data was available to assess ${submetric.label}.`,
    applicantEvidenceIds: [],
    targetSourceRefs: [],
    missingEvidence: [`Source-backed target information for ${submetric.label}.`],
    limitations: ['The programme or university source data is not available in the catalogue.'],
  }));
}

function relevantV3Evidence(context: ApplicantMatchingContext, definitions: readonly V3MetricDefinition[]) {
  const tokens = new Set(
    definitions
      .flatMap((definition) => [definition.label, ...definition.submetrics.map((item) => item.label)])
      .join(' ')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 3),
  );
  return context.evidence
    .map((item) => ({
      item,
      rank: item.status === 'verified' ? 2 : item.status === 'report_only' ? 0 : 1,
      tokenHits: item.statement.toLowerCase().split(/[^a-z0-9]+/).filter((token) => tokens.has(token)).length,
    }))
    .sort((a, b) => b.tokenHits - a.tokenHits || b.rank - a.rank || a.item.id.localeCompare(b.item.id))
    .slice(0, 12)
    .map(({ item }) => item);
}

export async function reasonAboutV3Metrics(args: {
  definitions: readonly V3MetricDefinition[];
  context: ApplicantMatchingContext;
  targetProfile: TargetProfile;
  previousReport?: MatchingReportV3 | null;
  generate?: typeof generateStructured;
}): Promise<{
  results: MatchingV3MetricResult[];
  metricBatches: number;
  providerCalls: number;
  metricInputHashes: Record<string, string>;
  reusedMetricIds: string[];
}> {
  const generate = args.generate ?? generateStructured;
  const { systemPrompt, version: promptVersion } = getReportPrompt('matching_metric_reasoning');
  const metricInputHashes: Record<string, string> = {};
  const reusable = new Map<string, MatchingV3MetricResult[]>();
  const unavailable = new Map<string, MatchingV3MetricResult[]>();
  for (const definition of args.definitions) {
    const targetRefs = targetRefsForMetric(args.targetProfile, definition.id);
    const targetFacts = targetFactsForMetric(args.targetProfile, definition.id);
    const input = {
      definition,
      applicantContext: args.context,
      evidence: relevantV3Evidence(args.context, [definition]),
      targetSourceRefs: targetRefs,
      targetFacts,
    };
    const inputHash = stableHash({ input, promptVersion });
    metricInputHashes[definition.id] = inputHash;
    if (targetFacts.length === 0) {
      unavailable.set(definition.id, unavailableMetricResults(definition));
      continue;
    }
    const previousFit = args.previousReport
      ? UNIVERSITY_FIT_METRICS.some((item) => item.id === definition.id)
        ? args.previousReport.universityFit
        : args.previousReport.programmeFit
      : null;
    const previousMetrics = previousFit?.metrics as Record<string, { submetrics: MatchingV3MetricResult[] }> | undefined;
    const previousCompatible = args.previousReport?.metadata.matchingEngineVersion === MATCHING_ENGINE_V3_VERSION &&
      args.previousReport.metadata.metricPromptVersion === promptVersion;
    const previousMetric = previousCompatible && args.previousReport?.metadata.metricInputHashes[definition.id] === inputHash
      ? previousMetrics?.[definition.id] ?? null
      : null;
    if (previousMetric && previousMetric.submetrics.length === definition.submetrics.length) {
      reusable.set(definition.id, previousMetric.submetrics);
    }
  }
  const activeDefinitions = args.definitions.filter((definition) => !unavailable.has(definition.id) && !reusable.has(definition.id));
  const batches: Array<{ definition: V3MetricDefinition; submetrics: V3MetricDefinition['submetrics'] }> = [];
  const submetrics = activeDefinitions.flatMap((definition) =>
    definition.submetrics.map((submetric) => ({ definition, submetric })),
  );
  for (let i = 0; i < submetrics.length; i += V3_BATCH_SIZE) {
    const chunk = submetrics.slice(i, i + V3_BATCH_SIZE);
    const grouped = new Map<string, { definition: V3MetricDefinition; submetrics: V3MetricDefinition['submetrics'] }>();
    for (const item of chunk) {
      const current = grouped.get(item.definition.id) ?? { definition: item.definition, submetrics: [] };
      current.submetrics.push(item.submetric);
      grouped.set(item.definition.id, current);
    }
    batches.push(...grouped.values());
  }

  const results: MatchingV3MetricResult[] = [...unavailable.values(), ...reusable.values()].flat();
  let providerCalls = 0;
  const evidenceById = new Map(args.context.evidence.map((item) => [item.id, item]));

  for (const batch of batches) {
    const targetRefs = targetRefsForMetric(args.targetProfile, batch.definition.id);
    const batchEvidence = relevantV3Evidence(args.context, [batch.definition]);
    const targetFacts = targetFactsForMetric(args.targetProfile, batch.definition.id);
    const input = {
      metrics: [{
        metricId: batch.definition.id,
        label: batch.definition.label,
        submetrics: batch.submetrics,
      }],
      applicantContext: args.context,
      evidence: batchEvidence,
      targetFacts,
      targetSourceRefs: targetRefs,
    };
    const generated = await generate({
      moduleId: 'matching_metric_reasoning',
      promptVersion,
      schemaVersion: 'matching-metric-v3.1.0',
      systemPrompt,
      userPrompt: JSON.stringify(input),
      schema: z.object({ results: z.array(matchingV3MetricResultSchema) }).strict(),
    });
    providerCalls += generated.meta.attemptCount;

    const expected = new Set(batch.submetrics.map((item) => item.id));
    const seen = new Set<string>();
    if (generated.data.results.length !== expected.size) {
      throw new Error(`Metric batch returned ${generated.data.results.length} results for ${expected.size} submetrics.`);
    }
    for (const result of generated.data.results) {
      if (result.metricId !== batch.definition.id || !expected.has(result.submetricId)) {
        throw new Error(`Metric batch returned an unknown result: ${result.metricId}/${result.submetricId}`);
      }
      if (seen.has(result.submetricId)) throw new Error(`Duplicate submetric result: ${result.submetricId}`);
      seen.add(result.submetricId);
      for (const id of result.applicantEvidenceIds) {
        const item = evidenceById.get(id);
        if (!item) throw new Error(`Unknown applicant evidence id: ${id}`);
        if (item.status === 'conflicting') throw new Error(`Conflicting evidence cannot support a metric: ${id}`);
      }
      for (const ref of result.targetSourceRefs) {
        if (!targetRefs.includes(ref)) throw new Error(`Unknown target source ref: ${ref}`);
      }
      const hasGroundedEvidence = result.applicantEvidenceIds.some((id) => {
        const item = evidenceById.get(id);
        return item?.status === 'verified' || item?.status === 'unverified';
      });
      if (result.score !== null && result.score > 50 && !hasGroundedEvidence) {
        throw new Error(`Strong metric result has no grounded applicant evidence: ${result.submetricId}`);
      }
      if (result.score !== null && result.score > 50 && targetRefs.length === 0) {
        throw new Error(`Strong metric result has no grounded target source: ${result.submetricId}`);
      }
      results.push(
        batch.definition.id === 'academicReadiness'
          ? { ...result, score: normalizeAcademicRubricScore(result.score) }
          : result,
      );
    }
  }
  return { results, metricBatches: batches.length, providerCalls, metricInputHashes, reusedMetricIds: [...reusable.keys()] };
}

const v3SummaryOutputSchema = z.object({
  summary: z.string().trim().min(40).max(1_600),
  keyTakeaways: v3KeyTakeawaysSchema,
}).strict();

export type MatchingV3SummaryOutput = z.infer<typeof v3SummaryOutputSchema>;

export async function generateMatchingV3Summary(args: {
  candidate: unknown;
  evidenceIds: readonly string[];
  targetSourceRefs: readonly string[];
  metricIds: readonly string[];
  hardRequirements?: readonly { status: string }[];
  generate?: typeof generateStructured;
}): Promise<{ data: MatchingV3SummaryOutput; providerCalls: number }> {
  const generate = args.generate ?? generateStructured;
  const { systemPrompt, version: promptVersion } = getReportPrompt('matching_report_summary_v3');
  const result = await generate({
    moduleId: 'matching_report_summary_v3',
    promptVersion,
    schemaVersion: 'matching-report-v3.1.0',
    systemPrompt,
    userPrompt: JSON.stringify(args.candidate),
    schema: v3SummaryOutputSchema,
  });
  const evidenceIds = new Set(args.evidenceIds);
  const targetSourceRefs = new Set(args.targetSourceRefs);
  const metricIds = new Set(args.metricIds);
  const forbidden = /admission\s+(?:chance|probability|likelihood|odds)|(?:chance|probability|likelihood|odds)\s+of\s+(?:being\s+)?admitted|probability\s+of\s+acceptance|guaranteed\s+admission|will\s+be\s+admitted/i;
  const copy = [result.data.summary, ...Object.values(result.data.keyTakeaways).flatMap((takeaway) => [takeaway.title, takeaway.body])].join(' ');
  if (forbidden.test(copy)) throw new Error('V3 summary contains admissions-probability language.');
  if (args.hardRequirements?.some((requirement) => requirement.status === 'not_met') && /(?:all|every)\s+(?:hard\s+)?requirements?\s+(?:are\s+)?met|fully\s+eligible/i.test(copy)) {
    throw new Error('V3 summary contradicts a failed hard requirement.');
  }
  if (/\b(?:cannot|can\'t|unable to|lacks the ability|not capable of)\b/i.test(copy)) {
    throw new Error('V3 summary treats missing evidence as inability.');
  }
  for (const takeaway of Object.values(result.data.keyTakeaways)) {
    if (takeaway.evidenceIds.some((id) => !evidenceIds.has(id))) throw new Error('V3 summary returned an unknown evidence id.');
    if (takeaway.targetSourceRefs.some((ref) => !targetSourceRefs.has(ref))) throw new Error('V3 summary returned an unknown target source ref.');
    if (takeaway.metricIds.some((id) => !metricIds.has(id))) throw new Error('V3 summary returned an unknown metric id.');
  }
  return { data: result.data, providerCalls: result.meta.attemptCount };
}
