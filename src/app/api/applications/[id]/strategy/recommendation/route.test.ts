import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { matchingReportV3Schema } from '@/lib/ai/matching/domain';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getLatestApplicationPersonalReportV2: vi.fn(),
  getApplicationProfileAnalysisVersion: vi.fn(),
  buildApplicantStateFromSnapshot: vi.fn(),
  getTargetProfileVersion: vi.fn(),
  buildStrategyInputContext: vi.fn(),
  generateStrategyReportV3: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supabaseMock }));
vi.mock('@/features/apply/api', () => ({
  getLatestApplicationPersonalReportV2: mocks.getLatestApplicationPersonalReportV2,
  getApplicationProfileAnalysisVersion: mocks.getApplicationProfileAnalysisVersion,
  stableHash: () => 'test-input-hash',
}));
vi.mock('@/lib/ai/applicant-state/context-builder', () => ({
  buildApplicantStateFromSnapshot: mocks.buildApplicantStateFromSnapshot,
}));
vi.mock('@/lib/ai/target-profile/repository', () => ({ getTargetProfileVersion: mocks.getTargetProfileVersion }));
vi.mock('@/lib/ai/strategy-v3/context', () => ({
  buildStrategyInputContext: mocks.buildStrategyInputContext,
  withStrategyLineage: (context: Record<string, unknown>, lineage: Record<string, unknown>) => ({
    ...context,
    lineage: { ...(context.lineage as Record<string, unknown>), ...lineage },
  }),
}));
vi.mock('@/lib/ai/strategy-v3/engine', () => ({
  generateStrategyReportV3: mocks.generateStrategyReportV3,
  StrategyGenerationError: class StrategyGenerationError extends Error {},
}));

const APPLICATION_ROW = {
  id: 'app-1',
  user_id: 'user-1',
  course_id: 'course-1',
  university_id: 10,
  university_name: 'Test University',
  course_name: 'BSc Data Science',
  subject: 'Computer Science',
  degree_level: 'undergraduate',
  country: 'GB',
  intake: '2027',
  status: 'draft',
  deadline: '2027-01-31',
  courses: { id: 'course-1', subject: 'Computer Science', degree_level: 'undergraduate' },
};

const PERSONAL_RECORD = {
  id: 'pr-1',
  applicationId: 'app-1',
  confirmedSnapshotId: 'snap-1',
  sourceAnalysisVersionId: 'analysis-1',
  reportContractVersion: 'personal-report-v3',
  cacheKey: 'cache-1',
  inputHash: 'personal-hash',
  reportV2: { generatedAt: '2026-08-08T00:00:00Z', overallEvidenceConfidence: 'high', coreIdentity: {}, drivingForce: {}, signaturePattern: {}, emergingThemes: {}, personalPositioning: {}, proofOfMe: {} },
};

const SUBMETRICS: Record<string, string[]> = {
  academicReadiness: ['academicPerformance', 'requirementCoverage', 'programmePreparation', 'academicChallenge'],
  valuesAlignment: ['valueMatch', 'behaviouralEvidence', 'motivationMatch', 'consistency'],
  communityContribution: ['contributionEvidence', 'leadershipInitiative', 'collaboration', 'communityImpact'],
  learningEnvironment: ['learningStyleMatch', 'academicExperienceMatch', 'collaborationCommunityMatch', 'developmentOpportunityMatch'],
  distinctiveOpportunity: ['opportunityRelevance', 'capabilityOpportunityMatch', 'futureGoalRelevance', 'specificityUniqueness'],
  interestMotivation: ['interestEvidence', 'personalMotivation', 'problemFieldConnection', 'consistencyAcrossEvidence'],
  capability: ['coreCapabilityMatch', 'evidenceStrength', 'capabilityDepth', 'transferability'],
  experienceExposure: ['fieldRelevance', 'depthOfEngagement', 'applicationPractice', 'breadthOfExploration'],
  careerFutureDirection: ['goalProgrammeRelevance', 'skillGoalConnection', 'trajectoryConsistency', 'futureOpportunityRelevance'],
};

function metric(id: string) {
  return {
    id,
    score: 80,
    status: 'assessed' as const,
    confidence: 0.8,
    coverage: 100,
    summary: 'Aligned.',
    submetrics: (SUBMETRICS[id] ?? []).map((submetricId) => ({
      metricId: id,
      submetricId,
      status: 'assessed' as const,
      score: 80,
      confidence: 0.8,
      reasoning: 'Supported.',
      applicantEvidenceIds: [],
      targetSourceRefs: [],
      missingEvidence: [],
      limitations: [],
    })),
  };
}

function makeMatchingReport() {
  const universityMetrics = {
    academicReadiness: metric('academicReadiness'),
    valuesAlignment: metric('valuesAlignment'),
    communityContribution: metric('communityContribution'),
    learningEnvironment: metric('learningEnvironment'),
    distinctiveOpportunity: metric('distinctiveOpportunity'),
  };
  const programmeMetrics = {
    interestMotivation: metric('interestMotivation'),
    capability: metric('capability'),
    experienceExposure: metric('experienceExposure'),
    careerFutureDirection: metric('careerFutureDirection'),
  };
  return {
    contractVersion: 'matching-report-v3' as const,
    generatedAt: '2026-08-10T00:00:00Z',
    overall: { summary: 'Good alignment.', overallAlignmentScore: 80, evidenceCoverage: 80, confidence: 0.8, strongestAlignment: [], criticalGaps: [], summaryEvidenceIds: [], summaryTargetSourceRefs: [] },
    universityFit: { score: 80, status: 'assessed' as const, confidence: 0.8, coverage: 100, summary: 'Good.', metrics: universityMetrics },
    programmeFit: { score: 80, status: 'assessed' as const, confidence: 0.8, coverage: 100, summary: 'Good.', metrics: programmeMetrics, strongestAlignment: [], potentialGap: null, strategicInterpretation: null },
    hardRequirements: [],
    scholarshipAlignment: null,
    strengths: [],
    gaps: [],
    positioningOpportunities: [],
    keyTakeaways: {
      strongestFit: { title: 'Fit', body: 'Good.', evidenceIds: [], targetSourceRefs: [], metricIds: [] },
      competitiveAdvantage: { title: 'Advantage', body: 'Good.', evidenceIds: [], targetSourceRefs: [], metricIds: [] },
      criticalGap: { title: 'Gap', body: 'None.', evidenceIds: [], targetSourceRefs: [], metricIds: [] },
      strategicDirection: { title: 'Direction', body: 'Focus.', evidenceIds: [], targetSourceRefs: [], metricIds: [] },
    },
    evidenceIndex: [],
    targetSourceIndex: [],
    metadata: {
      matchingEngineVersion: 'matching-v3.1.0',
      promptVersion: 'matching-prompts-v3.1.1',
      metricPromptVersion: 'metric-v1',
      summaryPromptVersion: 'summary-v1',
      formulaVersion: 'formula-v1',
      model: 'gpt-4o',
      targetProfileVersionId: 'tp-1',
      targetProfileSchemaVersion: 'tp-v2',
      personalReportVersionId: 'pr-1',
      personalReportInputHash: 'personal-hash',
      sourceAnalysisVersionId: 'analysis-1',
      confirmedSnapshotId: 'snap-1',
      evidenceBankVersion: 'evidence-v1',
      selectedScholarshipKey: null,
      selectedScholarshipVersionId: null,
      reusedMetricIds: [],
      metricInputHashes: {},
      aiCallCount: { metricBatches: 1, providerCalls: 1, summary: 1 },
    },
  };
}

const MATCHING_REPORT = makeMatchingReport();
let matchingReportForTest = MATCHING_REPORT;
const GENERATED_REPORT = {
  contractVersion: 'strategy-report-v3',
  generatedAt: '2026-08-30T00:00:00Z',
  strategicOverview: {
    currentPosition: { summary: 'Current.', profileStrength: { statement: 'Strength.', evidenceIds: [], metricIds: [] }, keyChallenge: { statement: 'Challenge.', gapIds: [], requirementIds: [] }, unclearArea: null, differentiatedPotential: null },
    strategicOpportunity: { statement: 'Opportunity.', priorityKeys: [] },
    strategicGoal: { directionOfImprovement: 'Improve depth.', communicationGoal: 'Communicate outcomes.' },
    topPriorities: [],
    expectedOutcome: 'A focused application.',
  },
  profileDevelopmentStrategy: { areas: [
    ...['academic', 'experience', 'differentiation', 'evidence'].map((category) => ({ key: category, category, label: category, status: 'maintain', diagnosis: 'Stable.', whyItMatters: 'It matters.', suggestedDirection: 'Maintain it.', evidenceIds: [], metricIds: [], requirementIds: [], targetSourceRefs: [] })),
  ], activityAnalyses: [] },
  narrativeStrategy: {
    coreNarrativeDirection: { originTrigger: null, recurringMotivation: null, actions: [], capabilitiesDeveloped: [], emergingDirection: null, insight: 'No causal pattern established.', evidenceIds: ['evidence-1'] },
    supportingThemes: [], narrativeTension: null, narrativeOptions: [],
  },
  strategicRoadmap: ['strengthen_foundation', 'build_competitive_advantages', 'craft_application', 'finalise_optimise'].map((phaseKey) => ({ phaseKey, name: phaseKey, goal: 'Goal.', keyActions: [], deliverables: [], successCriteria: [], estimatedTimeline: 'As needed.', linkedPriorityKeys: [] })),
  evidenceIndex: [{ id: 'evidence-1', label: 'Snapshot evidence', statement: 'Verified.', kind: 'applicant', status: 'verified', sourceRefs: [], direct: true }],
  targetSourceIndex: [],
  metadata: {
    strategyEngineVersion: 'strategy-v3.0.0', reportContractVersion: 'strategy-report-v3', profileDiagnosisPromptVersion: 'strategy-profile-diagnosis-v3.0.0', activityAnalysisPromptVersion: 'strategy-activity-analysis-v3.0.0', synthesisPromptVersion: 'strategy-report-synthesis-v3.0.0', priorityFormulaVersion: 'impact-relevance-evidence-gap-feasibility-urgency-v1', personalReportVersionId: 'pr-1', personalReportInputHash: 'personal-hash', sourceAnalysisVersionId: 'analysis-1', confirmedSnapshotId: 'snap-1', matchingReportId: 'match-1', matchingInputHash: 'matching-hash', matchingContractVersion: 'matching-report-v3', matchingEngineVersion: 'matching-v3.1.0', targetProfileVersionId: 'tp-1', selectedScholarshipVersionId: null, applicationDeadlineEvaluatedAt: '2026-08-30T00:00:00Z', model: 'gpt-4o', aiCallCount: 2,
  },
};

function chain(result: { data: unknown; error: unknown }) {
  const self: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'limit', 'not', 'is']) self[method] = () => self;
  self.maybeSingle = async () => result;
  self.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  self.insert = () => ({ select: () => ({ single: async () => result }) });
  return self;
}

let supabaseMock: { auth: { getUser: typeof mocks.getUser }; from: (table: string) => unknown };
let strategyRows: unknown[] = [];

function setupSupabase() {
  supabaseMock = {
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      if (table === 'course_applications') return chain({ data: APPLICATION_ROW, error: null });
      if (table === 'application_match_analyses') return chain({ data: [{ id: 'match-1', application_id: 'app-1', user_id: 'user-1', analysis_status: 'complete', input_hash: 'matching-hash', report_v2: matchingReportForTest }], error: null });
      if (table === 'application_strategy_recommendations') {
        const c = chain({ data: strategyRows, error: null });
        c.insert = (payload: unknown) => ({ select: () => ({ single: async () => { strategyRows = [{ ...(payload as Record<string, unknown>), id: 'strategy-1', created_at: '2026-08-30T00:00:00Z' }, ...strategyRows]; return { data: strategyRows[0], error: null }; } }) });
        return c;
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

async function importRoute() { return import('./route'); }

describe('/api/applications/[id]/strategy/recommendation V3', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    matchingReportForTest = MATCHING_REPORT;
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.getLatestApplicationPersonalReportV2.mockResolvedValue({ record: PERSONAL_RECORD, migrationMissing: false });
    mocks.buildApplicantStateFromSnapshot.mockResolvedValue({ snapshotId: 'snap-1', achievements: [], activities: [], evidenceBank: [], directionSignals: {}, metadata: {} });
    mocks.getApplicationProfileAnalysisVersion.mockResolvedValue({ analysis: { id: 'analysis-1', inputHash: 'analysis-hash', moduleVersions: {}, structuredOutputs: {}, evidenceBank: null, confirmedSnapshotId: 'snap-1', createdAt: '2026-08-30' }, migrationMissing: false });
    mocks.getTargetProfileVersion.mockResolvedValue(null);
    mocks.buildStrategyInputContext.mockReturnValue({ lineage: {}, applicant: {}, activities: [], matching: matchingReportForTest, target: {}, application: {}, evidenceIndex: [], targetSourceIndex: [] });
    mocks.generateStrategyReportV3.mockResolvedValue(GENERATED_REPORT);
    strategyRows = [];
  });

  afterEach(() => vi.resetAllMocks());

  it('returns 401 without a session', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    setupSupabase();
    const { POST } = await importRoute();
    const response = await POST(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'app-1' }) });
    expect(response.status).toBe(401);
  });

  it('requires an exact current Matching V3 lineage', async () => {
    setupSupabase();
    matchingReportForTest = { ...MATCHING_REPORT, metadata: { ...MATCHING_REPORT.metadata, personalReportVersionId: 'old-pr' } };
    const { POST } = await importRoute();
    const response = await POST(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'app-1' }) });
    expect(response.status).toBe(422);
  });

  it('generates and persists only Strategy V3 without touching mutable activity tables', async () => {
    setupSupabase();
    const { POST } = await importRoute();
    const response = await POST(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'app-1' }) });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.reportV3.contractVersion).toBe('strategy-report-v3');
    expect(json.reportV2).toBeNull();
    expect(mocks.generateStrategyReportV3).toHaveBeenCalledTimes(1);
  });

  it('serves an exact V3 cache hit before requiring the API key', async () => {
    strategyRows = [{ id: 'cached-1', application_id: 'app-1', input_hash: 'test-input-hash', report_v2: GENERATED_REPORT, created_at: '2026-08-30T00:00:00Z' }];
    delete process.env.OPENAI_API_KEY;
    setupSupabase();
    const { POST } = await importRoute();
    const response = await POST(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'app-1' }) });
    expect(response.status).toBe(200);
    expect((await response.json()).cached).toBe(true);
    expect(mocks.generateStrategyReportV3).not.toHaveBeenCalled();
  });

  it('reads newest valid V3 while preserving V2/F7 fallback order', async () => {
    strategyRows = [{ id: 'bad', report_v2: { contractVersion: 'future' } }, { id: 'good', report_v2: GENERATED_REPORT }];
    setupSupabase();
    const { GET } = await importRoute();
    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'app-1' }) });
    expect(response.status).toBe(200);
    expect((await response.json()).reportV3.contractVersion).toBe('strategy-report-v3');
  });

  it('returns typed failure and does not persist when V3 generation fails', async () => {
    mocks.generateStrategyReportV3.mockRejectedValue(new Error('timeout'));
    setupSupabase();
    const { POST } = await importRoute();
    const response = await POST(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'app-1' }) });
    expect(response.status).toBe(502);
    expect((await response.json()).code).toBe('strategy_v3_invalid_output');
  });

  it('keeps the matching fixture valid for future schema changes', () => {
    expect(matchingReportV3Schema.safeParse(MATCHING_REPORT).success).toBe(true);
  });
});
