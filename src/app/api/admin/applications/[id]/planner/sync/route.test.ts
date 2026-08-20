import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  isAdmin: vi.fn(),
  syncApplicationPlan: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/server/auth/auth-helpers', () => ({ isAdmin: mocks.isAdmin }));
vi.mock('@/server/payments/manual-review-auth', () => ({
  sameOrigin: (request: Request) => request.headers.get('origin') === 'https://glowbal.test',
}));
vi.mock('@/features/ai-strategy-dashboard/api', () => ({
  PlanPersistenceError: class PlanPersistenceError extends Error {},
  syncApplicationPlan: mocks.syncApplicationPlan,
}));

import { POST } from './route';

afterEach(() => vi.resetAllMocks());

describe('POST /api/admin/applications/[id]/planner/sync', () => {
  const applicationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const request = () => new NextRequest(`https://glowbal.test/api/admin/applications/${applicationId}/planner/sync`, {
    method: 'POST', headers: { origin: 'https://glowbal.test' },
  });

  it('requires an authenticated admin', async () => {
    const supabase = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) } };
    mocks.createClient.mockResolvedValue(supabase);
    mocks.isAdmin.mockResolvedValue(false);

    const response = await POST(request(), { params: Promise.resolve({ id: applicationId }) });

    expect(response.status).toBe(403);
    expect(mocks.syncApplicationPlan).not.toHaveBeenCalled();
  });

  it('syncs an admin\'s own UUID-scoped application', async () => {
    const supabase = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) } };
    mocks.createClient.mockResolvedValue(supabase);
    mocks.isAdmin.mockResolvedValue(true);
    mocks.syncApplicationPlan.mockResolvedValue({ inserted: 4, updated: 0, restored: 0, archived: 0 });

    const response = await POST(request(), { params: Promise.resolve({ id: applicationId }) });

    expect(response.status).toBe(200);
    expect(mocks.syncApplicationPlan).toHaveBeenCalledWith(supabase, applicationId, 'user-1');
  });
});
