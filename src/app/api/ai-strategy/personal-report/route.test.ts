import { beforeEach, describe, expect, it, vi } from 'vitest';
import { personalReportLimiter } from '@/lib/rate-limiter';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  regeneratePersonalReport: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
  }),
}));

vi.mock('@/features/apply/api', () => ({
  regeneratePersonalReport: mocks.regeneratePersonalReport,
}));

async function importRoute() {
  return import('./route');
}

/** The handler must always produce an HTTP response for every tested request. */
async function post(request: Request) {
  const { POST } = await importRoute();
  const response = await POST(request);
  if (!response) throw new Error('Personal Report route returned no response.');
  return response;
}

function request(body: unknown = { applicationId: 'app-1' }) {
  return new Request('http://localhost/api/ai-strategy/personal-report', {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const FAKE_RECORD = {
  id: 'v1',
  reportV2: { overallEvidenceConfidence: 'low' },
  generatedAt: '2026-08-14T00:00:00.000Z',
};

describe('POST /api/ai-strategy/personal-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    personalReportLimiter.resetAll();
  });

  it('requires authentication', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const response = await post(request({}));

    expect(response.status).toBe(401);
    expect(mocks.regeneratePersonalReport).not.toHaveBeenCalled();
  });

  it('defaults to a manual trigger when no body is sent', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'cached', record: FAKE_RECORD });
    await post(request());

    expect(mocks.regeneratePersonalReport).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', trigger: 'manual' }),
    );
  });

  it('passes through a client-provided supplement_answer trigger', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'regenerated', record: FAKE_RECORD });
    await post(request({ applicationId: 'app-1', trigger: 'supplement_answer' }));

    expect(mocks.regeneratePersonalReport).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'supplement_answer' }),
    );
  });

  it('passes application lineage controls to snapshot-scoped generation', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'cached', record: FAKE_RECORD });
    await post(request({ applicationId: 'app-1', force: true, idempotencyKey: 'request-1' }));

    expect(mocks.regeneratePersonalReport).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        applicationId: 'app-1',
        force: true,
        idempotencyKey: 'request-1',
      }),
    );
  });

  it('accepts matching_report for the compatibility seam', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'cached', record: FAKE_RECORD });
    await post(request({ applicationId: 'app-1', trigger: 'matching_report' }));

    expect(mocks.regeneratePersonalReport).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'matching_report' }));
  });

  it('requires application context and never creates a global report row', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const response = await post(request({}));
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe('APPLICATION_REQUIRED');
    expect(mocks.regeneratePersonalReport).not.toHaveBeenCalled();
  });

  it('returns the cached report with its version id', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'cached', record: FAKE_RECORD });
    const response = await post(request({ applicationId: 'app-1' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      reportV2: FAKE_RECORD.reportV2,
      cached: true,
      versionId: 'v1',
      generatedAt: FAKE_RECORD.generatedAt,
    });
  });

  it('returns 503 when the versions table has not been created yet', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'migration_missing' });
    const response = await post(request({ applicationId: 'app-1' }));
    expect(response.status).toBe(503);
  });

  it('returns 503 when OpenAI is not configured', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'not_configured' });
    const response = await post(request({ applicationId: 'app-1' }));
    expect(response.status).toBe(503);
  });

  it('returns 502 and keeps any previous report on generation failure', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.regeneratePersonalReport.mockResolvedValue({
      status: 'error',
      message: 'The AI could not produce a valid report.',
      record: FAKE_RECORD,
    });
    const response = await post(request({ applicationId: 'app-1' }));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.reportV2).toEqual(FAKE_RECORD.reportV2);
  });
});
