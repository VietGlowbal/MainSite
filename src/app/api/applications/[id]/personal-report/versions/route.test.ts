import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), list: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supabaseMock }));
vi.mock('@/features/apply/api', () => ({ listApplicationPersonalReportV2Versions: mocks.list }));

function chain(data: unknown, error: unknown = null) {
  const value: Record<string, unknown> = {};
  const self = () => value;
  value.select = self; value.eq = self; value.maybeSingle = async () => ({ data, error });
  return value;
}

let supabaseMock: { auth: { getUser: typeof mocks.getUser }; from: (table: string) => unknown };
function setup(application: unknown = { id: 'app-1', candidate_confirmed_at: null }) {
  supabaseMock = { auth: { getUser: mocks.getUser }, from: () => chain(application) };
}

describe('GET application Personal Report versions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.list.mockResolvedValue({ versions: [{ id: 'v1', generatedAt: '2026-08-20', trigger: 'manual' }], migrationMissing: false });
  });

  it('returns only the requested application history', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/x'), { params: Promise.resolve({ id: 'app-1' }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ applicationId: 'app-1', versions: [{ id: 'v1', generatedAt: '2026-08-20', trigger: 'manual' }] });
    expect(mocks.list).toHaveBeenCalledWith(expect.anything(), { userId: 'user-1', applicationId: 'app-1' });
  });

  it('returns 503 when the application report migration is missing', async () => {
    const { GET } = await import('./route');
    mocks.list.mockResolvedValueOnce({ versions: [], migrationMissing: true });
    const response = await GET(new Request('http://localhost/x'), { params: Promise.resolve({ id: 'app-1' }) });
    expect(response.status).toBe(503);
  });
});
