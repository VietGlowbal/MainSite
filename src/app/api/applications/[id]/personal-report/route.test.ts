import { beforeEach, describe, expect, it, vi } from 'vitest';
import { personalReportLimiter } from '@/lib/rate-limiter';
import { PERSONAL_REPORT_EXTRACTION_VERSION } from '@/lib/ai/personal-report-v2';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getLatest: vi.fn(),
  enqueue: vi.fn(),
  getGeneration: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supabaseMock }));
vi.mock('@/features/apply/api', () => ({
  getLatestApplicationPersonalReportV2: mocks.getLatest,
  enqueueApplicationPersonalReportGeneration: mocks.enqueue,
  getApplicationPersonalReportGeneration: mocks.getGeneration,
}));

function chain(result: { data: unknown; error: unknown }) {
  const value: Record<string, unknown> = {};
  const self = () => value;
  value.select = self;
  value.eq = self;
  value.order = self;
  value.limit = self;
  value.maybeSingle = async () => result;
  return value;
}

let application: { id: string; candidate_confirmed_at: string | null } | null = {
  id: 'app-1',
  candidate_confirmed_at: '2026-08-20T00:00:00Z',
};
let snapshot: { id: string; confirmed_at: string } | null = {
  id: 'snapshot-1',
  confirmed_at: '2026-08-20T00:00:00Z',
};
let supabaseMock: { auth: { getUser: typeof mocks.getUser }; from: (table: string) => unknown };

function setup() {
  supabaseMock = {
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      if (table === 'course_applications') return chain({ data: application, error: null });
      if (table === 'confirmed_candidate_snapshots') return chain({ data: snapshot, error: null });
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

function context() {
  return { params: Promise.resolve({ id: 'app-1' }) };
}

function request(body?: unknown) {
  return new Request('http://localhost/api/applications/app-1/personal-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('application Personal Report route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    personalReportLimiter.resetAll();
    application = { id: 'app-1', candidate_confirmed_at: '2026-08-20T00:00:00Z' };
    snapshot = { id: 'snapshot-1', confirmed_at: '2026-08-20T00:00:00Z' };
    setup();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.getLatest.mockResolvedValue({ record: null, migrationMissing: false });
    mocks.enqueue.mockResolvedValue({
      migrationMissing: false,
      job: { id: 'job-1', status: 'pending', attempts: 0 },
    });
    mocks.getGeneration.mockResolvedValue({ migrationMissing: false, job: null });
  });

  it('requires authentication and ownership', async () => {
    const { GET } = await import('./route');
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    expect((await GET(new Request('http://localhost/x'), context())).status).toBe(401);

    application = null;
    expect((await GET(new Request('http://localhost/x'), context())).status).toBe(404);
  });

  it('marks a confirmed application stale when its newest snapshot has no report', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/x'), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ applicationId: 'app-1', reportV2: null, confirmed: true, stale: true });
  });

  it('queues application-scoped generation and preserves force intent', async () => {
    const { POST } = await import('./route');
    const response = await POST(request({ trigger: 'matching_report', force: true, idempotencyKey: 'req-1' }), context());

    expect(response.status).toBe(202);
    expect(mocks.enqueue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'user-1', applicationId: 'app-1', force: true, idempotencyKey: 'req-1',
    }));
  });

  it('returns an already-active job without consuming the generation rate limit', async () => {
    const { POST } = await import('./route');
    const activeJob = { id: 'job-1', status: 'pending', attempts: 0 };
    mocks.getGeneration.mockResolvedValue({ migrationMissing: false, job: activeJob });

    for (let i = 0; i < 6; i += 1) {
      const response = await POST(request(), context());
      expect(response.status).toBe(202);
      await expect(response.json()).resolves.toMatchObject({ queued: true, generation: { status: 'pending' } });
    }

    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('returns the current report instead of waiting on a stale active job', async () => {
    const { POST } = await import('./route');
    mocks.getLatest.mockResolvedValue({
      migrationMissing: false,
      record: {
        id: 'report-1',
        reportV2: { coreIdentity: {} },
        confirmedSnapshotId: 'snapshot-1',
        reportContractVersion: 'personal-report-v3',
        engineVersion: '1.1.0',
        promptVersion: PERSONAL_REPORT_EXTRACTION_VERSION,
        generatedAt: '2026-08-28T00:00:00Z',
        trigger: 'manual',
      },
    });
    mocks.getGeneration.mockResolvedValue({
      migrationMissing: false,
      job: { id: 'job-1', status: 'pending', attempts: 0 },
    });

    const response = await POST(request(), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      queued: false,
      cached: true,
      versionId: 'report-1',
      stale: false,
    });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('blocks unconfirmed applications before generation', async () => {
    const { POST } = await import('./route');
    application = { id: 'app-1', candidate_confirmed_at: null };
    const response = await POST(request(), context());

    expect(response.status).toBe(409);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('returns 422 for invalid controls and 429 after the configured window budget', async () => {
    const { POST } = await import('./route');
    expect((await POST(request({ force: 'yes' }), context())).status).toBe(422);

    for (let i = 0; i < 5; i += 1) expect((await POST(request(), context())).status).toBe(202);
    expect((await POST(request(), context())).status).toBe(429);
  });
});
