import { z } from 'zod';
import { generateStructured, type StructuredGenerationResult } from '@/lib/ai/runtime/structured-generation';
import { REPORT_PROMPT_VERSIONS, getReportPrompt } from '@/lib/ai/runtime/prompt-registry';
import { validateEvidenceReferences } from './evidence';
import {
  criterionMatchResultSchema,
  matchingSummaryResultSchema,
  type CriterionMatchResult,
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
  const { systemPrompt } = getReportPrompt('matching_criterion_reasoning');
  
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

      const evidenceData: Record<string, any[]> = {};
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
        promptId: 'matching_criterion_reasoning',
        systemPrompt,
        userPrompt,
        schema: z.object({ results: z.array(criterionMatchResultSchema) }).strict(),
      });

      const batchResults = result.data.results;

      for (const res of batchResults) {
        const criterion = batch.find(c => c.id === res.criterionId);
        if (!criterion) continue;

        const evidence = args.evidenceByCriterion[criterion.id] || [];
        const validatedRes = validateEvidenceReferences(res, evidence);

        const inputHash = stableHash({
          criterion,
          evidence,
          personalContext: args.personalContext,
        });

        allSignals.push({
          ...validatedRes,
          criterionLabel: criterion.label,
          category: criterion.category,
          criterionSourceRefs: criterion.sourceRefs,
          inputHash,
        });
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

  const collectIds = (items: any[]) => {
    for (const item of items) {
      if (item.criterionId) validCriterionIds.add(item.criterionId);
      if (item.evidenceIds) item.evidenceIds.forEach((id: string) => validEvidenceIds.add(id));
      if (item.id && (item.statement || item.status)) validEvidenceIds.add(item.id); // It's an evidence itself
      if (item.signals) {
        item.signals.forEach((sig: any) => {
          if (sig.criterionId) validCriterionIds.add(sig.criterionId);
        });
      }
    }
  };

  collectIds(args.programmeAlignment);
  collectIds(args.strengths);
  collectIds(args.gaps);
  if (args.scholarshipAlignment) {
    collectIds(args.scholarshipAlignment.signals);
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
    promptId: 'matching_report_summary',
    systemPrompt,
    userPrompt,
    schema: matchingSummaryResultSchema,
  });

  const summary = result.data;

  // Validate criterionIds and evidenceIds
  const checkUnknown = (ids: string[], validSet: Set<string>, type: string) => {
    for (const id of ids) {
      if (!validSet.has(id)) {
        throw new Error(`Unknown ${type} ID in summary: ${id}`);
      }
    }
  };

  checkUnknown(summary.evidenceIds, validEvidenceIds, 'evidence');
  checkUnknown(summary.criterionIds, validCriterionIds, 'criterion');

  // Check forbidden phrases
  const summaryStr = JSON.stringify(summary).toLowerCase();
  const forbidden = ["admission chance", "acceptance probability", "guaranteed admission"];
  for (const phrase of forbidden) {
    if (summaryStr.includes(phrase)) {
      throw new Error(`Summary contains forbidden phrase: ${phrase}`);
    }
  }

  return summary;
}
