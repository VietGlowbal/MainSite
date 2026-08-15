import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  listPersonalReportV2Versions: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));

vi.mock('@/features/apply/api', () => ({
  listPersonalReportV2Versions: mocks.listPersonalReportV2Versions,
}));

async function importRoute() {
  return import('./route');
}

describe('GET /api/ai-strategy/personal-report/versions', () => {
  it('requires authentication', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const { GET } = await importRoute();

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('returns the version list for the signed-in user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.listPersonalReportV2Versions.mockResolvedValue({
      versions: [{ id: 'v2', generatedAt: '2026-08-14T00:00:00.000Z', trigger: 'matching_report' }],
      migrationMissing: false,
    });
    const { GET } = await importRoute();

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.versions).toHaveLength(1);
    expect(mocks.listPersonalReportV2Versions).toHaveBeenCalledWith(expect.anything(), 'user-1');
  });

  it('degrades to an empty list when the versions table has not been created yet', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.listPersonalReportV2Versions.mockResolvedValue({ versions: [], migrationMissing: true });
    const { GET } = await importRoute();

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.versions).toEqual([]);
  });
});
