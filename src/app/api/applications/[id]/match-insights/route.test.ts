import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  generateApplicationMatchingReport: vi.fn(),
  getLatestApplicationMatchingAnalysis: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supabaseMock }));
vi.mock('@/lib/ai/matching/generation', () => ({
  generateApplicationMatchingReport: mocks.generateApplicationMatchingReport,
}));
vi.mock('@/features/apply/api/ai-reports-repository', () => ({
  getLatestApplicationMatchingAnalysis: mocks.getLatestApplicationMatchingAnalysis,
}));

const APPLICATION_ROW = {
  id: 'app-1',
  user_id: 'user-1',
  university_id: 'uni-1',
  university_name: 'Test University',
  course_name: 'Test Course',
  courses: { university_id: 'uni-1' },
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
  return chain;
}

let supabaseMock: { auth: { getUser: typeof mocks.getUser }; from: (table: string) => unknown };

function setupSupabase(overrides: {
  application?: { data: unknown; error: unknown };
  profile?: { data: unknown; error: unknown };
} = {}) {
  const application = overrides.application ?? { data: APPLICATION_ROW, error: null };
  const profile = overrides.profile ?? { data: { plus_status: false }, error: null };

  supabaseMock = {
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      if (table === 'course_applications') return tableChain(application);
      if (table === 'student_profiles') return tableChain(profile);
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

describe('POST /api/applications/[id]/match-insights', () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.getLatestApplicationMatchingAnalysis.mockResolvedValue({ record: null, migrationMissing: false });
    mocks.generateApplicationMatchingReport.mockResolvedValue({
      status: 'regenerated',
      record: { id: 'analysis-1', reportV2: { overall: { fitScore: 85 } } },
      reusedCriterionIds: ['crit-1'],
    });
    setupSupabase();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when unauthorized', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    setupSupabase();

    const { POST } = await importRoute();
    const response = await POST(request(), context());
    expect(response.status).toBe(401);
  });

  it('returns 404 when the application is not owned by the current user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    setupSupabase({ application: { data: null, error: { code: 'PGRST116' } } });

    const { POST } = await importRoute();
    const response = await POST(request(), context());
    expect(response.status).toBe(404);
  });

  it('returns 429 cooldown when user is not plus and generated recently', async () => {
    const recent = {
      id: 'analysis-prev',
      createdAt: new Date(Date.now() - 60_000).toISOString(),
    };
    mocks.getLatestApplicationMatchingAnalysis.mockResolvedValue({ record: recent, migrationMissing: false });
    mocks.generateApplicationMatchingReport.mockResolvedValue({
      status: 'cooldown',
      record: recent,
      nextRegenerationAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    setupSupabase();

    const { POST } = await importRoute();
    const response = await POST(request(), context());
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.nextRegenerationAt).toBeDefined();
  });

  it('does not block an exact cache hit during the free-tier cooldown', async () => {
    const recent = { id: 'analysis-prev', createdAt: new Date(Date.now() - 60_000).toISOString() };
    mocks.getLatestApplicationMatchingAnalysis.mockResolvedValue({ record: recent, migrationMissing: false });
    mocks.generateApplicationMatchingReport.mockResolvedValue({ status: 'cached', record: recent });
    setupSupabase();

    const { POST } = await importRoute();
    const response = await POST(request(), context());
    expect(response.status).toBe(200);
    expect((await response.json()).cached).toBe(true);
  });

  it('returns 503 when AI service is not configured', async () => {
    mocks.generateApplicationMatchingReport.mockResolvedValue({ status: 'not_configured' });
    setupSupabase();

    const { POST } = await importRoute();
    const response = await POST(request(), context());
    expect(response.status).toBe(503);
  });

  it('returns 422 with needsInputs when personal report or inputs are not ready', async () => {
    mocks.generateApplicationMatchingReport.mockResolvedValue({
      status: 'not_ready',
      reason: 'Personal Report must complete first',
    });
    setupSupabase();

    const { POST } = await importRoute();
    const response = await POST(request(), context());
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.needsInputs).toBe(true);
  });

  it('returns 503 when migration is missing', async () => {
    mocks.generateApplicationMatchingReport.mockResolvedValue({ status: 'migration_missing' });
    setupSupabase();

    const { POST } = await importRoute();
    const response = await POST(request(), context());
    expect(response.status).toBe(503);
  });

  it('returns 200 cached when cached report exists', async () => {
    const cachedRecord = { id: 'cached-1', reportV2: { overall: { fitScore: 90 } } };
    mocks.generateApplicationMatchingReport.mockResolvedValue({ status: 'cached', record: cachedRecord });
    setupSupabase();

    const { POST } = await importRoute();
    const response = await POST(request(), context());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.cached).toBe(true);
    expect(body.analysis).toEqual(cachedRecord);
  });

  it('returns 200 regenerated with analysis, reportV2, and reusedCriterionIds', async () => {
    setupSupabase();

    const { POST } = await importRoute();
    const response = await POST(request(), context());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.cached).toBe(false);
    expect(body.reusedCriterionIds).toEqual(['crit-1']);
  });

  it('returns 502 with previous analysis when generation throws', async () => {
    const prev = { id: 'prev-analysis' };
    mocks.getLatestApplicationMatchingAnalysis.mockResolvedValue({ record: prev, migrationMissing: false });
    mocks.generateApplicationMatchingReport.mockRejectedValue(new Error('AI generation crash'));
    setupSupabase();

    const { POST } = await importRoute();
    const response = await POST(request(), context());
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.analysis).toEqual(prev);
  });
});
