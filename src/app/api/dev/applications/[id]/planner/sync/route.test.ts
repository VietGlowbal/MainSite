import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  syncApplicationPlan: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/features/ai-strategy-dashboard/api', () => ({
  PlanPersistenceError: class PlanPersistenceError extends Error {},
  syncApplicationPlan: mocks.syncApplicationPlan,
}));

import { POST } from './route';

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe('POST /api/dev/applications/[id]/planner/sync', () => {
  it('does not expose canonical-plan generation in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const response = await POST(
      new NextRequest('https://glowbal.test/api/dev/applications/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/planner/sync', { method: 'POST' }),
      { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('rejects cross-origin requests before calling Supabase', async () => {
    const response = await POST(
      new NextRequest('https://glowbal.test/api/dev/applications/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/planner/sync', { method: 'POST' }),
      { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('syncs only the authenticated user\'s UUID-scoped application', async () => {
    const supabase = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) } };
    mocks.createClient.mockResolvedValue(supabase);
    mocks.syncApplicationPlan.mockResolvedValue({ inserted: 4, updated: 0, restored: 0, archived: 0 });
    const applicationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    const response = await POST(
      new NextRequest(`https://glowbal.test/api/dev/applications/${applicationId}/planner/sync`, {
        method: 'POST',
        headers: { origin: 'https://glowbal.test' },
      }),
      { params: Promise.resolve({ id: applicationId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.syncApplicationPlan).toHaveBeenCalledWith(supabase, applicationId, 'user-1');
    await expect(response.json()).resolves.toEqual({ result: { inserted: 4, updated: 0, restored: 0, archived: 0 } });
  });
});
