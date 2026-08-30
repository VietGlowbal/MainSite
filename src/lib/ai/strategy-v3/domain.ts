import { z } from 'zod';

export const STRATEGY_REPORT_V3_CONTRACT_VERSION = 'strategy-report-v3' as const;
export const STRATEGY_ENGINE_V3_VERSION = 'strategy-v3.1.1' as const;
export const STRATEGY_PRIORITY_FORMULA_VERSION =
  'impact-relevance-evidence-gap-feasibility-urgency-v2' as const;
export const STRATEGY_ACTIVITY_BATCH_SIZE = 6 as const;

export const STRATEGY_PHASE_KEYS = [
  'strengthen_foundation',
  'build_competitive_advantages',
  'craft_application',
  'finalise_optimise',
] as const;
export type StrategyPhaseKey = (typeof STRATEGY_PHASE_KEYS)[number];

const id = z.string().min(1).max(180);
const text = z.string().min(1).max(4_000);
const refs = z.array(id).max(80);

export const profileStrategyStatusSchema = z.enum(['maintain', 'develop', 'consolidate', 'build']);
export type ProfileStrategyStatus = z.infer<typeof profileStrategyStatusSchema>;

export const profileAreaDiagnosisSchema = z
  .object({
    key: id,
    category: z.enum(['academic', 'experience', 'differentiation', 'evidence']),
    label: z.string().min(1).max(200),
    status: profileStrategyStatusSchema,
    diagnosis: text,
    whyItMatters: text,
    suggestedDirection: text,
    evidenceIds: refs,
    metricIds: refs,
    requirementIds: refs,
    targetSourceRefs: refs,
  })
  .strict();
export type ProfileAreaDiagnosis = z.infer<typeof profileAreaDiagnosisSchema>;

const activityDimensionSchema = z
  .object({
    status: z.enum(['strong', 'developing', 'limited', 'not_established']),
    statement: text,
    evidenceIds: refs,
    targetSourceRefs: refs,
  })
  .strict();

export const activityStrategyClassificationSchema = z.enum([
  'maintain',
  'develop',
  'consolidate',
  'reposition',
  'deprioritize',
]);
export type ActivityStrategyClassification = z.infer<typeof activityStrategyClassificationSchema>;

export const activityStrategyAnalysisSchema = z
  .object({
    activityId: id,
    title: z.string().min(1).max(300),
    dimensions: z
      .object({
        relevance: activityDimensionSchema,
        responsibility: activityDimensionSchema,
        depth: activityDimensionSchema,
        progression: activityDimensionSchema,
        impact: activityDimensionSchema,
        evidence: activityDimensionSchema,
        reflection: activityDimensionSchema,
        futurePotential: activityDimensionSchema,
      })
      .strict(),
    classification: activityStrategyClassificationSchema,
    diagnosis: text,
    recommendedMove: text,
    evidenceIds: refs,
    targetSourceRefs: refs,
  })
  .strict();
export type ActivityStrategyAnalysis = z.infer<typeof activityStrategyAnalysisSchema>;

const priorityFactorsSchema = z
  .object({
    impact: z.number().int().min(0).max(4),
    relevance: z.number().int().min(0).max(4),
    evidenceGap: z.number().int().min(0).max(4),
    feasibility: z.number().int().min(0).max(4),
    urgency: z.number().int().min(0).max(4),
    rawPriority: z.number().int().min(0).max(4 ** 5),
  })
  .strict();
export type StrategyPriorityFactors = z.infer<typeof priorityFactorsSchema>;

export const strategyInterventionKindSchema = z.enum([
  'maintain',
  'deepen_existing',
  'consolidate_existing',
  'reposition_existing',
  'build_missing_dimension',
  'add_evidence',
  'fix_requirement',
]);
export type StrategyInterventionKind = z.infer<typeof strategyInterventionKindSchema>;

export const strategicPrioritySchema = z
  .object({
    key: z.string().regex(/^strategy-priority::[a-z0-9:_-]+$/),
    rank: z.number().int().min(1).max(3),
    title: z.string().min(1).max(300),
    why: text,
    suggestedDirection: text,
    interventionKind: strategyInterventionKindSchema,
    factors: priorityFactorsSchema,
    basisRefs: refs,
    evidenceIds: refs,
    gapIds: refs,
    requirementIds: refs,
    targetSourceRefs: refs,
  })
  .strict();
export type StrategicPriority = z.infer<typeof strategicPrioritySchema>;

const currentPositionSchema = z
  .object({
    summary: text,
    profileStrength: z.object({ statement: text, evidenceIds: refs, metricIds: refs }).strict(),
    keyChallenge: z.object({ statement: text, gapIds: refs, requirementIds: refs }).strict(),
    unclearArea: z.object({ statement: text, basis: refs }).strict().nullable().optional(),
    differentiatedPotential: z
      .object({ statement: text, evidenceIds: refs, metricIds: refs })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();

const strategicOverviewSchema = z
  .object({
    currentPosition: currentPositionSchema,
    strategicOpportunity: z.object({ statement: text, priorityKeys: z.array(id).max(3) }).strict(),
    strategicGoal: z.object({ directionOfImprovement: text, communicationGoal: text }).strict(),
    topPriorities: z.array(strategicPrioritySchema).max(3),
    expectedOutcome: text,
  })
  .strict();

const profileDevelopmentSchema = z
  .object({
    areas: z.array(profileAreaDiagnosisSchema).min(4).max(4),
    activityAnalyses: z.array(activityStrategyAnalysisSchema).max(500),
  })
  .strict();

export const narrativeGapTypeSchema = z.enum([
  'motivation_action_gap',
  'action_impact_gap',
  'experience_future_gap',
  'fragmentation',
]);
export type NarrativeGapType = z.infer<typeof narrativeGapTypeSchema>;

const narrativeStrategySchema = z
  .object({
    coreNarrativeDirection: z
      .object({
        originTrigger: text.nullable(),
        recurringMotivation: text.nullable(),
        actions: z.array(text).max(12),
        capabilitiesDeveloped: z.array(text).max(12),
        emergingDirection: text.nullable(),
        insight: text,
        evidenceIds: refs,
      })
      .strict(),
    supportingThemes: z
      .array(z.object({ key: id, title: z.string().min(1).max(200), evidenceIds: refs.min(1), significance: text }).strict())
      .max(5),
    narrativeTension: z
      .object({
        type: narrativeGapTypeSchema,
        observedGap: text,
        evidenceIds: refs.min(1),
        whyItMatters: text,
        possibleDirection: text,
      })
      .strict()
      .nullable(),
    narrativeOptions: z
      .array(
        z
          .object({
            key: id,
            title: z.string().min(1).max(200),
            centralIdea: text,
            whyItEmerges: text,
            supportingExperienceIds: refs.min(1),
            targetSourceRefs: refs.min(1),
            whatCouldStrengthenIt: text,
            evaluation: z
              .object({
                evidenceStrength: z.enum(['high', 'medium', 'low']),
                personalAuthenticity: z.enum(['high', 'medium', 'low']),
                programmeRelevance: z.enum(['high', 'medium', 'low']),
                differentiation: z.enum(['high', 'medium', 'low']),
                developmentPotential: z.enum(['high', 'medium', 'low']),
              })
              .strict(),
            strategicFit: z.enum(['high', 'medium', 'low']),
          })
          .strict(),
      )
      .max(3),
  })
  .strict();

const roadmapDeliverableSchema = z
  .object({
    key: z.string().regex(/^strategy-deliverable::[a-z_]+::[a-z0-9:_-]+::[a-z0-9:_-]+$/),
    label: z.string().min(1).max(300),
    kind: z.enum(['profile_build', 'evidence', 'requirement', 'narrative', 'application', 'other']),
    linkedPriorityKeys: z.array(z.string().regex(/^strategy-priority::/)).max(3),
    tool: z.enum(['personal_canvas', 'cv_builder', 'statement_writer']).nullable(),
    basisRefs: refs,
    estimatedDurationDays: z.number().int().min(0).max(3_650).nullable().optional(),
  })
  .strict();

export const strategyRoadmapPhaseSchema = z
  .object({
    phaseKey: z.enum(STRATEGY_PHASE_KEYS),
    name: z.string().min(1).max(200),
    goal: text,
    keyActions: z.array(text).max(12),
    deliverables: z.array(roadmapDeliverableSchema).max(20),
    successCriteria: z.array(text).max(12),
    estimatedTimeline: text,
    linkedPriorityKeys: z.array(z.string().regex(/^strategy-priority::/)).max(3),
  })
  .strict();
export type StrategyRoadmapPhase = z.infer<typeof strategyRoadmapPhaseSchema>;

const evidenceIndexItemSchema = z
  .object({
    id,
    label: z.string().min(1).max(300),
    statement: text,
    kind: z.enum(['applicant', 'hard_requirement']),
    status: z.enum(['verified', 'unverified', 'conflicting', 'report_only']),
    sourceRefs: refs,
    direct: z.boolean(),
  })
  .strict();
export type StrategyEvidenceIndexItem = z.infer<typeof evidenceIndexItemSchema>;

const targetSourceIndexItemSchema = z
  .object({
    ref: id,
    label: z.string().min(1).max(300),
    title: z.string().max(300).nullable(),
    url: z.string().max(2_000).nullable(),
    kind: z.enum(['university', 'programme', 'requirement', 'scholarship']),
  })
  .strict();
export type StrategyTargetSourceIndexItem = z.infer<typeof targetSourceIndexItemSchema>;

const metadataSchema = z
  .object({
    strategyEngineVersion: id,
    reportContractVersion: z.literal(STRATEGY_REPORT_V3_CONTRACT_VERSION),
    profileDiagnosisPromptVersion: id,
    activityAnalysisPromptVersion: id,
    synthesisPromptVersion: id,
    priorityFormulaVersion: id,
    personalReportVersionId: id,
    personalReportInputHash: id.nullable(),
    sourceAnalysisVersionId: id.nullable(),
    confirmedSnapshotId: id.nullable(),
    matchingReportId: id,
    matchingInputHash: id.nullable(),
    matchingContractVersion: id,
    matchingEngineVersion: id,
    targetProfileVersionId: id.nullable(),
    selectedScholarshipVersionId: id.nullable(),
    applicationDeadlineEvaluatedAt: z.string().min(1),
    model: id,
    aiCallCount: z.number().int().min(0),
  })
  .strict();

export const strategyReportV3Schema = z
  .object({
    contractVersion: z.literal(STRATEGY_REPORT_V3_CONTRACT_VERSION),
    generatedAt: z.string().min(1),
    strategicOverview: strategicOverviewSchema,
    profileDevelopmentStrategy: profileDevelopmentSchema,
    narrativeStrategy: narrativeStrategySchema,
    strategicRoadmap: z.array(strategyRoadmapPhaseSchema).min(4).max(4),
    evidenceIndex: z.array(evidenceIndexItemSchema).max(300),
    targetSourceIndex: z.array(targetSourceIndexItemSchema).max(150),
    metadata: metadataSchema,
  })
  .strict()
  .superRefine((report, ctx) => {
    const categories = report.profileDevelopmentStrategy.areas.map((area) => area.category);
    if (new Set(categories).size !== 4 || STRATEGY_PHASE_KEYS.length !== 4) {
      ctx.addIssue({ code: 'custom', path: ['profileDevelopmentStrategy', 'areas'], message: 'V3 requires one diagnosis for each profile category.' });
    }
    const phases = report.strategicRoadmap.map((phase) => phase.phaseKey);
    if (phases.some((key, index) => key !== STRATEGY_PHASE_KEYS[index])) {
      ctx.addIssue({ code: 'custom', path: ['strategicRoadmap'], message: 'V3 roadmap phases must use the canonical order.' });
    }
    const priorityKeys = report.strategicOverview.topPriorities.map((priority) => priority.key);
    if (new Set(priorityKeys).size !== priorityKeys.length || priorityKeys.length > 3) {
      ctx.addIssue({ code: 'custom', path: ['strategicOverview', 'topPriorities'], message: 'V3 priorities must be unique and capped at three.' });
    }
    report.strategicOverview.topPriorities.forEach((priority, index) => {
      if (priority.rank !== index + 1) {
        ctx.addIssue({ code: 'custom', path: ['strategicOverview', 'topPriorities', index, 'rank'], message: 'Priority ranks must be contiguous and deterministic.' });
      }
    });
    for (const key of report.strategicOverview.strategicOpportunity.priorityKeys) {
      if (!priorityKeys.includes(key)) ctx.addIssue({ code: 'custom', path: ['strategicOverview', 'strategicOpportunity', 'priorityKeys'], message: `Unknown priority key: ${key}` });
    }
    const evidence = new Set(report.evidenceIndex.map((item) => item.id));
    const targetSources = new Set(report.targetSourceIndex.map((item) => item.ref));
    const check = (values: string[], known: Set<string>, path: (string | number)[], label: string) => {
      for (const value of values) if (!known.has(value)) ctx.addIssue({ code: 'custom', path, message: `Unknown ${label} reference: ${value}` });
    };
    const checkActivity = (analysis: ActivityStrategyAnalysis, path: (string | number)[]) => {
      check(analysis.evidenceIds, evidence, path, 'evidence');
      check(analysis.targetSourceRefs, targetSources, path, 'target source');
      for (const dimension of Object.values(analysis.dimensions)) {
        check(dimension.evidenceIds, evidence, path, 'evidence');
        check(dimension.targetSourceRefs, targetSources, path, 'target source');
      }
    };
    report.profileDevelopmentStrategy.areas.forEach((area, index) => {
      check(area.evidenceIds, evidence, ['profileDevelopmentStrategy', 'areas', index], 'evidence');
      check(area.targetSourceRefs, targetSources, ['profileDevelopmentStrategy', 'areas', index], 'target source');
    });
    check(report.strategicOverview.currentPosition.profileStrength.evidenceIds, evidence, ['strategicOverview', 'currentPosition'], 'evidence');
    check(report.strategicOverview.currentPosition.differentiatedPotential?.evidenceIds ?? [], evidence, ['strategicOverview', 'currentPosition'], 'evidence');
    for (const priority of report.strategicOverview.topPriorities) {
      check(priority.evidenceIds, evidence, ['strategicOverview', 'topPriorities'], 'evidence');
      check(priority.targetSourceRefs, targetSources, ['strategicOverview', 'topPriorities'], 'target source');
    }
    const prioritySet = new Set(priorityKeys);
    for (const phase of report.strategicRoadmap) {
      check(phase.linkedPriorityKeys, prioritySet, ['strategicRoadmap'], 'priority');
      for (const deliverable of phase.deliverables) {
        check(deliverable.linkedPriorityKeys, prioritySet, ['strategicRoadmap'], 'priority');
      }
    }
    const activityIds = report.profileDevelopmentStrategy.activityAnalyses.map((analysis) => analysis.activityId);
    if (new Set(activityIds).size !== activityIds.length) {
      ctx.addIssue({ code: 'custom', path: ['profileDevelopmentStrategy', 'activityAnalyses'], message: 'Activity analyses must not contain duplicates.' });
    }
    report.profileDevelopmentStrategy.activityAnalyses.forEach((analysis, index) =>
      checkActivity(analysis, ['profileDevelopmentStrategy', 'activityAnalyses', index]),
    );
    check(report.narrativeStrategy.coreNarrativeDirection.evidenceIds, evidence, ['narrativeStrategy'], 'evidence');
    report.narrativeStrategy.supportingThemes.forEach((theme) => check(theme.evidenceIds, evidence, ['narrativeStrategy'], 'evidence'));
    for (const option of report.narrativeStrategy.narrativeOptions) {
      check(option.supportingExperienceIds, new Set(report.profileDevelopmentStrategy.activityAnalyses.map((item) => item.activityId)), ['narrativeStrategy'], 'activity');
      check(option.targetSourceRefs, targetSources, ['narrativeStrategy'], 'target source');
    }
    if (report.narrativeStrategy.narrativeTension) check(report.narrativeStrategy.narrativeTension.evidenceIds, evidence, ['narrativeStrategy'], 'evidence');
  });

export type StrategyReportV3 = z.infer<typeof strategyReportV3Schema>;

export function strategyReportV3FromRow(row: Record<string, unknown>): StrategyReportV3 | null {
  const parsed = strategyReportV3Schema.safeParse(row.report_v2);
  return parsed.success ? parsed.data : null;
}

function reportStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(reportStrings);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).flatMap(reportStrings);
  return [];
}

export function assertStrategyReportV3(
  value: unknown,
  refs: {
    activityIds: string[];
    evidenceIds: string[];
    targetSourceRefs: string[];
    metricIds?: string[];
    gapIds?: string[];
    requirementIds?: string[];
  },
): StrategyReportV3 {
  const parsed = strategyReportV3Schema.safeParse(value);
  if (!parsed.success) throw new Error(`Strategy V3 schema validation failed: ${parsed.error.message}`);
  const knownActivities = new Set(refs.activityIds);
  const knownEvidence = new Set(refs.evidenceIds);
  const knownTargets = new Set(refs.targetSourceRefs);
  const knownMetrics = refs.metricIds ? new Set(refs.metricIds) : null;
  const knownGaps = refs.gapIds ? new Set(refs.gapIds) : null;
  const knownRequirements = refs.requirementIds ? new Set(refs.requirementIds) : null;
  const canCheckBasisRefs = refs.metricIds !== undefined || refs.gapIds !== undefined || refs.requirementIds !== undefined;
  const checkKnown = (values: string[], known: Set<string> | null, label: string) => {
    if (!known) return;
    const unknown = values.find((value) => !known.has(value));
    if (unknown) throw new Error(`Unknown strategy ${label}: ${unknown}`);
  };
  const allBasisRefs = new Set([
    ...knownActivities,
    ...knownEvidence,
    ...knownTargets,
    ...(knownMetrics ?? []),
    ...(knownGaps ?? []),
    ...(knownRequirements ?? []),
  ]);
  for (const analysis of parsed.data.profileDevelopmentStrategy.activityAnalyses) {
    if (!knownActivities.has(analysis.activityId)) throw new Error(`Unknown strategy activity: ${analysis.activityId}`);
    checkKnown(analysis.evidenceIds, knownEvidence, 'evidence');
    checkKnown(analysis.targetSourceRefs, knownTargets, 'target source');
    for (const dimension of Object.values(analysis.dimensions)) {
      checkKnown(dimension.evidenceIds, knownEvidence, 'evidence');
      checkKnown(dimension.targetSourceRefs, knownTargets, 'target source');
    }
  }
  const overview = parsed.data.strategicOverview;
  checkKnown(overview.currentPosition.profileStrength.evidenceIds, knownEvidence, 'evidence');
  checkKnown(overview.currentPosition.profileStrength.metricIds, knownMetrics, 'metric');
  checkKnown(overview.currentPosition.keyChallenge.gapIds, knownGaps, 'gap');
  checkKnown(overview.currentPosition.keyChallenge.requirementIds, knownRequirements, 'requirement');
  checkKnown(overview.currentPosition.differentiatedPotential?.evidenceIds ?? [], knownEvidence, 'evidence');
  checkKnown(overview.currentPosition.differentiatedPotential?.metricIds ?? [], knownMetrics, 'metric');
  checkKnown(overview.strategicOpportunity.priorityKeys, new Set(overview.topPriorities.map((priority) => priority.key)), 'priority');
  for (const area of parsed.data.profileDevelopmentStrategy.areas) {
    checkKnown(area.evidenceIds, knownEvidence, 'evidence');
    checkKnown(area.targetSourceRefs, knownTargets, 'target source');
    checkKnown(area.metricIds, knownMetrics, 'metric');
    checkKnown(area.requirementIds, knownRequirements, 'requirement');
  }
  for (const priority of overview.topPriorities) {
    checkKnown(priority.evidenceIds, knownEvidence, 'evidence');
    checkKnown(priority.targetSourceRefs, knownTargets, 'target source');
    checkKnown(priority.gapIds, knownGaps, 'gap');
    checkKnown(priority.requirementIds, knownRequirements, 'requirement');
    if (canCheckBasisRefs) checkKnown(priority.basisRefs, allBasisRefs, 'basis');
  }
  const narrative = parsed.data.narrativeStrategy;
  checkKnown(narrative.coreNarrativeDirection.evidenceIds, knownEvidence, 'evidence');
  for (const theme of narrative.supportingThemes) checkKnown(theme.evidenceIds, knownEvidence, 'evidence');
  if (narrative.narrativeTension) checkKnown(narrative.narrativeTension.evidenceIds, knownEvidence, 'evidence');
  for (const option of narrative.narrativeOptions) {
    checkKnown(option.supportingExperienceIds, knownActivities, 'activity');
    checkKnown(option.targetSourceRefs, knownTargets, 'target source');
  }
  const priorityKeys = new Set(overview.topPriorities.map((priority) => priority.key));
  for (const phase of parsed.data.strategicRoadmap) {
    checkKnown(phase.linkedPriorityKeys, priorityKeys, 'priority');
    for (const deliverable of phase.deliverables) {
      checkKnown(deliverable.linkedPriorityKeys, priorityKeys, 'priority');
      if (canCheckBasisRefs) checkKnown(deliverable.basisRefs, allBasisRefs, 'basis');
    }
  }
  const forbidden = /(?:admission|acceptance)\s+(?:probability|chance|odds)|guaranteed\s+admission/i;
  if (reportStrings(parsed.data).some((value) => forbidden.test(value))) throw new Error('Strategy V3 contains prohibited admission-probability language.');
  return parsed.data;
}
