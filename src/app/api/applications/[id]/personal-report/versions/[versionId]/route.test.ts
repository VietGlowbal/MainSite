import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getVersion: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supabaseMock }));
vi.mock('@/features/apply/api', () => ({ getApplicationPersonalReportV2Version: mocks.getVersion }));

function chain(data: unknown) {
  const value: Record<string, unknown> = {};
  const self = () => value;
  value.select = self; value.eq = self; value.maybeSingle = async () => ({ data, error: null });
  return value;
}
let supabaseMock: { auth: { getUser: typeof mocks.getUser }; from: (table: string) => unknown };

describe('GET application Personal Report version', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock = { auth: { getUser: mocks.getUser }, from: () => chain({ id: 'app-1', candidate_confirmed_at: null }) };
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.getVersion.mockResolvedValue({
      migrationMissing: false,
      record: {
        id: 'v1', reportV2: { overallEvidenceConfidence: 'high' }, generatedAt: '2026-08-20', trigger: 'manual',
        confirmedSnapshotId: 'snap-1', sourceAnalysisVersionId: 'analysis-1',
      },
    });
  });

  it('passes application ownership to the version reader', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/x'), { params: Promise.resolve({ id: 'app-1', versionId: 'v1' }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ applicationId: 'app-1', reportVersionId: 'v1', sourceAnalysisVersionId: 'analysis-1' });
    expect(mocks.getVersion).toHaveBeenCalledWith(expect.anything(), { userId: 'user-1', applicationId: 'app-1' }, 'v1');
  });

  it('hides a version outside the application scope', async () => {
    const { GET } = await import('./route');
    mocks.getVersion.mockResolvedValueOnce({ record: null, migrationMissing: false });
    expect((await GET(new Request('http://localhost/x'), { params: Promise.resolve({ id: 'app-1', versionId: 'other' }) })).status).toBe(404);
  });
});
