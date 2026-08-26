import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), getLatest: vi.fn(), getVersion: vi.fn(), getAnalysis: vi.fn(), save: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supabaseMock }));
vi.mock('@/features/apply/api', () => ({
  getLatestApplicationPersonalReportV2: mocks.getLatest,
  getApplicationPersonalReportV2Version: mocks.getVersion,
  getApplicationProfileAnalysisVersion: mocks.getAnalysis,
  saveApplicationPersonalReportSupplement: mocks.save,
}));

function chain(data: unknown) {
  const value: Record<string, unknown> = {};
  const self = () => value;
  value.select = self; value.eq = self; value.maybeSingle = async () => ({ data, error: null });
  return value;
}
let supabaseMock: { auth: { getUser: typeof mocks.getUser }; from: (table: string) => unknown };

describe('GET application Personal Report evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock = { auth: { getUser: mocks.getUser }, from: () => chain({ id: 'app-1', candidate_confirmed_at: '2026-08-14T00:00:00.000Z' }) };
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.getLatest.mockResolvedValue({ migrationMissing: false, record: {
      id: 'report-1', sourceAnalysisVersionId: 'analysis-1', confirmedSnapshotId: 'snap-1',
    } });
    mocks.getAnalysis.mockResolvedValue({ migrationMissing: false, analysis: {
      id: 'analysis-1', evidenceBank: { version: 'eb-v1', sources: {}, claims: [], interpretations: [], missingInformation: [] },
    } });
    mocks.save.mockResolvedValue({ error: null });
  });

  it('resolves provenance from the report version and its exact analysis version', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/x'), { params: Promise.resolve({ id: 'app-1' }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.provenance).toEqual({ reportVersionId: 'report-1', analysisVersionId: 'analysis-1', confirmedSnapshotId: 'snap-1' });
    expect(mocks.getAnalysis).toHaveBeenCalledWith(expect.anything(), { userId: 'user-1', applicationId: 'app-1' }, 'analysis-1');
  });

  it('keeps a requested historical version application-scoped', async () => {
    const { GET } = await import('./route');
    mocks.getVersion.mockResolvedValueOnce({ migrationMissing: false, record: {
      id: 'report-old', sourceAnalysisVersionId: 'analysis-old', confirmedSnapshotId: 'snap-old',
    } });
    const response = await GET(new Request('http://localhost/x?versionId=report-old'), { params: Promise.resolve({ id: 'app-1' }) });
    expect(response.status).toBe(200);
    expect(mocks.getVersion).toHaveBeenCalledWith(expect.anything(), { userId: 'user-1', applicationId: 'app-1' }, 'report-old');
  });

  it('stores inline evidence as an application-scoped report-only supplement', async () => {
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/x', {
      method: 'POST', body: JSON.stringify({ answer: 'I led a community workshop.' }),
    }), { params: Promise.resolve({ id: 'app-1' }) });
    expect(response.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'user-1', applicationId: 'app-1', answer: JSON.stringify({ answer: 'I led a community workshop.' }),
    }));
    expect(mocks.save.mock.calls[0]?.[1].fieldKey).toMatch(/^evidence:/);
  });
});
