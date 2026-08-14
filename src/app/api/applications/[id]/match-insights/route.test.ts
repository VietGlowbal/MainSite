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

let supabaseMock: { auth: { getUser: typeof mocks.getUser }; from: (table: string) => unknown };

function setupSupabase(overrides: {
  matchAnalysesSelect?: { data: unknown; error: unknown };
  matchAnalysesInsert?: { data: unknown; error: unknown };
} = {}) {
  const matchAnalysesSelect = overrides.matchAnalysesSelect ?? { data: null, error: null };
  const matchAnalysesInsert = overrides.matchAnalysesInsert ?? {
    data: { id: 'analysis-1' },
    error: null,
  };

  supabaseMock = {
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      if (table === 'course_applications') return tableChain({ data: APPLICATION_ROW, error: null });
      if (table === 'student_profiles') return tableChain({ data: { plus_status: false }, error: null });
      if (table === 'uploaded_documents') return tableChain({ data: [], error: null });
      if (table === 'universities') return tableChain({ data: null, error: null });
      if (table === 'application_match_analyses') {
        // The route does a SELECT (latest match) first, then an INSERT — both
        // go through this same chain object; distinguish by which method is
        // called next.
        const chain = tableChain(matchAnalysesSelect);
        chain.insert = () => ({
          select: () => ({ single: async () => matchAnalysesInsert }),
        });
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

describe('POST /api/applications/[id]/match-insights', () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
  });
  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
  });

  it('regenerates the Personal Report, tagged matching_report, after a successful Matching Report', async () => {
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
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'cached', record: null });
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
    expect(mocks.regeneratePersonalReport).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', trigger: 'matching_report' }),
    );
  });

  it('still returns the Matching Report even when the Personal Report refresh throws', async () => {
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
    mocks.regeneratePersonalReport.mockRejectedValue(new Error('model timeout'));
    mocks.analyzeCourseMatchInsights.mockResolvedValue({
      pillars: {},
      confidence: 'medium',
      inputsPresent: [],
      programmeFit: PROGRAMME_FIT,
    });
    setupSupabase();

    const { POST } = await importRoute();
    const response = await POST(request(), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
