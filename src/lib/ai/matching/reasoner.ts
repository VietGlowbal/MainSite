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
} from './domain';
import type { ProgrammeFit } from '@/features/apply/domain';
import { stableHash } from '@/features/apply/api';

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
