import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  decideAdvisorApplication: vi.fn(),
}));

vi.mock('@/features/mentorship/api', () => ({
  decideAdvisorApplication: mocks.decideAdvisorApplication,
}));

import { PATCH } from './route';

describe('PATCH /api/admin/achievers/[id]', () => {
  const id = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function request(body: unknown) {
    return new NextRequest(`https://glowbal.test/api/admin/achievers/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('rejects invalid decisions before reaching the repository', async () => {
    const response = await PATCH(request({ status: 'suspended' }), {
      params: Promise.resolve({ id }),
    });

    expect(response.status).toBe(400);
    expect(mocks.decideAdvisorApplication).not.toHaveBeenCalled();
  });

  it('returns the repository authorization failure', async () => {
    mocks.decideAdvisorApplication.mockResolvedValue({
      ok: false,
      error: 'Forbidden',
      status: 403,
    });

    const response = await PATCH(request({ status: 'approved' }), {
      params: Promise.resolve({ id }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('returns the saved application decision', async () => {
    mocks.decideAdvisorApplication.mockResolvedValue({
      ok: true,
      application: { id, status: 'rejected', verified_at: null },
    });

    const response = await PATCH(request({ status: 'rejected' }), {
      params: Promise.resolve({ id }),
    });

    expect(response.status).toBe(200);
    expect(mocks.decideAdvisorApplication).toHaveBeenCalledWith(id, 'rejected');
    await expect(response.json()).resolves.toEqual({
      ok: true,
      application: { id, status: 'rejected', verified_at: null },
    });
  });
});
