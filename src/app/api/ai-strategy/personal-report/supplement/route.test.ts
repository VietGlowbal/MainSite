import { describe, expect, it, vi } from 'vitest';

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
  return new Request('http://localhost/api/ai-strategy/personal-report/supplement', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/ai-strategy/personal-report/supplement', () => {
  it('requires authentication', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();

    const response = await POST(request({ fieldKey: 'study_motivation', answer: 'Because I care about it.' }));

    expect(response.status).toBe(401);
    expect(mocks.savePersonalReportSupplement).not.toHaveBeenCalled();
  });

  it('rejects a field key the report does not know how to ask about', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const { POST } = await importRoute();

    const response = await POST(request({ fieldKey: 'not_a_real_field', answer: 'Because I care about it.' }));

    expect(response.status).toBe(400);
    expect(mocks.savePersonalReportSupplement).not.toHaveBeenCalled();
  });

  it('rejects an empty answer', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const { POST } = await importRoute();

    const response = await POST(request({ fieldKey: 'study_motivation', answer: '   ' }));

    expect(response.status).toBe(400);
    expect(mocks.savePersonalReportSupplement).not.toHaveBeenCalled();
  });

  it('saves a valid answer for the signed-in user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.savePersonalReportSupplement.mockResolvedValue({ error: null });
    const { POST } = await importRoute();

    const response = await POST(
      request({ fieldKey: 'study_motivation', answer: 'Because I care about accessible education.' }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.savePersonalReportSupplement).toHaveBeenCalledWith(
      expect.anything(),
      {
        userId: 'user-1',
        fieldKey: 'study_motivation',
        answer: 'Because I care about accessible education.',
      },
    );
  });

  it('reports a 503 when the migration has not run yet', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.savePersonalReportSupplement.mockResolvedValue({
      error: { migrationMissing: true, message: 'relation does not exist' },
    });
    const { POST } = await importRoute();

    const response = await POST(request({ fieldKey: 'study_motivation', answer: 'Because I care.' }));

    expect(response.status).toBe(503);
  });
});
