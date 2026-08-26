import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), save: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supabaseMock }));
vi.mock('@/features/apply/api', () => ({ saveApplicationPersonalReportSupplement: mocks.save }));

function chain(data: unknown) {
  const value: Record<string, unknown> = {};
  const self = () => value;
  value.select = self; value.eq = self; value.maybeSingle = async () => ({ data, error: null });
  return value;
}
let supabaseMock: { auth: { getUser: typeof mocks.getUser }; from: (table: string) => unknown };

describe('POST application Personal Report supplement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock = { auth: { getUser: mocks.getUser }, from: () => chain({ id: 'app-1', candidate_confirmed_at: '2026-08-20' }) };
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.save.mockResolvedValue({ error: null });
  });

  it('writes an allowed supplement with both ownership keys', async () => {
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/x', {
      method: 'POST', body: JSON.stringify({ fieldKey: 'study_motivation', answer: 'I want to build useful tools.' }),
    }), { params: Promise.resolve({ id: 'app-1' }) });
    expect(response.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(expect.anything(), {
      userId: 'user-1', applicationId: 'app-1', fieldKey: 'study_motivation', answer: 'I want to build useful tools.',
    });
  });

  it('rejects unknown fields and malformed input', async () => {
    const { POST } = await import('./route');
    const context = { params: Promise.resolve({ id: 'app-1' }) };
    expect((await POST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify({ fieldKey: 'role', answer: 'x' }) }), context)).status).toBe(422);
    expect((await POST(new Request('http://localhost/x', { method: 'POST', body: '{}' }), context)).status).toBe(422);
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
