import { describe, expect, it } from 'vitest';
import { composeMatchingReportV3 } from './report';
import { generateMatchingV3Summary, reasonAboutV3Metrics } from './reasoner';
import { matchingReportV3Schema } from './domain';
import { normalizeAcademicRubricScore, UNIVERSITY_FIT_METRICS, weightedScore } from './v3-scoring';

const targetProfile = {
  programme: { id: 'programme-1', name: 'Computer Science', university: 'Example University', level: 'undergraduate', subject: 'computing' },
  universityValues: [],
  programmeThemes: { description: null, themes: [] },
  requirements: [
    { id: 'req-1', category: 'academic' as const, label: 'English language', detail: 'IELTS 6.5', status: 'required' as const, sourceRefs: ['source-1'], missingInformation: null },
    { id: 'req-2', category: 'competency' as const, label: 'Analytical thinking', detail: 'Use evidence to solve problems', status: 'optional' as const, sourceRefs: ['source-1'], missingInformation: null },
  ],
  deadlines: [],
  missingInformation: [],
  sources: [{ ref: 'source-1', url: 'https://example.edu/programme', title: 'Programme page', retrievedAt: null }],
};

const context = {
  academicRecords: [], gradesSummary: null, curriculum: null,
  coreIdentity: { recurringRole: null, recurringBehaviours: [], valueOrientation: null, confidence: 'low', evidenceIds: [] },
  drivingForces: { repeatedMotivations: [], isHypothesis: false, missingPersonalGrounding: null, evidenceIds: [] },
  signaturePattern: { strength: 'insufficient', steps: [], distinctiveness: null, evidenceIds: [] },
  emergingThemes: [], provenCapabilities: [], socialProof: [],
  personalPositioning: { statement: null, status: 'insufficient_data', whyItFits: [], limitations: [], evidenceIds: [] },
  growthSignals: [], competitiveAdvantages: [], keyTakeaways: [],
  futureDirection: { intended: null, academic: null, career: null }, preferredEnvironment: null,
  evidence: [{ id: 'claim-1', statement: 'The applicant completed an analytical project.', category: 'competency', status: 'verified', sourceRefs: ['raw-1'], interpretationRefs: [], interpretations: [] }],
};

const evidenceBank = {
  version: 'eb-v1',
  sources: { 'raw-1': { id: 'raw-1', type: 'activity' as const, label: 'Project' } },
  interpretations: [],
  claims: [{ id: 'claim-1', category: 'competency' as const, statement: 'The applicant completed an analytical project.', status: 'verified' as const, sourceRefs: ['raw-1'], interpretationRefs: [], tags: { competencies: ['analysis'], criteria: [] } }],
  missingInformation: [],
};

const sparseTargetProfile = {
  ...targetProfile,
  requirements: [],
  sources: [],
};

const mixedSourceTargetProfile = {
  ...targetProfile,
  requirements: [
    ...targetProfile.requirements,
    { id: 'req-scholarship', category: 'scholarship' as const, label: 'Scholarship criterion', detail: 'Merit based', status: 'optional' as const, sourceRefs: ['scholarship-1'], missingInformation: null },
    { id: 'req-mixed', category: 'academic' as const, label: 'Mixed-source academic detail', detail: 'Source contains academic and scholarship sections', status: 'required' as const, sourceRefs: ['source-1', 'scholarship-1'], missingInformation: null },
  ],
  sources: [...targetProfile.sources, { ref: 'scholarship-1', url: 'https://example.edu/scholarship', title: 'Scholarship page', retrievedAt: null }],
};

const generate = async (args: { moduleId: string; userPrompt: string }) => {
  if (args.moduleId === 'matching_metric_reasoning') {
    const input = JSON.parse(args.userPrompt) as { metrics: Array<{ metricId: string; submetrics: Array<{ id: string }> }> };
    return {
      data: { results: input.metrics[0].submetrics.map((submetric) => ({ metricId: input.metrics[0].metricId, submetricId: submetric.id, status: 'assessed', score: 80, confidence: 0.8, reasoning: 'The supplied evidence and target source support this alignment.', applicantEvidenceIds: ['claim-1'], targetSourceRefs: ['source-1'], missingEvidence: [], limitations: [] })) },
      meta: { attemptCount: 1 },
    } as never;
  }
  return {
    data: {
      summary: 'The report finds grounded alignment across the assessed university and programme dimensions while keeping evidence limits visible.',
      keyTakeaways: {
        strongestAlignment: { title: 'Strongest alignment', body: 'Use the strongest supported alignment.', evidenceIds: ['claim-1'], targetSourceRefs: ['source-1'], metricIds: ['academicReadiness'] },
        criticalGap: { title: 'Critical gap', body: 'No critical gap was established.', evidenceIds: [], targetSourceRefs: ['source-1'], metricIds: ['academicReadiness'] },
        evidenceToAdd: { title: 'Evidence to add', body: 'Add more concrete evidence where coverage is limited.', evidenceIds: [], targetSourceRefs: ['source-1'], metricIds: ['academicReadiness'] },
        positioningNextStep: { title: 'Positioning next step', body: 'Use only the supplied evidence in positioning.', evidenceIds: ['claim-1'], targetSourceRefs: ['source-1'], metricIds: ['academicReadiness'] },
      },
    },
    meta: { attemptCount: 1 },
  } as never;
};

describe('matching report v3', () => {
  it('sends each metric as a small strict structured batch', async () => {
    const calls: Array<{ userPrompt: string; jsonSchemaFormat?: Record<string, unknown> }> = [];
    const result = await reasonAboutV3Metrics({
      definitions: UNIVERSITY_FIT_METRICS.slice(0, 2),
      context,
      targetProfile,
      previousReport: null,
      generate: (async (args: { userPrompt: string; jsonSchemaFormat?: Record<string, unknown> }) => {
        calls.push(args);
        const input = JSON.parse(args.userPrompt) as { metrics: Array<{ metricId: string; submetrics: Array<{ id: string }> }> };
        const metric = input.metrics[0];
        return {
          data: {
            results: metric.submetrics.map((submetric) => ({
              metricId: metric.metricId,
              submetricId: submetric.id,
              status: 'assessed',
              score: 40,
              confidence: 0.5,
              reasoning: 'The supplied evidence supports this limited assessment.',
              applicantEvidenceIds: ['claim-1'],
              targetSourceRefs: ['source-1'],
              missingEvidence: [],
              limitations: [],
            })),
          },
          meta: { attemptCount: 1 },
        };
      }) as never,
    });

    expect(result.metricBatches).toBe(2);
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.jsonSchemaFormat?.json_schema && (call.jsonSchemaFormat.json_schema as Record<string, unknown>).strict === true)).toBe(true);
    const schema = (calls[0].jsonSchemaFormat?.json_schema as Record<string, unknown>).schema as Record<string, unknown>;
    const resultSchema = ((schema.properties as Record<string, unknown>).results as Record<string, unknown>).items as Record<string, unknown>;
    expect(resultSchema.required).toEqual([
      'metricId', 'submetricId', 'status', 'score', 'confidence', 'reasoning',
      'applicantEvidenceIds', 'targetSourceRefs', 'missingEvidence', 'limitations',
    ]);
  });

  it('renormalizes weighted scores instead of treating missing evidence as zero', () => {
    expect(weightedScore([
      { submetricId: 'a', metricId: 'm', status: 'assessed', score: 80, confidence: 1, reasoning: 'x', applicantEvidenceIds: [], targetSourceRefs: [], missingEvidence: [], limitations: [] },
      { submetricId: 'b', metricId: 'm', status: 'not_available', score: null, confidence: 0, reasoning: 'x', applicantEvidenceIds: [], targetSourceRefs: [], missingEvidence: ['b'], limitations: [] },
    ], [{ id: 'a', weight: 50 }, { id: 'b', weight: 50 }]).score).toBe(80);
  });

  it('keeps Academic Readiness on the discrete rubric', () => {
    expect(normalizeAcademicRubricScore(81)).toBe(75);
    expect(normalizeAcademicRubricScore(93)).toBe(100);
    expect(normalizeAcademicRubricScore(null)).toBeNull();
  });

  it('generates a strict V3 report with deterministic lineage and separate fits', async () => {
    const report = await composeMatchingReportV3({
      targetProfile,
      academicProfile: { records: [] },
      evidenceBank,
      applicantContext: context,
      previousReport: null,
      lineage: {
        targetProfileVersionId: 'tp-1', targetProfileSchemaVersion: 'tp-v1', personalReportVersionId: 'pr-1', personalReportInputHash: 'pr-hash', sourceAnalysisVersionId: 'sa-1', confirmedSnapshotId: 'snapshot-1', evidenceBankVersion: 'eb-v1',
      },
      generate: generate as never,
      modelName: 'test-model',
    });
    expect(matchingReportV3Schema.safeParse(report).success).toBe(true);
    expect(report.universityFit.score).toBe(79);
    expect(report.programmeFit.score).toBe(80);
    expect(report.scholarshipAlignment).toBeNull();
    expect(report.metadata.aiCallCount.summary).toBe(1);
  });

  it('marks metrics unavailable when the target profile has no source-backed facts', async () => {
    let metricCalls = 0;
    let summaryCalls = 0;
    const report = await composeMatchingReportV3({
      targetProfile: sparseTargetProfile,
      academicProfile: { records: [] },
      evidenceBank,
      applicantContext: context,
      previousReport: null,
      lineage: {
        targetProfileVersionId: 'tp-sparse', targetProfileSchemaVersion: 'tp-v1', personalReportVersionId: 'pr-1', personalReportInputHash: 'pr-hash', sourceAnalysisVersionId: 'sa-1', confirmedSnapshotId: 'snapshot-1', evidenceBankVersion: 'eb-v1',
      },
      generate: (async (args: { moduleId: string }) => {
        if (args.moduleId === 'matching_metric_reasoning') {
          metricCalls += 1;
          throw new Error('metric generation should be skipped');
        }
        summaryCalls += 1;
        return {
          data: {
            summary: 'No source-backed target facts were available, so the report keeps fit metrics explicitly unassessed.',
            keyTakeaways: {
              strongestFit: { title: 'Strongest fit is not available', body: 'No target facts were available.', evidenceIds: [], targetSourceRefs: [], metricIds: [] },
              competitiveAdvantage: { title: 'Competitive advantage', body: 'No target facts were available.', evidenceIds: [], targetSourceRefs: [], metricIds: [] },
              criticalGap: { title: 'Critical gap is not available', body: 'No target facts were available.', evidenceIds: [], targetSourceRefs: [], metricIds: [] },
              strategicDirection: { title: 'Strategic direction', body: 'Add source-backed programme facts before interpreting fit.', evidenceIds: [], targetSourceRefs: [], metricIds: [] },
            },
          },
          meta: { attemptCount: 1 },
        };
      }) as never,
      modelName: 'test-model',
    });

    expect(metricCalls).toBe(0);
    expect(summaryCalls).toBe(1);
    expect(report.universityFit.metrics.academicReadiness.status).toBe('not_available');
    expect(report.universityFit.metrics.academicReadiness.score).toBeNull();
    expect(report.metadata.aiCallCount.metricBatches).toBe(0);
  });

  it('keeps scholarship refs out of metric facts and summary allowlists', async () => {
    const metricInputs: Array<{ metrics: Array<{ metricId: string; submetrics: Array<{ id: string }> }>; targetFacts: Array<{ sourceRefs: string[] }>; targetSourceRefs: string[] }> = [];
    let summaryInput: { allowedReferences: { targetSourceRefs: string[] } } | undefined;
    const longReasoning = 'The supplied evidence and target source support this alignment. '.repeat(40);
    const report = await composeMatchingReportV3({
      targetProfile: mixedSourceTargetProfile,
      academicProfile: { records: [] },
      evidenceBank,
      applicantContext: context,
      previousReport: null,
      lineage: {
        targetProfileVersionId: 'tp-mixed', targetProfileSchemaVersion: 'tp-v1', personalReportVersionId: 'pr-1', personalReportInputHash: 'pr-hash', sourceAnalysisVersionId: 'sa-1', confirmedSnapshotId: 'snapshot-1', evidenceBankVersion: 'eb-v1',
      },
      generate: (async (args: { moduleId: string; userPrompt: string }) => {
        if (args.moduleId === 'matching_metric_reasoning') {
          const input = JSON.parse(args.userPrompt) as typeof metricInputs[number];
          metricInputs.push(input);
          return {
            data: { results: input.metrics[0].submetrics.map((submetric) => ({ metricId: input.metrics[0].metricId, submetricId: submetric.id, status: 'assessed', score: 80, confidence: 0.8, reasoning: longReasoning, applicantEvidenceIds: ['claim-1'], targetSourceRefs: ['source-1'], missingEvidence: [], limitations: [] })) },
            meta: { attemptCount: 1 },
          };
        }
        summaryInput = JSON.parse(args.userPrompt) as NonNullable<typeof summaryInput>;
        return {
          data: {
            summary: 'The report finds grounded alignment across the assessed university and programme dimensions while keeping evidence limits visible.',
            keyTakeaways: {
              strongestFit: { title: 'Strongest fit', body: 'The strongest fit is supported by the supplied evidence.', evidenceIds: ['claim-1'], targetSourceRefs: ['source-1'], metricIds: ['academicReadiness'] },
              competitiveAdvantage: { title: 'Competitive advantage', body: 'The applicant shows a supported analytical strength.', evidenceIds: ['claim-1'], targetSourceRefs: ['source-1'], metricIds: ['academicReadiness'] },
              criticalGap: { title: 'Critical gap', body: 'Unable to establish a critical gap from the available evidence.', evidenceIds: [], targetSourceRefs: ['source-1'], metricIds: ['academicReadiness'] },
              strategicDirection: { title: 'Strategic direction', body: 'Build on the supported analytical strength with further evidence.', evidenceIds: ['claim-1'], targetSourceRefs: ['source-1'], metricIds: ['academicReadiness'] },
            },
          },
          meta: { attemptCount: 1 },
        };
      }) as never,
      modelName: 'test-model',
    });

    expect(metricInputs.length).toBeGreaterThan(0);
    expect(metricInputs.flatMap((input) => [...input.targetSourceRefs, ...input.targetFacts.flatMap((fact) => fact.sourceRefs)])).not.toContain('scholarship-1');
    expect(summaryInput?.allowedReferences.targetSourceRefs).toEqual(['source-1']);
    expect(report.programmeFit.potentialGap?.length).toBeLessThanOrEqual(1_000);
    expect(report.overall.summaryTargetSourceRefs).not.toContain('scholarship-1');
  });

  it('passes and validates the summary reference allowlists', async () => {
    let prompt = '';
    const received: {
      schema: { safeParse(input: unknown): { success: boolean } } | null;
      jsonSchemaFormat: Record<string, unknown> | null;
    } = { schema: null, jsonSchemaFormat: null };
    const data = {
      summary: 'The report keeps every conclusion grounded in the supplied applicant and programme evidence.',
      keyTakeaways: {
        strongestFit: { title: 'Strongest fit', body: 'The strongest fit is supported by the supplied evidence.', evidenceIds: ['claim-1'], targetSourceRefs: ['source-1'], metricIds: ['academicReadiness'] },
        competitiveAdvantage: { title: 'Competitive advantage', body: 'The applicant shows a supported analytical strength.', evidenceIds: ['claim-1'], targetSourceRefs: ['source-1'], metricIds: ['academicReadiness'] },
        criticalGap: { title: 'Critical gap', body: 'Unable to establish a critical gap from the available evidence.', evidenceIds: [], targetSourceRefs: ['source-1'], metricIds: ['academicReadiness'] },
        strategicDirection: { title: 'Strategic direction', body: 'Build on the supported analytical strength with further evidence.', evidenceIds: ['claim-1'], targetSourceRefs: ['source-1'], metricIds: ['academicReadiness'] },
      },
    };
    await generateMatchingV3Summary({
      candidate: { summaryInput: 'candidate' },
      evidenceIds: ['claim-1'],
      targetSourceRefs: ['source-1'],
      metricIds: ['academicReadiness'],
      generate: (async (args: { userPrompt: string; schema: typeof received.schema; jsonSchemaFormat?: Record<string, unknown> }) => {
        prompt = args.userPrompt;
        received.schema = args.schema;
        received.jsonSchemaFormat = args.jsonSchemaFormat ?? null;
        return { data, meta: { attemptCount: 1 } };
      }) as never,
    });

    expect(JSON.parse(prompt).allowedReferences).toEqual({
      evidenceIds: ['claim-1'],
      targetSourceRefs: ['source-1'],
      metricIds: ['academicReadiness'],
    });
    expect(received.schema?.safeParse({
      ...data,
      keyTakeaways: { ...data.keyTakeaways, strongestFit: { ...data.keyTakeaways.strongestFit, evidenceIds: ['invented-id'] } },
    })?.success).toBe(false);
    const format = received.jsonSchemaFormat?.json_schema as Record<string, unknown>;
    expect(received.jsonSchemaFormat?.type).toBe('json_schema');
    expect(format.strict).toBe(true);
    const summarySchema = format.schema as Record<string, unknown>;
    const keyTakeawaysSchema = (summarySchema.properties as Record<string, unknown>).keyTakeaways as Record<string, unknown>;
    const takeawaySchema = (keyTakeawaysSchema.properties as Record<string, unknown>).strongestFit as Record<string, unknown>;
    expect(takeawaySchema.required).toEqual(['title', 'body', 'evidenceIds', 'targetSourceRefs', 'metricIds']);
  });
});
