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
    fitScore: z.number().min(0).max(100).nullable(),
    fitLabel: z.enum([
      'strong_current_alignment',
      'moderate_current_alignment',
      'limited_current_alignment',
      'not_assessed',
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

// V3 is additive. V2 constants and schemas remain available for historical
// rows and for the older strategy surfaces.
export const MATCHING_REPORT_V3_CONTRACT_VERSION = 'matching-report-v3' as const;
export const MATCHING_ENGINE_V3_VERSION = 'matching-v3.0.0' as const;
export const MATCHING_PROMPT_BUNDLE_V3_VERSION = 'matching-prompts-v3.0.0' as const;
export const MATCHING_FORMULA_V3_VERSION = 'matching-formula-v3.0.0' as const;

export const matchingV3MetricStatusSchema = z.enum(['assessed', 'limited', 'not_available']);
export type MatchingV3MetricStatus = z.infer<typeof matchingV3MetricStatusSchema>;

const v3MetricIdSchema = z.string().min(1).max(120);
export const matchingV3MetricResultSchema = z
  .object({
    metricId: v3MetricIdSchema,
    submetricId: z.string().min(1).max(160),
    status: matchingV3MetricStatusSchema,
    score: z.number().min(0).max(100).nullable(),
    confidence: z.number().min(0).max(1),
    reasoning: text,
    applicantEvidenceIds: z.array(nonEmptyId).max(30),
    targetSourceRefs: z.array(nonEmptyId).max(30),
    missingEvidence: z.array(z.string().min(1).max(500)).max(20),
    limitations: z.array(z.string().min(1).max(500)).max(20),
  })
  .strict()
  .superRefine((result, ctx) => {
    if (result.status === 'not_available' && result.score !== null) {
      ctx.addIssue({ code: 'custom', path: ['score'], message: 'Not-available metrics cannot have a score.' });
    }
    if (result.status === 'assessed' && result.score === null) {
      ctx.addIssue({ code: 'custom', path: ['score'], message: 'Assessed metrics require a score.' });
    }
  });

export type MatchingV3MetricResult = z.infer<typeof matchingV3MetricResultSchema>;

const v3MetricSchema = z
  .object({
    id: v3MetricIdSchema,
    score: z.number().min(0).max(100).nullable(),
    status: matchingV3MetricStatusSchema,
    confidence: z.number().min(0).max(1),
    coverage: z.number().min(0).max(100),
    summary: text,
    submetrics: z.array(matchingV3MetricResultSchema).min(1).max(10),
  })
  .strict();
export type MatchingV3Metric = z.infer<typeof v3MetricSchema>;

const v3UniversityMetricsSchema = z
  .object({
    academicReadiness: v3MetricSchema,
    valuesAlignment: v3MetricSchema,
    communityContribution: v3MetricSchema,
    learningEnvironment: v3MetricSchema,
    distinctiveOpportunity: v3MetricSchema,
  })
  .strict();

const v3ProgrammeMetricsSchema = z
  .object({
    interestMotivation: v3MetricSchema,
    capability: v3MetricSchema,
    experienceExposure: v3MetricSchema,
    careerFutureDirection: v3MetricSchema,
  })
  .strict();

const v3FitSchema = z
  .object({
    score: z.number().min(0).max(100).nullable(),
    status: matchingV3MetricStatusSchema,
    confidence: z.number().min(0).max(1),
    coverage: z.number().min(0).max(100),
    summary: text,
  })
  .strict();

const v3UniversityFitSchema = v3FitSchema.extend({ metrics: v3UniversityMetricsSchema }).strict();
const v3ProgrammeFitSchema = v3FitSchema
  .extend({
    metrics: v3ProgrammeMetricsSchema,
    strongestAlignment: z.array(nonEmptyId).max(20),
    potentialGap: z.string().max(1_000).nullable(),
    strategicInterpretation: z.string().max(2_000).nullable(),
  })
  .strict();

const v3HardRequirementSchema = z
  .object({
    id: nonEmptyId,
    kind: z.enum(['academic', 'qualification', 'subject', 'language', 'document', 'deadline', 'other']),
    label: z.string().min(1).max(300),
    status: z.enum(['met', 'not_met', 'unknown', 'not_applicable']),
    applicantValue: z.union([z.string(), z.number(), z.null()]),
    requiredValue: z.union([z.string(), z.number(), z.null()]),
    explanation: text,
    evidenceIds: z.array(nonEmptyId).max(30),
    targetSourceRefs: z.array(nonEmptyId).max(30),
  })
  .strict();

const v3InsightSchema = z
  .object({
    id: nonEmptyId,
    title: z.string().min(1).max(300),
    description: text,
    evidenceIds: z.array(nonEmptyId).max(30),
    targetSourceRefs: z.array(nonEmptyId).max(30),
  })
  .strict();

const v3KeyTakeawaySchema = z
  .object({
    title: z.string().min(1).max(300),
    body: text,
    evidenceIds: z.array(nonEmptyId).max(30),
    targetSourceRefs: z.array(nonEmptyId).max(30),
    metricIds: z.array(v3MetricIdSchema).max(20),
  })
  .strict();

const v3EvidenceIndexSchema = z
  .object({
    id: nonEmptyId,
    label: z.string().min(1).max(300),
    statement: text,
    kind: z.enum(['applicant', 'hard_requirement']),
    status: z.enum(['verified', 'unverified', 'conflicting', 'report_only']),
    sourceRefs: z.array(nonEmptyId).max(30),
    direct: z.boolean(),
  })
  .strict();

const v3TargetSourceIndexSchema = z
  .object({
    ref: nonEmptyId,
    label: z.string().min(1).max(300),
    title: z.string().max(300).nullable(),
    url: z.string().max(2_000).nullable(),
    kind: z.enum(['university', 'programme', 'requirement', 'scholarship']),
  })
  .strict();

const v3MetadataSchema = z
  .object({
    matchingEngineVersion: nonEmptyId,
    promptVersion: nonEmptyId,
    metricPromptVersion: nonEmptyId,
    summaryPromptVersion: nonEmptyId,
    formulaVersion: nonEmptyId,
    model: nonEmptyId,
    targetProfileVersionId: nonEmptyId,
    targetProfileSchemaVersion: nonEmptyId,
    personalReportVersionId: nonEmptyId,
    personalReportInputHash: nonEmptyId,
    sourceAnalysisVersionId: nonEmptyId,
    confirmedSnapshotId: nonEmptyId,
    evidenceBankVersion: nonEmptyId,
    selectedScholarshipKey: nonEmptyId.nullable(),
    selectedScholarshipVersionId: nonEmptyId.nullable(),
    reusedMetricIds: z.array(v3MetricIdSchema).max(100),
    metricInputHashes: z.record(z.string().min(1), nonEmptyId),
    aiCallCount: z
      .object({
        metricBatches: z.number().int().min(0),
        providerCalls: z.number().int().min(0),
        summary: z.literal(1),
      })
      .strict(),
  })
  .strict();

const v3OverallSchema = z
  .object({
    summary: text,
    overallAlignmentScore: z.number().min(0).max(100).nullable(),
    evidenceCoverage: z.number().min(0).max(100),
    confidence: z.number().min(0).max(1),
    strongestAlignment: z.array(v3MetricIdSchema).max(20),
    criticalGaps: z.array(nonEmptyId).max(20),
    summaryEvidenceIds: z.array(nonEmptyId).max(30),
    summaryTargetSourceRefs: z.array(nonEmptyId).max(30),
  })
  .strict();

export const matchingReportV3Schema = z
  .object({
    contractVersion: z.literal(MATCHING_REPORT_V3_CONTRACT_VERSION),
    generatedAt: z.string().min(1),
    overall: v3OverallSchema,
    universityFit: v3UniversityFitSchema,
    programmeFit: v3ProgrammeFitSchema,
    hardRequirements: z.array(v3HardRequirementSchema).max(100),
    scholarshipAlignment: v3FitSchema.extend({ metrics: z.record(v3MetricIdSchema, v3MetricSchema) }).nullable(),
    strengths: z.array(v3InsightSchema).max(30),
    gaps: z.array(v3InsightSchema).max(30),
    positioningOpportunities: z.array(v3InsightSchema).max(30),
    keyTakeaways: z
      .object({
        strongestAlignment: v3KeyTakeawaySchema,
        criticalGap: v3KeyTakeawaySchema,
        evidenceToAdd: v3KeyTakeawaySchema,
        positioningNextStep: v3KeyTakeawaySchema,
      })
      .strict(),
    evidenceIndex: z.array(v3EvidenceIndexSchema).max(200),
    targetSourceIndex: z.array(v3TargetSourceIndexSchema).max(100),
    metadata: v3MetadataSchema,
  })
  .strict()
  .superRefine((report, ctx) => {
    const expectedSubmetrics: Record<string, string[]> = {
      academicReadiness: ['academicPreparation', 'curriculumReadiness', 'academicEvidence', 'academicRequirements'],
      valuesAlignment: ['missionValues', 'educationalPhilosophy', 'communityValues', 'personalPositioning'],
      communityContribution: ['contributionEvidence', 'socialProof', 'collaboration', 'communityOpportunity'],
      learningEnvironment: ['teachingModel', 'experientialLearning', 'classStructure', 'environmentPreference'],
      distinctiveOpportunity: ['namedOpportunity', 'opportunityFit', 'accessPath', 'distinctiveness'],
      interestMotivation: ['statedInterest', 'motivationGrounding', 'themeAlignment', 'subjectExploration'],
      capability: ['targetCompetencies', 'academicCapability', 'demonstratedSkills', 'capabilityEvidence'],
      experienceExposure: ['relevantExperience', 'meaningfulEngagement', 'reflectionDepth', 'exposureRange'],
      careerFutureDirection: ['futureDirection', 'pathwayAlignment', 'opportunityUse', 'directionEvidence'],
    };
    const evidence = new Map(report.evidenceIndex.map((item) => [item.id, item]));
    const sources = new Map(report.targetSourceIndex.map((item) => [item.ref, item]));
    const checkRefs = (ids: string[], known: Map<string, unknown>, path: (string | number)[]) => {
      for (const id of ids) {
        if (!known.has(id)) ctx.addIssue({ code: 'custom', path, message: `Unknown reference: ${id}` });
      }
    };
    const checkEvidence = (ids: string[], path: (string | number)[]) => checkRefs(ids, evidence, path);
    const checkSources = (refs: string[], path: (string | number)[]) => {
      checkRefs(refs, sources, path);
      for (const ref of refs) {
        if (sources.get(ref)?.kind === 'scholarship') {
          ctx.addIssue({ code: 'custom', path, message: 'Programme fit cannot cite scholarship sources.' });
        }
      }
    };
    const metricIds = new Set([
      ...Object.keys(report.universityFit.metrics),
      ...Object.keys(report.programmeFit.metrics),
    ]);
    for (const item of report.evidenceIndex) {
      if (item.direct && (item.status !== 'verified' || item.sourceRefs.length === 0 || item.kind !== 'applicant')) {
        ctx.addIssue({ code: 'custom', path: ['evidenceIndex'], message: 'Direct evidence must be verified applicant evidence with raw source references.' });
      }
      if (item.status === 'conflicting' && item.direct) {
        ctx.addIssue({ code: 'custom', path: ['evidenceIndex'], message: 'Conflicting evidence cannot be direct evidence.' });
      }
    }
    for (const fit of [report.universityFit, report.programmeFit]) {
      for (const [metricKey, metric] of Object.entries(fit.metrics)) {
        if (metric.id !== metricKey) {
          ctx.addIssue({ code: 'custom', path: ['metrics', metricKey, 'id'], message: 'Metric id must match its key.' });
        }
        const seen = new Set<string>();
        const expected = expectedSubmetrics[metricKey] ?? [];
        if (metric.submetrics.length !== expected.length || expected.some((id) => !metric.submetrics.some((item) => item.submetricId === id))) {
          ctx.addIssue({ code: 'custom', path: ['metrics', metricKey, 'submetrics'], message: 'Metric must contain exactly one result for every requested submetric.' });
        }
        for (const submetric of metric.submetrics) {
          if (seen.has(submetric.submetricId)) {
            ctx.addIssue({ code: 'custom', path: ['metrics', metricKey, 'submetrics'], message: 'Duplicate submetric result.' });
          }
          seen.add(submetric.submetricId);
          checkEvidence(submetric.applicantEvidenceIds, ['metrics', metricKey, 'submetrics']);
          checkSources(submetric.targetSourceRefs, ['metrics', metricKey, 'submetrics']);
          if (submetric.applicantEvidenceIds.some((id) => evidence.get(id)?.kind === 'hard_requirement')) {
            ctx.addIssue({ code: 'custom', path: ['metrics', metricKey], message: 'Hard requirements cannot be semantic metric evidence.' });
          }
        }
      }
    }
    for (const requirement of report.hardRequirements) {
      checkEvidence(requirement.evidenceIds, ['hardRequirements']);
      checkRefs(requirement.targetSourceRefs, sources, ['hardRequirements']);
    }
    for (const list of [report.strengths, report.gaps, report.positioningOpportunities]) {
      for (const item of list) {
        checkEvidence(item.evidenceIds, ['insights']);
        checkSources(item.targetSourceRefs, ['insights']);
      }
    }
    for (const takeaway of Object.values(report.keyTakeaways)) {
      checkEvidence(takeaway.evidenceIds, ['keyTakeaways']);
      checkSources(takeaway.targetSourceRefs, ['keyTakeaways']);
      for (const id of takeaway.metricIds) {
        if (!metricIds.has(id)) ctx.addIssue({ code: 'custom', path: ['keyTakeaways'], message: `Unknown metric id: ${id}` });
      }
    }
    checkEvidence(report.overall.summaryEvidenceIds, ['overall', 'summaryEvidenceIds']);
    checkSources(report.overall.summaryTargetSourceRefs, ['overall', 'summaryTargetSourceRefs']);
    for (const metricId of report.overall.strongestAlignment) {
      if (!metricIds.has(metricId)) ctx.addIssue({ code: 'custom', path: ['overall', 'strongestAlignment'], message: `Unknown metric id: ${metricId}` });
    }
  });

export type MatchingReportV3 = z.infer<typeof matchingReportV3Schema>;
