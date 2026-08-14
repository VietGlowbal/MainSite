import { describe, expect, it, vi } from 'vitest';

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

function request(body?: unknown) {
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
  it('requires authentication', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();

    const response = await POST(request({}));

    expect(response.status).toBe(401);
    expect(mocks.regeneratePersonalReport).not.toHaveBeenCalled();
  });

  it('defaults to a manual trigger when no body is sent', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'cached', record: FAKE_RECORD });
    const { POST } = await importRoute();

    await POST(request());

    expect(mocks.regeneratePersonalReport).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', trigger: 'manual' }),
    );
  });

  it('passes through a client-provided supplement_answer trigger', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'regenerated', record: FAKE_RECORD });
    const { POST } = await importRoute();

    await POST(request({ trigger: 'supplement_answer' }));

    expect(mocks.regeneratePersonalReport).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'supplement_answer' }),
    );
  });

  it('ignores an unrecognised trigger value and falls back to manual', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'cached', record: FAKE_RECORD });
    const { POST } = await importRoute();

    await POST(request({ trigger: 'matching_report' }));

    expect(mocks.regeneratePersonalReport).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'manual' }));
  });

  it('returns the cached report with its version id', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'cached', record: FAKE_RECORD });
    const { POST } = await importRoute();

    const response = await POST(request({}));
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
    const { POST } = await importRoute();

    const response = await POST(request({}));
    expect(response.status).toBe(503);
  });

  it('returns 503 when OpenAI is not configured', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.regeneratePersonalReport.mockResolvedValue({ status: 'not_configured' });
    const { POST } = await importRoute();

    const response = await POST(request({}));
    expect(response.status).toBe(503);
  });

  it('returns 502 and keeps any previous report on generation failure', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.regeneratePersonalReport.mockResolvedValue({
      status: 'error',
      message: 'The AI could not produce a valid report.',
      record: FAKE_RECORD,
    });
    const { POST } = await importRoute();

    const response = await POST(request({}));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.reportV2).toEqual(FAKE_RECORD.reportV2);
  });
});
