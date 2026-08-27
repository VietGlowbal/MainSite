import { z } from 'zod';
import { programmeFitSchema } from '@/features/apply/domain';

export const MATCHING_REPORT_CONTRACT_VERSION = 'matching-report-v2' as const;
export const MATCHING_ENGINE_VERSION = 'matching-v2.0.0' as const;
export const MATCHING_PROMPT_BUNDLE_VERSION = 'matching-prompts-v2.0.0' as const;

export const criterionCategorySchema = z.enum([
  'academic_requirement',
  'academic_preparation',
  'competency',
  'selection_criterion',
  'programme_value',
  'motivation',
  'experience',
  'scholarship',
]);
export type CriterionCategory = z.infer<typeof criterionCategorySchema>;

export const criterionImportanceSchema = z.enum(['critical', 'high', 'medium', 'low']);
export type CriterionImportance = z.infer<typeof criterionImportanceSchema>;

export const requirementTypeSchema = z.enum(['hard', 'soft', 'preference', 'unknown']);
export type RequirementType = z.infer<typeof requirementTypeSchema>;

export const alignmentSchema = z.enum(['strong', 'moderate', 'weak', 'missing']);
export type Alignment = z.infer<typeof alignmentSchema>;

export const evidenceQualitySchema = z.enum(['strong', 'mixed', 'weak', 'none']);
export type EvidenceQuality = z.infer<typeof evidenceQualitySchema>;

const nonEmptyId = z.string().min(1).max(240);
const text = z.string().min(1).max(4_000);

export const matchingCriterionSchema = z
  .object({
    id: nonEmptyId,
    category: criterionCategorySchema,
    label: z.string().min(1).max(300),
    description: z.string().min(1).max(4_000),
    importance: criterionImportanceSchema,
    requirementType: requirementTypeSchema,
    sourceRefs: z.array(nonEmptyId).max(20),
    sourceText: z.string().max(4_000).nullable(),
    expectedSignals: z.array(z.string().min(1).max(200)).max(30),
    negativeSignals: z.array(z.string().min(1).max(200)).max(30),
    metadata: z
      .object({
        importanceSource: z.enum(['source', 'default']),
        targetRequirementId: nonEmptyId.nullable(),
        missingInformation: z.string().max(500).nullable(),
      })
      .strict(),
  })
  .strict();
export type MatchingCriterion = z.infer<typeof matchingCriterionSchema>;

export const matchingEvidenceSchema = z
  .object({
    id: nonEmptyId,
    category: z.string().min(1).max(120),
    statement: text,
    sourceRefs: z.array(nonEmptyId).max(30),
    interpretationRefs: z.array(nonEmptyId).max(30),
    status: z.enum(['verified', 'unverified', 'conflicting', 'report_only']),
    competencies: z.array(z.string().min(1).max(200)).max(30),
    criteria: z.array(z.string().min(1).max(240)).max(30),
    direct: z.boolean(),
    rankScore: z.number().finite(),
  })
  .strict();
export type MatchingEvidence = z.infer<typeof matchingEvidenceSchema>;

export const hardRequirementMatchSchema = z
  .object({
    criterionId: nonEmptyId,
    status: z.enum([
      'meets',
      'possibly_meets',
      'does_not_meet',
      'insufficient_information',
      'not_applicable',
    ]),
    applicantValue: z.union([z.string(), z.number(), z.null()]),
    requiredValue: z.union([z.string(), z.number(), z.null()]),
    evidenceIds: z.array(nonEmptyId).max(30),
    explanation: text,
  })
  .strict();
export type HardRequirementMatch = z.infer<typeof hardRequirementMatchSchema>;

export const fitSignalSchema = z
  .object({
    criterionId: nonEmptyId,
    category: criterionCategorySchema,
    criterionLabel: z.string().min(1).max(300),
    criterionSourceRefs: z.array(nonEmptyId).max(20),
    applicantEvidenceIds: z.array(nonEmptyId).max(30),
    directEvidenceIds: z.array(nonEmptyId).max(30),
    supportingEvidenceIds: z.array(nonEmptyId).max(30),
    alignment: alignmentSchema,
    evidenceQuality: evidenceQualitySchema,
    reasoning: text,
    missingEvidence: z.array(z.string().min(1).max(500)).max(20),
    confidence: z.number().min(0).max(1),
    opportunity: z.string().max(1_000).nullable(),
    inputHash: nonEmptyId,
  })
  .strict();
export type FitSignal = z.infer<typeof fitSignalSchema>;

export const matchingStrengthSchema = z
  .object({
    id: nonEmptyId,
    title: z.string().min(1).max(300),
    description: text,
    criterionIds: z.array(nonEmptyId).max(30),
    evidenceIds: z.array(nonEmptyId).max(30),
    strength: z.enum(['high', 'medium']),
    whyItMatters: text,
    positioningUse: z.string().max(1_000).nullable(),
  })
  .strict();
export type MatchingStrength = z.infer<typeof matchingStrengthSchema>;

export const matchingGapSchema = z
  .object({
    id: nonEmptyId,
    type: z.enum([
      'hard_requirement',
      'missing_evidence',
      'weak_evidence',
      'capability_gap',
      'academic_gap',
      'direction_gap',
      'positioning_gap',
    ]),
    title: z.string().min(1).max(300),
    description: text,
    criterionIds: z.array(nonEmptyId).max(30),
    currentEvidenceIds: z.array(nonEmptyId).max(30),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    fixability: z.enum(['high', 'medium', 'low']),
    evidenceNeeded: z.array(z.string().min(1).max(500)).max(20),
    whyItMatters: text,
    priority: z.number().int().min(0),
  })
  .strict();
export type MatchingGap = z.infer<typeof matchingGapSchema>;

export const positioningOpportunitySchema = z
  .object({
    id: nonEmptyId,
    title: z.string().min(1).max(300),
    criterionIds: z.array(nonEmptyId).max(30),
    evidenceIds: z.array(nonEmptyId).max(30),
    currentInterpretation: text,
    recommendedPositioning: text,
    rationale: text,
    confidence: z.number().min(0).max(1),
  })
  .strict();
export type PositioningOpportunity = z.infer<typeof positioningOpportunitySchema>;

export const matchingSummaryResultSchema = z
  .object({
    summary: z.string().trim().min(80).max(1_600),
    criterionIds: z.array(nonEmptyId).max(30),
    evidenceIds: z.array(nonEmptyId).max(30),
  })
  .strict();
export type MatchingSummaryResult = z.infer<typeof matchingSummaryResultSchema>;

/** Structured output used by the semantic criterion reasoner before projection to FitSignal. */
export const criterionMatchResultSchema = z
  .object({
    criterionId: nonEmptyId,
    alignment: alignmentSchema,
    evidenceIds: z.array(nonEmptyId).max(30),
    directEvidenceIds: z.array(nonEmptyId).max(30),
    supportingEvidenceIds: z.array(nonEmptyId).max(30),
    reasoning: text,
    missingEvidence: z.array(z.string().min(1).max(500)).max(20),
    evidenceQuality: evidenceQualitySchema,
    confidence: z.number().min(0).max(1),
    positioningOpportunity: z.string().max(1_000).optional(),
  })
  .strict();
export type CriterionMatchResult = z.infer<typeof criterionMatchResultSchema>;

const matchingMetadataSchema = z
  .object({
    matchingEngineVersion: nonEmptyId,
    promptVersion: nonEmptyId,
    criterionPromptVersion: nonEmptyId,
    summaryPromptVersion: nonEmptyId,
    model: nonEmptyId,
    targetProfileVersionId: nonEmptyId,
    personalReportVersionId: nonEmptyId,
    sourceAnalysisVersionId: nonEmptyId,
    confirmedSnapshotId: nonEmptyId,
    evidenceBankVersion: nonEmptyId,
    reusedCriterionIds: z.array(nonEmptyId).max(100),
    aiCallCount: z
      .object({
        criterionBatches: z.number().int().min(0),
        summary: z.literal(1),
      })
      .strict(),
  })
  .strict();

const overallMatchingResultSchema = z
  .object({
    summary: text,
    summaryCriterionIds: z.array(nonEmptyId).max(30),
    summaryEvidenceIds: z.array(nonEmptyId).max(30),
    strongestAlignment: z.array(nonEmptyId).max(30),
    mostImportantGaps: z.array(nonEmptyId).max(30),
    evidenceCoverage: z.number().min(0).max(100),
    fitScore: z.number().min(0).max(100),
    fitLabel: z.enum([
      'strong_current_alignment',
      'moderate_current_alignment',
      'limited_current_alignment',
    ]),
  })
  .strict();

const scholarshipAlignmentSchema = z
  .object({
    hardRequirements: z.array(hardRequirementMatchSchema).max(100).optional(),
    criteria: z.array(fitSignalSchema).max(100),
    strengths: z.array(matchingStrengthSchema).max(30),
    gaps: z.array(matchingGapSchema).max(30),
  })
  .strict();

const strictProgrammeFitSchema = programmeFitSchema.strict();

export const matchingReportV2Schema = z
  .object({
    contractVersion: z.literal(MATCHING_REPORT_CONTRACT_VERSION),
    generatedAt: z.string().min(1),
    overall: overallMatchingResultSchema,
    criteria: z.array(matchingCriterionSchema).max(100),
    academicRequirements: z.array(hardRequirementMatchSchema).max(100),
    programmeAlignment: z.array(fitSignalSchema).max(100),
    strengths: z.array(matchingStrengthSchema).max(30),
    gaps: z.array(matchingGapSchema).max(30),
    positioningOpportunities: z.array(positioningOpportunitySchema).max(30),
    scholarshipAlignment: scholarshipAlignmentSchema.nullable(),
    programmeFit: strictProgrammeFitSchema,
    dependencyIndex: z.record(z.string().min(1), z.array(nonEmptyId)),
    metadata: matchingMetadataSchema,
  })
  .strict()
  .superRefine((report, ctx) => {
    const byId = new Map(report.criteria.map((criterion) => [criterion.id, criterion]));
    const seenIds = new Set<string>();
    for (const criterion of report.criteria) {
      if (seenIds.has(criterion.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['criteria'],
          message: `Duplicate criterion ID: ${criterion.id}`,
        });
      }
      seenIds.add(criterion.id);
    }

    for (const [index, signal] of report.programmeAlignment.entries()) {
      const criterion = byId.get(signal.criterionId);
      if (!criterion) {
        ctx.addIssue({
          code: 'custom',
          path: ['programmeAlignment', index, 'criterionId'],
          message: 'Programme alignment references an unknown criterion.',
        });
        continue;
      }
      if (criterion.category === 'scholarship' || signal.category === 'scholarship') {
        ctx.addIssue({
          code: 'custom',
          path: ['programmeAlignment', index],
          message: 'Scholarship criteria must remain outside programme alignment.',
        });
      }
      if (criterion.requirementType === 'hard') {
        ctx.addIssue({
          code: 'custom',
          path: ['programmeAlignment', index],
          message: 'Hard criteria belong in academic requirements, not semantic batches.',
        });
      }
    }

    if (report.scholarshipAlignment) {
      for (const [index, requirement] of (report.scholarshipAlignment.hardRequirements ?? []).entries()) {
        const criterion = byId.get(requirement.criterionId);
        if (!criterion || criterion.category !== 'scholarship' || criterion.requirementType !== 'hard') {
          ctx.addIssue({
            code: 'custom',
            path: ['scholarshipAlignment', 'hardRequirements', index],
            message: 'Scholarship hard requirements must reference scholarship hard criteria.',
          });
        }
      }
      for (const [index, signal] of report.scholarshipAlignment.criteria.entries()) {
        const criterion = byId.get(signal.criterionId);
        if (criterion && criterion.category !== 'scholarship') {
          ctx.addIssue({
            code: 'custom',
            path: ['scholarshipAlignment', 'criteria', index],
            message: 'Scholarship alignment may contain scholarship criteria only.',
          });
        }
      }
    }
  });
export type MatchingReportV2 = z.infer<typeof matchingReportV2Schema>;
