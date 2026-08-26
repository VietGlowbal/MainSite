import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  loadCandidateContext: vi.fn(),
  getLatestPersonalReportV2: vi.fn(),
  regeneratePersonalReport: vi.fn(),
  analyzeCourseMatchInsights: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supabaseMock }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/lib/ai/match-insights', () => ({ analyzeCourseMatchInsights: mocks.analyzeCourseMatchInsights }));
vi.mock('@/lib/ai/document-text', () => ({ extractDocumentText: vi.fn() }));

vi.mock('@/features/apply/api', () => ({
  getLatestPersonalReportV2: mocks.getLatestPersonalReportV2,
  loadCandidateContext: mocks.loadCandidateContext,
  regeneratePersonalReport: mocks.regeneratePersonalReport,
  stableHash: () => 'stable-hash',
}));

const APPLICATION_ROW = {
  id: 'app-1',
  user_id: 'user-1',
  university_id: 'uni-1',
  university_name: 'Test University',
  course_name: 'Test Course',
  courses: { university_id: 'uni-1' },
};

// A minimal per-table Supabase chain: every method returns `this` except the
// terminal ones (`single`/`maybeSingle`/`insert().select().single()`), which
// resolve. Configurable per test via the `tables` closure below.
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

let insertedAnalysisRow: Record<string, unknown> | null = null;

let supabaseMock: { auth: { getUser: typeof mocks.getUser }; from: (table: string) => unknown };

function setupSupabase(overrides: {
  application?: { data: unknown; error: unknown };
  matchAnalysesSelect?: { data: unknown; error: unknown };
  matchAnalysesInsert?: { data: unknown; error: unknown };
} = {}) {
  const application = overrides.application ?? { data: APPLICATION_ROW, error: null };
  const matchAnalysesSelect = overrides.matchAnalysesSelect ?? { data: null, error: null };
  const matchAnalysesInsert = overrides.matchAnalysesInsert ?? {
    data: { id: 'analysis-1' },
    error: null,
  };

  supabaseMock = {
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      if (table === 'course_applications') return tableChain(application);
      if (table === 'student_profiles') return tableChain({ data: { plus_status: false }, error: null });
      if (table === 'uploaded_documents') return tableChain({ data: [], error: null });
      if (table === 'universities') return tableChain({ data: null, error: null });
      if (table === 'application_match_analyses') {
        // The route does a SELECT (latest match) first, then an INSERT — both
        // go through this same chain object; distinguish by which method is
        // called next.
        const chain = tableChain(matchAnalysesSelect);
        chain.insert = (row: Record<string, unknown>) => {
          insertedAnalysisRow = row;
          return { select: () => ({ single: async () => matchAnalysesInsert }) };
        };
        return chain;
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

async function importRoute() {
  return import('./route');
}

function request() {
  return new Request('http://localhost/api/applications/app-1/match-insights', { method: 'POST' });
}

function context() {
  return { params: Promise.resolve({ id: 'app-1' }) };
}

const FIT_DIMENSION = {
  status: 'assessed' as const,
  score: 3,
  summary: 'Reasonably aligned.',
  strengths: [],
  gaps: [],
  evidence: [],
};

const PROGRAMME_FIT = {
  classification: 'match' as const,
  confidence: 50,
  limitations: [],
  eligibility: {
    requiredSubjects: 'met' as const,
    minimumQualification: 'met' as const,
    languageRequirement: 'met' as const,
    citizenshipRequirement: 'met' as const,
    deadline: 'met' as const,
  },
  dimensions: {
    academicCompetitiveness: FIT_DIMENSION,
    personaAlignment: FIT_DIMENSION,
    financialFeasibility: FIT_DIMENSION,
    careerDirection: FIT_DIMENSION,
    applicationReadiness: FIT_DIMENSION,
  },
};

const PERSONAL_REPORT_RECORD = {
  id: 'personal-v1',
  inputHash: 'personal-input-hash',
  reportV2: {
    coreIdentity: { interpretation: 'Strong fit' },
    drivingForce: { explanation: 'Purposeful direction' },
  },
};

describe('POST /api/applications/[id]/match-insights', () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  beforeEach(() => {
    vi.clearAllMocks();
    insertedAnalysisRow = null;
    process.env.OPENAI_API_KEY = 'test-key';
  });
  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
  });

  it('returns 401 before reading application data when the session is absent', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    setupSupabase();

    const { POST } = await importRoute();
    const response = await POST(request(), context());

    expect(response.status).toBe(401);
    expect(mocks.regeneratePersonalReport).not.toHaveBeenCalled();
  });

  it('returns 404 when the application is not owned by the current user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    setupSupabase({ application: { data: null, error: { code: 'PGRST116' } } });

    const { POST } = await importRoute();
    const response = await POST(request(), context());

    expect(response.status).toBe(404);
    expect(mocks.regeneratePersonalReport).not.toHaveBeenCalled();
  });

  it('requires a completed Personal Report before generating a Matching Report and persists its lineage', async () => {
    insertedAnalysisRow = null;
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.loadCandidateContext.mockResolvedValue({
      profile: { academic_background: 'Strong background' },
      achievements: [],
      activities: [],
      englishTests: [],
      standardizedTests: [],
      documents: [],
      evidence: [],
    });
    mocks.getLatestPersonalReportV2.mockResolvedValue({ record: null, migrationMissing: false });
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'cached', record: PERSONAL_REPORT_RECORD });
    mocks.analyzeCourseMatchInsights.mockResolvedValue({
      pillars: {},
      confidence: 'medium',
      inputsPresent: [],
      programmeFit: PROGRAMME_FIT,
    });
    setupSupabase();

    const { POST } = await importRoute();
    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    expect(mocks.regeneratePersonalReport.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.analyzeCourseMatchInsights.mock.invocationCallOrder[0],
    );
    expect(mocks.regeneratePersonalReport).toHaveBeenCalledWith(
      expect.objectContaining({ applicationId: 'app-1' }),
    );
    expect(insertedAnalysisRow).toMatchObject({
      source_personal_report_version_id: 'personal-v1',
      source_personal_report_input_hash: 'personal-input-hash',
      fit_dimensions: PROGRAMME_FIT.dimensions,
      fit_eligibility: PROGRAMME_FIT.eligibility,
      fit_classification: 'match',
    });
  });

  it('does not generate a Matching Report when Personal Report generation fails', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.loadCandidateContext.mockResolvedValue({
      profile: { academic_background: 'Strong background' },
      achievements: [],
      activities: [],
      englishTests: [],
      standardizedTests: [],
      documents: [],
      evidence: [],
    });
    mocks.getLatestPersonalReportV2.mockResolvedValue({ record: null, migrationMissing: false });
    mocks.regeneratePersonalReport.mockResolvedValue({
      status: 'error',
      message: 'model timeout',
      record: null,
    });
    mocks.analyzeCourseMatchInsights.mockResolvedValue({
      pillars: {},
      confidence: 'medium',
      inputsPresent: [],
      programmeFit: PROGRAMME_FIT,
    });
    setupSupabase();

    const { POST } = await importRoute();
    const response = await POST(request(), context());
    expect(response.status).toBe(502);
    expect(mocks.analyzeCourseMatchInsights).not.toHaveBeenCalled();
  });

  it('returns a complete cached analysis without calling the AI analyzer again', async () => {
    const cached = {
      id: 'analysis-cached',
      input_hash: 'stable-hash',
      report_v2: null,
      fit_dimensions: PROGRAMME_FIT.dimensions,
      fit_eligibility: PROGRAMME_FIT.eligibility,
      fit_classification: PROGRAMME_FIT.classification,
      fit_confidence: 50,
      fit_limitations: [],
      created_at: '2026-08-01T00:00:00.000Z',
    };
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.loadCandidateContext.mockResolvedValue({
      profile: { academic_background: 'Strong background' },
      achievements: [],
      activities: [],
      englishTests: [],
      standardizedTests: [],
      documents: [],
      evidence: [],
    });
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'cached', record: PERSONAL_REPORT_RECORD });
    setupSupabase({ matchAnalysesSelect: { data: cached, error: null } });

    const { POST } = await importRoute();
    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, cached: true, analysis: cached });
    expect(mocks.analyzeCourseMatchInsights).not.toHaveBeenCalled();
  });

  it('keeps the previous analysis when generation fails and does not insert a replacement', async () => {
    const previous = {
      id: 'analysis-previous',
      input_hash: 'previous-hash',
      created_at: '2026-07-31T00:00:00.000Z',
    };
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.loadCandidateContext.mockResolvedValue({
      profile: { academic_background: 'Strong background' },
      achievements: [],
      activities: [],
      englishTests: [],
      standardizedTests: [],
      documents: [],
      evidence: [],
    });
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'cached', record: PERSONAL_REPORT_RECORD });
    mocks.analyzeCourseMatchInsights.mockRejectedValue(new Error('model timeout'));
    setupSupabase({ matchAnalysesSelect: { data: previous, error: null } });

    const { POST } = await importRoute();
    const response = await POST(request(), context());
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.analysis).toEqual(previous);
    expect(insertedAnalysisRow).toBeNull();
  });

  it('uses nextRegenerationAt for the free cooldown response', async () => {
    const previous = {
      id: 'analysis-previous',
      input_hash: 'previous-hash',
      created_at: new Date(Date.now() - 60_000).toISOString(),
    };
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.loadCandidateContext.mockResolvedValue({
      profile: { academic_background: 'Strong background' },
      achievements: [],
      activities: [],
      englishTests: [],
      standardizedTests: [],
      documents: [],
      evidence: [],
    });
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'cached', record: PERSONAL_REPORT_RECORD });
    setupSupabase({ matchAnalysesSelect: { data: previous, error: null } });

    const { POST } = await importRoute();
    const response = await POST(request(), context());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.nextRegenerationAt).toEqual(expect.any(String));
    expect(body.nextAvailableAt).toBeUndefined();
    expect(mocks.analyzeCourseMatchInsights).not.toHaveBeenCalled();
  });
  it('persists the deterministic academic band and renormalized result, not the model label', async () => {
    insertedAnalysisRow = null;
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.loadCandidateContext.mockResolvedValue({
      profile: { academic_background: 'Strong background' },
      achievements: [],
      activities: [],
      englishTests: [],
      standardizedTests: [],
      documents: [],
      evidence: [],
    });
    mocks.getLatestPersonalReportV2.mockResolvedValue({ record: null, migrationMissing: false });
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'cached', record: PERSONAL_REPORT_RECORD });
    mocks.analyzeCourseMatchInsights.mockResolvedValue({
      pillars: {},
      confidence: 'medium',
      inputsPresent: [],
      programmeFit: {
        ...PROGRAMME_FIT,
        classification: 'safety',
        dimensions: {
          ...PROGRAMME_FIT.dimensions,
          financialFeasibility: {
            status: 'not_available',
            score: null,
            summary: 'No budget evidence.',
            strengths: [],
            gaps: ['Budget missing'],
            evidence: [],
            limitation: 'No budget evidence.',
          },
        },
      },
    });
    setupSupabase();

    const { POST } = await importRoute();
    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    const row = insertedAnalysisRow as Record<string, unknown> | null;
    expect(row?.fit_classification).toBe('match');
    expect(row?.fit_confidence).toBe(80);
    expect(row?.fit_limitations).toEqual(
      expect.arrayContaining([expect.stringContaining('financialFeasibility')]),
    );
  });

  it('lets a deterministic hard eligibility failure override every model label', async () => {
    insertedAnalysisRow = null;
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.loadCandidateContext.mockResolvedValue({
      profile: { academic_background: 'Strong background' },
      achievements: [],
      activities: [],
      englishTests: [],
      standardizedTests: [],
      documents: [],
      evidence: [],
    });
    mocks.getLatestPersonalReportV2.mockResolvedValue({ record: null, migrationMissing: false });
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'cached', record: PERSONAL_REPORT_RECORD });
    mocks.analyzeCourseMatchInsights.mockResolvedValue({
      pillars: {},
      confidence: 'medium',
      inputsPresent: [],
      programmeFit: {
        ...PROGRAMME_FIT,
        classification: 'safety',
        eligibility: { ...PROGRAMME_FIT.eligibility, languageRequirement: 'not_met' },
      },
    });
    setupSupabase();

    const { POST } = await importRoute();
    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    const row = insertedAnalysisRow as Record<string, unknown> | null;
    expect(row?.fit_classification).toBe('currently_ineligible');
  });
});
