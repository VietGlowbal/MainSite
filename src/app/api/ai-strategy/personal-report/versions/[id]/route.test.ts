import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getPersonalReportV2Version: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));

vi.mock('@/features/apply/api', () => ({
  getPersonalReportV2Version: mocks.getPersonalReportV2Version,
}));

async function importRoute() {
  return import('./route');
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/ai-strategy/personal-report/versions/[id]', () => {
  it('requires authentication', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const { GET } = await importRoute();

    const response = await GET(new Request('http://localhost/x'), context('v1'));
    expect(response.status).toBe(401);
    expect(mocks.getPersonalReportV2Version).not.toHaveBeenCalled();
  });

  it('returns one version scoped to the signed-in user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.getPersonalReportV2Version.mockResolvedValue({
      record: {
        id: 'v1',
        reportV2: { overallEvidenceConfidence: 'low' },
        generatedAt: '2026-08-13T00:00:00.000Z',
        trigger: 'manual',
      },
      migrationMissing: false,
    });
    const { GET } = await importRoute();

    const response = await GET(new Request('http://localhost/x'), context('v1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      reportV2: { overallEvidenceConfidence: 'low' },
      generatedAt: '2026-08-13T00:00:00.000Z',
      trigger: 'manual',
    });
    expect(mocks.getPersonalReportV2Version).toHaveBeenCalledWith(expect.anything(), 'user-1', 'v1');
  });

  it('returns 404 for a version that does not exist or is not owned by this user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.getPersonalReportV2Version.mockResolvedValue({ record: null, migrationMissing: false });
    const { GET } = await importRoute();

    const response = await GET(new Request('http://localhost/x'), context('not-mine'));
    expect(response.status).toBe(404);
  });

  it('returns 503 when the versions table has not been created yet', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.getPersonalReportV2Version.mockResolvedValue({ record: null, migrationMissing: true });
    const { GET } = await importRoute();

    const response = await GET(new Request('http://localhost/x'), context('v1'));
    expect(response.status).toBe(503);
  });
});
