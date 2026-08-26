import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * POST /api/ai/target-profiles
 *
 * Generates or serves a reusable programme-level Target Profile from
 * ALREADY-INGESTED catalogue data. The request never accepts an arbitrary URL
 * and never initiates crawling.
 */

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  resolveTargetProfile: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
  }),
}));

vi.mock('@/lib/ai/target-profile/generation', () => ({
  resolveTargetProfile: mocks.resolveTargetProfile,
}));

function request(body: unknown) {
  return new Request('http://localhost/api/ai/target-profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
});

describe('POST /api/ai/target-profiles', () => {
  it('rejects an unauthenticated request', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { POST } = await import('./route');
    const response = await POST(request({ programmeId: '0b8f6c1e-0000-4000-8000-000000000001' }));
    expect(response.status).toBe(401);
  });

  it('returns 422 for an invalid body (missing/non-uuid programmeId)', async () => {
    const { POST } = await import('./route');
    const response = await POST(request({ programmeId: 'not-a-uuid' }));
    expect(response.status).toBe(422);
    expect(mocks.resolveTargetProfile).not.toHaveBeenCalled();
  });

  it('returns 409 with a not_ready status when catalogue lineage is absent', async () => {
    mocks.resolveTargetProfile.mockResolvedValue({ status: 'not_ready', reason: 'no programme row' });
    const { POST } = await import('./route');
    const response = await POST(request({ programmeId: '0b8f6c1e-0000-4000-8000-000000000002' }));
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.status).toBe('not_ready');
  });

  it('returns the cached version id on a cache hit', async () => {
    mocks.resolveTargetProfile.mockResolvedValue({
      status: 'cached',
      versionId: 'tp-cached',
      profile: { programme: {} },
    });
    const { POST } = await import('./route');
    const response = await POST(
      request({ programmeId: '0b8f6c1e-0000-4000-8000-000000000003', scholarshipKey: 'merit' }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('cached');
    expect(body.versionId).toBe('tp-cached');
    expect(mocks.resolveTargetProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        programmeId: '0b8f6c1e-0000-4000-8000-000000000003',
        scholarshipKey: 'merit',
      }),
    );
  });

  it('returns stale (regenerated) and ready statuses transparently', async () => {
    const { POST } = await import('./route');

    mocks.resolveTargetProfile.mockResolvedValueOnce({ status: 'stale', versionId: 'tp-new', profile: {} });
    const staleResponse = await POST(request({ programmeId: '0b8f6c1e-0000-4000-8000-000000000004' }));
    expect(staleResponse.status).toBe(200);
    expect((await staleResponse.json()).status).toBe('stale');

    mocks.resolveTargetProfile.mockResolvedValueOnce({ status: 'ready', versionId: 'tp-new2', profile: {} });
    const readyResponse = await POST(request({ programmeId: '0b8f6c1e-0000-4000-8000-000000000004' }));
    expect(readyResponse.status).toBe(200);
    expect((await readyResponse.json()).status).toBe('ready');
  });

  it('never performs a network fetch — crawling is never triggered by this route', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network access attempted'));
    mocks.resolveTargetProfile.mockResolvedValue({ status: 'ready', versionId: 'tp-x', profile: {} });
    const { POST } = await import('./route');

    const response = await POST(request({ programmeId: '0b8f6c1e-0000-4000-8000-000000000005' }));
    expect(response.status).toBe(200);
    // The fetch spy rejecting would have surfaced as a 500 if anything fetched.
    expect(mocks.resolveTargetProfile).toHaveBeenCalledTimes(1);
  });
});
