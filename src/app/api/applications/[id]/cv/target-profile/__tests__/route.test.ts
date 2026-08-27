import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Route tests for the target profile endpoints.
 *
 * The interesting assertions are the ones about what must NOT happen: a
 * non-owner must not get data, and a patch that changes nothing must not bump the
 * version. The second one is not a nicety — a version bump invalidates the CV
 * review, and the autosave hook fires on every typing pause, so a no-op that
 * wrote would make a paid-for review go stale from a stray focus event.
 */

const requireApplicationOwner = vi.fn();
const getOrCreateStrategy = vi.fn();
const getTargetProfile = vi.fn();
const upsertTargetProfile = vi.fn();
const trackApplicationEvent = vi.fn();

vi.mock('@/server/auth', () => ({
  requireApplicationOwner: (...args: unknown[]) => requireApplicationOwner(...args),
}));

vi.mock('@/features/application-strategy/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/application-strategy/api')>(
    '@/features/application-strategy/api',
  );
  return {
    ...actual,
    getOrCreateStrategy: (...args: unknown[]) => getOrCreateStrategy(...args),
    getTargetProfile: (...args: unknown[]) => getTargetProfile(...args),
    upsertTargetProfile: (...args: unknown[]) => upsertTargetProfile(...args),
  };
});

vi.mock('@/lib/analytics/track', () => ({
  trackApplicationEvent: (...args: unknown[]) => trackApplicationEvent(...args),
}));

const APP_ID = '11111111-1111-4111-8111-111111111111';

function params() {
  return { params: Promise.resolve({ id: APP_ID }) };
}

function ownerOk() {
  return { supabase: {}, user: { id: 'user-1' }, application: { id: APP_ID } };
}

const STORED = {
  id: 'tp-1',
  strategyId: 'strategy-1',
  careerDirection: 'Data engineering in healthcare',
  universityPositioning: null,
  educationPhilosophy: null,
  environment: null,
  programmeObjectives: null,
  priorityCapabilities: null,
  careerAlignment: null,
  missingInformation: [],
  sourcesUsed: [],
  version: 3,
  generatedAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  getOrCreateStrategy.mockResolvedValue({ id: 'strategy-1', status: 'in_progress' });
  getTargetProfile.mockResolvedValue(STORED);
  trackApplicationEvent.mockResolvedValue(undefined);
});

describe('GET /api/applications/[id]/cv/target-profile', () => {
  it('returns 401 without a session', async () => {
    requireApplicationOwner.mockResolvedValue({
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const { GET } = await import('../route');
    const response = await GET(new Request('http://localhost'), params());
    expect(response.status).toBe(401);
  });

  it('returns 404 for an application the caller does not own', async () => {
    requireApplicationOwner.mockResolvedValue({
      response: new Response(JSON.stringify({ error: 'Application not found' }), { status: 404 }),
    });

    const { GET } = await import('../route');
    const response = await GET(new Request('http://localhost'), params());
    expect(response.status).toBe(404);
    // The body must not distinguish "does not exist" from "not yours".
    await expect(response.json()).resolves.toEqual({ error: 'Application not found' });
  });

  it('returns the stored profile for the owner', async () => {
    requireApplicationOwner.mockResolvedValue(ownerOk());

    const { GET } = await import('../route');
    const response = await GET(new Request('http://localhost'), params());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, targetProfile: STORED });
  });

  it('reports a missing migration as a 503 with an actionable message', async () => {
    requireApplicationOwner.mockResolvedValue(ownerOk());
    getOrCreateStrategy.mockRejectedValue(
      new Error('relation "application_strategies" does not exist'),
    );

    const { GET } = await import('../route');
    const response = await GET(new Request('http://localhost'), params());
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string; code: string };
    expect(body.code).toBe('migration_required');
    expect(body.error).toContain('supabase-application-strategy.sql');
  });
});

describe('PATCH /api/applications/[id]/cv/target-profile', () => {
  function patch(body: unknown) {
    return new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('rejects a body that is not a valid patch', async () => {
    requireApplicationOwner.mockResolvedValue(ownerOk());

    const { PATCH } = await import('../route');
    const response = await PATCH(patch({ careerDirection: { nope: true } }), params());
    expect(response.status).toBe(400);
    expect(upsertTargetProfile).not.toHaveBeenCalled();
  });

  it('rejects a field longer than the column allows', async () => {
    requireApplicationOwner.mockResolvedValue(ownerOk());

    const { PATCH } = await import('../route');
    const response = await PATCH(patch({ careerDirection: 'x'.repeat(5000) }), params());
    expect(response.status).toBe(400);
  });

  it('saves a real edit and returns the new version', async () => {
    requireApplicationOwner.mockResolvedValue(ownerOk());
    upsertTargetProfile.mockResolvedValue({ ...STORED, careerDirection: 'Something new', version: 4 });

    const { PATCH } = await import('../route');
    const response = await PATCH(patch({ careerDirection: 'Something new' }), params());

    expect(response.status).toBe(200);
    const body = (await response.json()) as { version: number };
    expect(body.version).toBe(4);
    expect(upsertTargetProfile).toHaveBeenCalledOnce();
  });

  /**
   * The one that matters. Autosave fires on a typing pause, including a pause
   * after the student changed nothing, and a write here would bump `version` and
   * mark their CV review outdated.
   */
  it('does not write when the patch changes nothing', async () => {
    requireApplicationOwner.mockResolvedValue(ownerOk());

    const { PATCH } = await import('../route');
    const response = await PATCH(patch({ careerDirection: STORED.careerDirection }), params());

    expect(response.status).toBe(200);
    const body = (await response.json()) as { unchanged?: boolean; targetProfile: { version: number } };
    expect(body.unchanged).toBe(true);
    expect(body.targetProfile.version).toBe(3);
    expect(upsertTargetProfile).not.toHaveBeenCalled();
  });

  it('treats null and an empty string as the same stored value', async () => {
    requireApplicationOwner.mockResolvedValue(ownerOk());

    const { PATCH } = await import('../route');
    // universityPositioning is stored as null; clearing an already-empty box must
    // not count as a change.
    const response = await PATCH(patch({ universityPositioning: '' }), params());

    const body = (await response.json()) as { unchanged?: boolean };
    expect(body.unchanged).toBe(true);
    expect(upsertTargetProfile).not.toHaveBeenCalled();
  });

  it('emits the edited event on a real save', async () => {
    requireApplicationOwner.mockResolvedValue(ownerOk());
    upsertTargetProfile.mockResolvedValue({ ...STORED, version: 4 });

    const { PATCH } = await import('../route');
    await PATCH(patch({ careerDirection: 'Changed' }), params());

    expect(trackApplicationEvent).toHaveBeenCalledOnce();
    const call = trackApplicationEvent.mock.calls[0]?.[0] as { eventType: string; metadata: unknown };
    expect(call.eventType).toBe('cv_target_profile_edited');
    // Analytics carries the version, never the field content.
    expect(JSON.stringify(call.metadata)).not.toContain('Changed');
  });
});
