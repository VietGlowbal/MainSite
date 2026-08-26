import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersonalReportV2 } from '@/features/apply/domain';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getLatestApplicationPersonalReportV2: vi.fn(),
  generateStrategyRecommendation: vi.fn(),
  generateStrategyReportV2: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supabaseMock }));
vi.mock('@/lib/ai/strategy-recommendation', () => ({
  generateStrategyRecommendation: mocks.generateStrategyRecommendation,
  generateStrategyReportV2: mocks.generateStrategyReportV2,
  STRATEGY_RECOMMENDATION_PROMPT_VERSION: 'strategy-recommendation-f8-v2',
  STRATEGY_REPORT_V2_PROMPT_VERSION: 'strategy-report-f8-v3',
}));

vi.mock('@/features/apply/api', () => ({
  getLatestApplicationPersonalReportV2: mocks.getLatestApplicationPersonalReportV2,
  stableHash: (val: unknown) => `hash-${JSON.stringify(val).length}`,
}));

const APPLICATION_ROW = {
  id: 'app-1',
  user_id: 'user-1',
  university_id: 10,
  university_name: 'Test University',
  course_name: 'BSc Data Science',
  subject: 'Computer Science',
  degree_level: 'undergraduate',
  courses: { subject: 'Computer Science', degree_level: 'undergraduate' },
};

const PERSONAL_REPORT_V2: PersonalReportV2 = {
  generatedAt: '2026-08-08T00:00:00Z',
  overallEvidenceConfidence: 'high',
  coreIdentity: {
    available: true,
    headline: 'Problem solver',
    interpretation: 'Consistent problem solver across projects.',
    recurringRole: 'Lead',
    recurringBehaviours: ['Analytics'],
    valueOrientation: 'Impact',
    observations: ['Strong math'],
    evidenceRefs: [],
    confidence: 'high',
    stillDeveloping: [],
    insufficientData: null,
  },
  drivingForce: {
    available: true,
    headline: 'Driven by impact',
    explanation: 'Wants to solve education disparities.',
    repeatedMotivations: ['Education'],
    isHypothesis: false,
    missingPersonalGrounding: null,
    reflectionPrompt: null,
    evidenceRefs: [],
    confidence: 'high',
    insufficientData: null,
  },
  signaturePattern: {
    available: true,
    steps: [
      {
        key: 'trigger',
        label: 'Analyze',
        description: 'Finds patterns',
        examples: ['Activity 1'],
      },
    ],
    patternStrength: 'established',
    distinctiveness: 'Distinctive profile pattern',
    supportingExperienceCount: 2,
    confidence: 'high',
    evidenceRefs: [],
    insufficientData: null,
  },
  emergingThemes: {
    available: true,
    themes: [
      {
        theme: 'EdTech',
        status: 'established_theme',
        statusLabel: 'Established theme',
        explanation: 'Interest demonstrated across projects',
        supportingExperiences: ['Project A'],
        confidence: 'high',
        limitation: '',
        evidenceRefs: [],
      },
    ],
    insufficientData: null,
  },
  personalPositioning: {
    available: true,
    statement: 'A data innovator in education.',
    positioningStatus: 'strong_positioning',
    authentic: true,
    differentiated: true,
    coherent: true,
    directionAligned: true,
    credible: true,
    whyThisFits: ['Fits evidence.'],
    whatPreventsStrongerPositioning: [],
    confidence: 'high',
    evidenceRefs: [],
    insufficientData: null,
  },
  proofOfMe: {
    available: true,
    cards: [],
    insufficientData: null,
  },
};

const FIT_DIMENSION = {
  status: 'assessed' as const,
  score: 4,
  summary: 'Aligned.',
  strengths: ['Math'],
  gaps: [],
  evidence: ['GPA 3.8'],
};

const MATCH_ROW = {
  id: 'match-1',
  application_id: 'app-1',
  analysis_status: 'complete',
  fit_classification: 'strong_match',
  fit_confidence: 80,
  fit_limitations: [],
  fit_eligibility: {
    requiredSubjects: 'met',
    minimumQualification: 'met',
    languageRequirement: 'met',
    citizenshipRequirement: 'unknown',
    deadline: 'met',
  },
  fit_dimensions: {
    academicCompetitiveness: FIT_DIMENSION,
    personaAlignment: FIT_DIMENSION,
    financialFeasibility: FIT_DIMENSION,
    careerDirection: FIT_DIMENSION,
    applicationReadiness: FIT_DIMENSION,
  },
  prompt_version: 'match-insights-v2-vi',
  input_hash: 'match-hash',
};

const GENERATED_STRATEGY = {
  directionOptions: [
    {
      name: 'EdTech Data Science',
      identityFit: 9,
      evidenceStrength: 8.5,
      consistency: 9,
      differentiation: 8.8,
      futureAlignment: 9.5,
      scalability: 9,
      overall: 9.2,
    },
    {
      name: 'Public Sector Analytics',
      identityFit: 8,
      evidenceStrength: 8,
      consistency: 8,
      differentiation: 7.5,
      futureAlignment: 8.5,
      scalability: 8,
      overall: 8.1,
    },
  ],
  chosenDirection: 'EdTech Data Science',
  chosenDirectionWhy: 'Strongest alignment with evidence and intended direction.',
  narrative: 'A compelling story linking data projects to education.',
  positioningBefore: 'General applicant.',
  positioningAfter: 'Specialized EdTech data scientist.',
  positioningRationale: 'Clear focus makes the profile stand out.',
  portfolioEvaluations: [
    {
      name: 'Project A',
      source: 'existing_activity' as const,
      strategicContribution: 'Proves technical data skills.',
      recommendation: 'highly_recommended' as const,
    },
    {
      name: 'Open Source Dashboard',
      source: 'ai_proposed' as const,
      strategicContribution: 'Demonstrates initiative.',
      recommendation: 'recommended' as const,
    },
  ],
  differentiationInsight: 'Many applicants have generic coding exercises.',
  differentiationProposal: 'Publish an open educational tool.',
  roadmap: {
    chosenStrategy: 'Focus on EdTech data science.',
    why: 'Direct alignment with course and past experiences.',
    prioritize: ['Launch dashboard', 'Deepen Project A analysis'],
    avoid: ['Generic hackathons'],
    expectedPositioning: 'Applied data scientist for educational impact.',
    longTermNarrative: 'From data insights to systemic educational improvements.',
  },
};

const GENERATED_STRATEGY_V2 = {
  strategicOverview: {
    currentPosition: {
      profile: 'Data-leaning student with education-impact experience.',
      keyStrength: 'Analytics portfolio',
      biggestChallenge: 'No standardised English test yet',
    },
    strategicGoal: {
      primaryObjective: 'Read as an EdTech-focused data scientist',
      positioning: 'Evidence-backed builder for education access',
    },
    topPriorities: ['Ship the education dashboard', 'Book IELTS', 'Deepen Project A'],
    expectedOutcome: 'A focused, evidence-rich application.',
  },
  priorityTable: [
    {
      key: 'quant_portfolio_depth',
      title: 'Deepen the quantitative portfolio',
      currentSituation: 'One strong project exists.',
      whyItMatters: 'The course is quantitative first.',
      recommendedActions: ['Add a forecasting notebook', 'Write up results'],
      expectedImpact: 'Directly supports academic competitiveness.',
      level: 'critical',
    },
    {
      key: 'ielts_7_target',
      title: 'Secure the English requirement',
      currentSituation: 'No test on file.',
      whyItMatters: 'Hard eligibility gate.',
      recommendedActions: ['Book a date', 'Weekly practice tests'],
      expectedImpact: 'Unlocks eligibility.',
      level: 'high',
    },
  ],
  profileDevelopmentStrategy: {
    academic: { currentStatus: 'Strong maths.', gap: 'Formal CS coursework.', strategicFocus: 'Coursework mooc.', expectedOutcome: 'Transcript signal.' },
    experience: { currentStatus: 'NGO project.', gap: 'Scale.', strategicFocus: 'Grow users.', expectedOutcome: 'Impact story.' },
    differentiation: { currentAdvantage: 'Education focus.', uniqueness: 'Rare pairing.', amplifyHow: 'Publish writeups.', desiredPerception: 'Mission-driven analyst' },
  },
  narrativeStrategy: {
    coreNarrative: { centralStory: 'From classroom volunteer to data builder.', supportingEvidence: ['Project A'], admissionsValue: 'Mission fit plus skill.' },
    themes: [{ key: 'education_access', title: 'Education access', rationale: 'Recurring thread.', evidence: ['NGO project'] }],
    consistencyCheck: { supports: 'Projects align.', feelsDisconnected: 'Hackathon detour.', emphasise: 'Outcomes.', supportingRole: 'Competitions.' },
  },
  executionRoadmap: {
    phases: [
      {
        phaseKey: 'strengthen_foundation',
        name: 'Strengthen Foundation',
        objective: 'Close hard gates.',
        keyActions: ['Book IELTS'],
        deliverables: [{ key: 'ielts_booking_confirmation', label: 'IELTS booking' }],
        successCriteria: ['Test booked'],
        timeline: 'Month 1',
      },
    ],
  },
};

function tableChain(resolved: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.eq = self;
  chain.order = self;
  chain.limit = self;
  chain.single = async () => resolved;
  chain.maybeSingle = async () => resolved;
  chain.insert = () => ({
    select: () => ({ single: async () => resolved }),
  });
  return chain;
}

let supabaseMock: { auth: { getUser: typeof mocks.getUser }; from: (table: string) => unknown };

const DEFAULT_INSERT_RESULT = {
  data: {
    id: 'strat-row-1',
    application_id: 'app-1',
    input_hash: 'hash-x',
    source_personal_report_version_id: 'pr-1',
    source_match_analysis_id: 'match-1',
    created_at: '2026-08-10T00:00:00Z',
    direction_options: null,
    chosen_direction: null,
    chosen_direction_why: null,
    narrative: null,
    positioning_before: null,
    positioning_after: null,
    positioning_rationale: null,
    portfolio_evaluations: null,
    differentiation_insight: null,
    differentiation_proposal: null,
    roadmap: null,
    report_v2: GENERATED_STRATEGY_V2,
  },
  error: null,
};

function setupSupabase(overrides: {
  application?: { data: unknown; error: unknown };
  latestStrategy?: { data: unknown; error: unknown };
  /** Sequential results, one per insert call — models the degraded-mode retry. */
  insertStrategy?: Array<{ data: unknown; error: unknown }>;
  matchAnalyses?: { data: unknown; error: unknown };
} = {}): {
  insertedStrategyPayloads: Array<Record<string, unknown>>;
  matchAnalysisFilters: Array<[string, unknown]>;
} {
  const appRes = overrides.application ?? { data: APPLICATION_ROW, error: null };
  const stratRes = overrides.latestStrategy ?? { data: null, error: null };
  const insertResults = overrides.insertStrategy ?? [DEFAULT_INSERT_RESULT];
  const insertedStrategyPayloads: Array<Record<string, unknown>> = [];
  const matchRes = overrides.matchAnalyses ?? { data: MATCH_ROW, error: null };
  const matchAnalysisFilters: Array<[string, unknown]> = [];

  supabaseMock = {
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      if (table === 'course_applications') return tableChain(appRes);
      if (table === 'application_match_analyses') {
        const chain = tableChain(matchRes);
        chain.eq = (column: string, value: unknown) => {
          matchAnalysisFilters.push([column, value]);
          return chain;
        };
        return chain;
      }
      if (table === 'student_achievements') return tableChain({ data: [], error: null });
      if (table === 'student_activities') return tableChain({ data: [], error: null });
      if (table === 'universities') return tableChain({ data: { employability: 'Top 10%' }, error: null });
      if (table === 'application_strategy_recommendations') {
        const chain = tableChain(stratRes);
        chain.insert = (payloadArg: Record<string, unknown>) => {
          // Shallow copy: the route mutates its payload object across
          // degradation retries, and we need per-call snapshots.
          insertedStrategyPayloads.push({ ...payloadArg });
          const result = insertResults.length > 0 ? (insertResults.shift() as { data: unknown; error: unknown }) : DEFAULT_INSERT_RESULT;
          return { select: () => ({ single: async () => result }) };
        };
        return chain;
      }
      throw new Error(`Unexpected table in test: ${table}`);
    },
  };
  return { insertedStrategyPayloads, matchAnalysisFilters };
}

async function importRoute() {
  return import('./route');
}

describe('/api/applications/[id]/strategy/recommendation', () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.getLatestApplicationPersonalReportV2.mockResolvedValue({
      record: { id: 'pr-1', applicationId: 'app-1', confirmedSnapshotId: 'snap-1', sourceAnalysisVersionId: 'analysis-1', reportContractVersion: 'personal-report-v3', cacheKey: 'cache-1', reportV2: PERSONAL_REPORT_V2, promptVersion: 'personal-v2' },
      migrationMissing: false,
    });
    mocks.generateStrategyRecommendation.mockResolvedValue(GENERATED_STRATEGY);
    mocks.generateStrategyReportV2.mockResolvedValue(GENERATED_STRATEGY_V2);
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
    vi.resetAllMocks();
  });

  describe('GET', () => {
    it('returns 401 when unauthorized', async () => {
      mocks.getUser.mockResolvedValue({ data: { user: null } });
      setupSupabase();
      const { GET } = await importRoute();
      const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'app-1' }) });
      expect(res.status).toBe(401);
    });

    it('returns 404 when application does not exist', async () => {
      setupSupabase({ application: { data: null, error: null } });
      const { GET } = await importRoute();
      const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'app-1' }) });
      expect(res.status).toBe(404);
    });

    it('returns latest strategy recommendation when available', async () => {
      setupSupabase({
        latestStrategy: {
          data: {
            id: 'strat-row-1',
            application_id: 'app-1',
            source_analysis_id: 'pr-1',
            source_match_analysis_id: 'match-1',
            created_at: '2026-08-10T00:00:00Z',
            direction_options: GENERATED_STRATEGY.directionOptions,
            chosen_direction: GENERATED_STRATEGY.chosenDirection,
            chosen_direction_why: GENERATED_STRATEGY.chosenDirectionWhy,
            narrative: GENERATED_STRATEGY.narrative,
            positioning_before: GENERATED_STRATEGY.positioningBefore,
            positioning_after: GENERATED_STRATEGY.positioningAfter,
            positioning_rationale: GENERATED_STRATEGY.positioningRationale,
            portfolio_evaluations: GENERATED_STRATEGY.portfolioEvaluations,
            differentiation_insight: GENERATED_STRATEGY.differentiationInsight,
            differentiation_proposal: GENERATED_STRATEGY.differentiationProposal,
            roadmap: GENERATED_STRATEGY.roadmap,
          },
          error: null,
        },
      });
      const { GET } = await importRoute();
      const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'app-1' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.recommendation?.chosenDirection).toBe('EdTech Data Science');
    });
  });

  describe('POST', () => {
    it('returns 401 when unauthorized', async () => {
      mocks.getUser.mockResolvedValue({ data: { user: null } });
      setupSupabase();
      const { POST } = await importRoute();
      const res = await POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: 'app-1' }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 422 with needsInputs when personal report is missing', async () => {
      mocks.getLatestApplicationPersonalReportV2.mockResolvedValue({ record: null, migrationMissing: false });
      setupSupabase();
      const { POST } = await importRoute();
      const res = await POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: 'app-1' }),
      });
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.needsInputs).toBe(true);
    });

    it('returns 422 with needsInputs when match analysis is missing', async () => {
      setupSupabase({ matchAnalyses: { data: null, error: null } });
      const { POST } = await importRoute();
      const res = await POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: 'app-1' }),
      });
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.needsInputs).toBe(true);
    });

    it('only consumes Matching Reports from the current prompt and F5 engine', async () => {
      const { matchAnalysisFilters } = setupSupabase();
      const { POST } = await importRoute();
      const res = await POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: 'app-1' }),
      });

      expect(res.status).toBe(200);
      expect(matchAnalysisFilters).toEqual(expect.arrayContaining([
        ['prompt_version', 'match-insights-v2-vi'],
        ['f5_engine_version', 'f5-programme-fit-v1'],
      ]));
    });

    it('returns cached recommendation when identical input version exists', async () => {
      setupSupabase({
        latestStrategy: {
          data: {
            id: 'strat-row-cached',
            application_id: 'app-1',
            source_personal_report_version_id: 'pr-1',
            source_match_analysis_id: 'match-1',
            prompt_version: 'strategy-recommendation-f8-v2',
            created_at: '2026-08-10T00:00:00Z',
            direction_options: GENERATED_STRATEGY.directionOptions,
            chosen_direction: GENERATED_STRATEGY.chosenDirection,
            chosen_direction_why: GENERATED_STRATEGY.chosenDirectionWhy,
            narrative: GENERATED_STRATEGY.narrative,
            positioning_before: GENERATED_STRATEGY.positioningBefore,
            positioning_after: GENERATED_STRATEGY.positioningAfter,
            positioning_rationale: GENERATED_STRATEGY.positioningRationale,
            portfolio_evaluations: GENERATED_STRATEGY.portfolioEvaluations,
            differentiation_insight: GENERATED_STRATEGY.differentiationInsight,
            differentiation_proposal: GENERATED_STRATEGY.differentiationProposal,
            roadmap: GENERATED_STRATEGY.roadmap,
          },
          error: null,
        },
      });

      const { POST } = await importRoute();
      const res = await POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: 'app-1' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.cached).toBe(true);
      expect(json.recommendation?.id).toBe('strat-row-cached');
      expect(mocks.generateStrategyRecommendation).not.toHaveBeenCalled();
    });

    // Regression: a legacy row written before lineage existed (null/absent
    // source_personal_report_version_id) must never be served as a cache hit
    // just because its match analysis + prompt version still match — the
    // student may have regenerated their Personal Report since.
    it('regenerates instead of stale-hitting a row whose personal-report lineage is absent', async () => {
      setupSupabase({
        latestStrategy: {
          data: {
            id: 'strat-row-legacy',
            application_id: 'app-1',
            source_match_analysis_id: 'match-1',
            prompt_version: 'strategy-recommendation-f8-v2',
            created_at: '2026-08-10T00:00:00Z',
            direction_options: GENERATED_STRATEGY.directionOptions,
            chosen_direction: GENERATED_STRATEGY.chosenDirection,
            chosen_direction_why: GENERATED_STRATEGY.chosenDirectionWhy,
            narrative: GENERATED_STRATEGY.narrative,
            positioning_before: GENERATED_STRATEGY.positioningBefore,
            positioning_after: GENERATED_STRATEGY.positioningAfter,
            positioning_rationale: GENERATED_STRATEGY.positioningRationale,
            portfolio_evaluations: GENERATED_STRATEGY.portfolioEvaluations,
            differentiation_insight: GENERATED_STRATEGY.differentiationInsight,
            differentiation_proposal: GENERATED_STRATEGY.differentiationProposal,
            roadmap: GENERATED_STRATEGY.roadmap,
          },
          error: null,
        },
      });

      const { POST } = await importRoute();
      const res = await POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: 'app-1' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.cached).toBeUndefined();
      expect(mocks.generateStrategyReportV2).toHaveBeenCalledTimes(1);
    });

    it('persists input hash, canonical source lineage, and the five-section report_v2 payload', async () => {
      const { insertedStrategyPayloads } = setupSupabase();
      const { POST } = await importRoute();
      const res = await POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: 'app-1' }),
      });
      expect(res.status).toBe(200);
      expect(mocks.generateStrategyReportV2).toHaveBeenCalledTimes(1);
      expect(insertedStrategyPayloads).toHaveLength(1);
      expect(insertedStrategyPayloads[0].input_hash).toEqual(expect.any(String));
      expect(insertedStrategyPayloads[0].input_hash).not.toBe('');
      expect(insertedStrategyPayloads[0].source_personal_report_version_id).toBe('pr-1');
      expect(insertedStrategyPayloads[0].source_match_analysis_id).toBe('match-1');
      expect(mocks.getLatestApplicationPersonalReportV2).toHaveBeenCalledWith(
        expect.anything(),
        { userId: 'user-1', applicationId: 'app-1' },
      );
      expect(insertedStrategyPayloads[0].prompt_version).toBe('strategy-report-f8-v3');
      expect(insertedStrategyPayloads[0].report_v2).toEqual(GENERATED_STRATEGY_V2);
      // The legacy column must not receive a personal-report-version id — its
      // FK still references applicant_analyses.
      expect(insertedStrategyPayloads[0].source_analysis_id).toBeUndefined();
    });

    it('falls back to the legacy prompt and shape when the report_v2 column has not been migrated', async () => {
      const { insertedStrategyPayloads } = setupSupabase({
        insertStrategy: [
          {
            data: null,
            error: { code: 'PGRST204', message: "Could not find the 'report_v2' column of 'application_strategy_recommendations' in the schema cache" },
          },
          DEFAULT_INSERT_RESULT,
        ],
      });
      const { POST } = await importRoute();
      const res = await POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: 'app-1' }),
      });
      expect(res.status).toBe(200);
      expect(mocks.generateStrategyReportV2).toHaveBeenCalledTimes(1);
      expect(mocks.generateStrategyRecommendation).toHaveBeenCalledTimes(1);
      expect(insertedStrategyPayloads).toHaveLength(2);
      expect(insertedStrategyPayloads[0].report_v2).toBeDefined();
      expect(insertedStrategyPayloads[1].report_v2).toBeUndefined();
      expect(insertedStrategyPayloads[1].chosen_direction).toBe(GENERATED_STRATEGY.chosenDirection);
      const json = await res.json();
      // DEFAULT_INSERT_RESULT still carries a v2 payload — dual-shape response.
      expect(json.reportV2?.priorityTable[0]?.key).toBe('quant_portfolio_depth');
    });

    it('degrades gracefully to the pre-lineage insert shape when the migration has not run', async () => {
      const { insertedStrategyPayloads } = setupSupabase({
        insertStrategy: [
          {
            data: null,
            error: { code: 'PGRST204', message: "Could not find the 'input_hash' column of 'application_strategy_recommendations' in the schema cache" },
          },
          DEFAULT_INSERT_RESULT,
        ],
      });
      const { POST } = await importRoute();
      const res = await POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: 'app-1' }),
      });
      expect(res.status).toBe(200);
      expect(insertedStrategyPayloads).toHaveLength(2);
      expect(insertedStrategyPayloads[0].input_hash).toBeDefined();
      expect(insertedStrategyPayloads[1].input_hash).toBeUndefined();
      expect(insertedStrategyPayloads[1].source_personal_report_version_id).toBeUndefined();
    });

    it('performs fresh generation when inputs change and returns structured recommendation', async () => {
      setupSupabase();
      const { POST } = await importRoute();
      const res = await POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: 'app-1' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.reportV2?.strategicOverview.strategicGoal.primaryObjective).toBe(
        'Read as an EdTech-focused data scientist',
      );
      expect(mocks.generateStrategyReportV2).toHaveBeenCalledTimes(1);
    });

    it('returns 502 when both generation paths throw', async () => {
      mocks.generateStrategyReportV2.mockRejectedValue(new Error('AI generation timeout'));
      mocks.generateStrategyRecommendation.mockRejectedValue(new Error('AI generation timeout'));
      setupSupabase();
      const { POST } = await importRoute();
      const res = await POST(new Request('http://localhost', { method: 'POST' }), {
        params: Promise.resolve({ id: 'app-1' }),
      });
      expect(res.status).toBe(502);
    });
  });
});
