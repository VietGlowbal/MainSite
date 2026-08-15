import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  savePersonalReportSupplement: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
  }),
}));

vi.mock('@/features/apply/api', () => ({
  savePersonalReportSupplement: mocks.savePersonalReportSupplement,
}));

async function importRoute() {
  return import('./route');
}

function request(body: unknown) {
  return new Request('http://localhost/api/ai-strategy/personal-report/evidence', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/ai-strategy/personal-report/evidence', () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.savePersonalReportSupplement.mockReset();
  });

  it('requires authentication', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();

    const response = await POST(request({ answer: 'I organised a peer mentoring programme.' }));

    expect(response.status).toBe(401);
    expect(mocks.savePersonalReportSupplement).not.toHaveBeenCalled();
  });

  it('rejects an empty evidence answer', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const { POST } = await importRoute();

    const response = await POST(request({ answer: '   ' }));

    expect(response.status).toBe(400);
    expect(mocks.savePersonalReportSupplement).not.toHaveBeenCalled();
  });

  it('stores quick evidence as a report-only supplemental experience', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.savePersonalReportSupplement.mockResolvedValue({ error: null });
    const { POST } = await importRoute();

    const answer = 'I organised a peer mentoring programme and matched 18 students with mentors.';
    const response = await POST(request({ answer }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.savePersonalReportSupplement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'user-1',
        fieldKey: expect.stringMatching(/^evidence:/),
        answer: JSON.stringify({ answer }),
      }),
    );
  });

  it('reports a 503 when report supplements are unavailable', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.savePersonalReportSupplement.mockResolvedValue({
      error: { migrationMissing: true, message: 'relation does not exist' },
    });
    const { POST } = await importRoute();

    const response = await POST(request({ answer: 'I led a student project.' }));

    expect(response.status).toBe(503);
  });
});
