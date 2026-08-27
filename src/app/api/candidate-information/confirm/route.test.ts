import { beforeEach, describe, expect, it, vi } from 'vitest';

const READY_REFLECTION = {
  majors: [],
  countries: [],
  achievements: [],
  activities: [],
};

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  loadCandidateReflection: vi.fn(),
  verifiedApplicationId: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.rpc,
  }),
}));

vi.mock('@/features/apply/api', async () => ({
  ...(await vi.importActual<object>('@/features/apply/api')),
  loadCandidateReflection: mocks.loadCandidateReflection,
  verifiedApplicationId: mocks.verifiedApplicationId,
}));

function selectBuilder(result: { data: unknown; error: unknown }, eqCalls: unknown[][] = []) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (...args: unknown[]) => {
      eqCalls.push(args);
      return builder;
    },
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => result,
  };
  return builder;
}

function insertBuilder(result: { data: unknown; error: unknown }, insertedRows: Record<string, unknown>[] = []) {
  const builder: Record<string, unknown> = {
    insert: (row: Record<string, unknown>) => {
      insertedRows.push(row);
      return builder;
    },
    select: () => builder,
    single: async () => result,
  };
  return builder;
}

function updateBuilder(
  result: { error: unknown },
  calls: { value?: Record<string, unknown>; eq?: unknown[] } = {},
) {
  const builder: Record<string, unknown> = {
    update: (value: Record<string, unknown>) => {
      calls.value = value;
      return builder;
    },
    eq: async (...args: unknown[]) => {
      calls.eq = args;
      return result;
    },
  };
  return builder;
}

function request(body: unknown = {}) {
  return new Request('http://localhost/api/candidate-information/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  mocks.verifiedApplicationId.mockResolvedValue(undefined);
  mocks.rpc.mockResolvedValue({
    data: [{ snapshot_id: 'snap-rpc', confirmed_at: '2026-08-13T12:00:00Z' }],
    error: null,
  });
});

describe('POST /api/candidate-information/confirm', () => {
  it('rejects an unauthenticated request', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await import('./route');
    const response = await POST(request());
    expect(response.status).toBe(401);
  });

  it('is idempotent: returns the existing snapshot rather than creating a second one', async () => {
    mocks.loadCandidateReflection.mockResolvedValue({
      reflection: READY_REFLECTION,
      documents: [],
      confirmedAt: '2026-08-13T10:00:00Z',
    });
    mocks.from.mockImplementation((table: string) => {
      expect(table).toBe('confirmed_candidate_snapshots');
      return selectBuilder({ data: { id: 'snap-1', confirmed_at: '2026-08-13T09:00:00Z' }, error: null });
    });

    const { POST } = await import('./route');
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ snapshotId: 'snap-1', status: 'confirmed', confirmedAt: '2026-08-13T10:00:00Z' });
    // Only the read path, never an insert — confirming twice must not create
    // a second row.
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it('allows confirmation when retired reflection fields were never collected', async () => {
    mocks.loadCandidateReflection.mockResolvedValue({
      reflection: {
        ...READY_REFLECTION,
        countryPreferenceFlexible: undefined,
        intendedLevel: undefined,
        intake: undefined,
      },
      documents: [],
      confirmedAt: null,
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'confirmed_candidate_snapshots') {
        return insertBuilder({ data: { id: 'snap-no-legacy', confirmed_at: '2026-08-13T12:00:00Z' }, error: null });
      }
      if (table === 'student_profiles') {
        return updateBuilder({ error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const { POST } = await import('./route');
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.snapshotId).toBe('snap-no-legacy');
  });

  it('allows confirmation when a legacy extracted achievement still has review status', async () => {
    mocks.loadCandidateReflection.mockResolvedValue({
      reflection: {
        ...READY_REFLECTION,
        achievements: [{ category: 'academic_award', title: 'Demo', reviewStatus: 'needs_review' }],
      },
      documents: [],
      confirmedAt: null,
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'confirmed_candidate_snapshots') {
        return insertBuilder({ data: { id: 'snap-legacy-review', confirmed_at: '2026-08-13T12:00:00Z' }, error: null });
      }
      if (table === 'student_profiles') return updateBuilder({ error: null });
      throw new Error(`unexpected table ${table}`);
    });

    const { POST } = await import('./route');
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.snapshotId).toBe('snap-legacy-review');
  });

  it('creates a snapshot and locks the profile when ready', async () => {
    mocks.loadCandidateReflection.mockResolvedValue({
      reflection: READY_REFLECTION,
      documents: [{ id: 'doc-1', fileName: 'CV.pdf', storageKey: 'k', uploadedAt: '2026-08-13T00:00:00Z' }],
      confirmedAt: null,
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'confirmed_candidate_snapshots') {
        return insertBuilder({ data: { id: 'snap-2', confirmed_at: '2026-08-13T12:00:00Z' }, error: null });
      }
      if (table === 'student_profiles') {
        return updateBuilder({ error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const { POST } = await import('./route');
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ snapshotId: 'snap-2', status: 'confirmed', confirmedAt: '2026-08-13T12:00:00Z' });
  });

  it('still reports success if the snapshot saved but the profile lock column is not migrated yet', async () => {
    mocks.loadCandidateReflection.mockResolvedValue({
      reflection: READY_REFLECTION,
      documents: [],
      confirmedAt: null,
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'confirmed_candidate_snapshots') {
        return insertBuilder({ data: { id: 'snap-3', confirmed_at: '2026-08-13T12:00:00Z' }, error: null });
      }
      if (table === 'student_profiles') {
        return updateBuilder({ error: { code: '42703', message: 'column "confirmed_at" does not exist' } });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const { POST } = await import('./route');
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.snapshotId).toBe('snap-3');
  });

  it('returns 503 when the snapshot table itself is not migrated yet', async () => {
    mocks.loadCandidateReflection.mockResolvedValue({
      reflection: READY_REFLECTION,
      documents: [],
      confirmedAt: null,
    });
    mocks.from.mockImplementation(() =>
      insertBuilder({ data: null, error: { code: '42P01', message: 'relation "confirmed_candidate_snapshots" does not exist' } }),
    );

    const { POST } = await import('./route');
    const response = await POST(request());
    expect(response.status).toBe(503);
  });

  it('returns 500, not 503, when the insert fails on an RLS policy rather than a missing migration', async () => {
    // The production incident this guards against: an RLS `insufficient_
    // privilege` error's message still names the table ("new row violates
    // row-level security policy for table confirmed_candidate_snapshots"),
    // which a looser table-name-in-message check would misclassify as
    // "migration not run yet" — telling a student to retry a request that
    // could never succeed, instead of surfacing the real (permission) error.
    mocks.loadCandidateReflection.mockResolvedValue({
      reflection: READY_REFLECTION,
      documents: [],
      confirmedAt: null,
    });
    mocks.from.mockImplementation(() =>
      insertBuilder({
        data: null,
        error: {
          code: '42501',
          message:
            'new row violates row-level security policy for table "confirmed_candidate_snapshots"',
        },
      }),
    );

    const { POST } = await import('./route');
    const response = await POST(request());
    expect(response.status).toBe(500);
  });

  it('rejects malformed JSON/schema input instead of treating it as a global confirmation', async () => {
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/candidate-information/confirm', {
      method: 'POST',
      body: '{not-json',
    }));

    expect(response.status).toBe(422);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  /**
   * Per-application coverage — the fix for "a new application can't be
   * confirmed, it always uses the old one" (docs/known-issues.md).
   */
  describe('with a verified applicationId', () => {
    beforeEach(() => {
      mocks.verifiedApplicationId.mockResolvedValue('app-1');
    });

    it('returns 404 for an application that cannot be verified', async () => {
      mocks.verifiedApplicationId.mockResolvedValue(undefined);
      const { POST } = await import('./route');
      const response = await POST(request({ applicationId: '11111111-1111-4111-8111-111111111111' }));

      expect(response.status).toBe(404);
      expect(mocks.from).not.toHaveBeenCalled();
    });

    it('scopes the idempotency lookup to this application, not the whole user', async () => {
      mocks.loadCandidateReflection.mockResolvedValue({
        reflection: READY_REFLECTION,
        documents: [],
        confirmedAt: '2026-08-13T10:00:00Z',
      });
      const eqCalls: unknown[][] = [];
      mocks.from.mockImplementation((table: string) => {
        expect(table).toBe('confirmed_candidate_snapshots');
        return selectBuilder({ data: { id: 'snap-app-1', confirmed_at: '2026-08-13T09:00:00Z' }, error: null }, eqCalls);
      });

      const { POST } = await import('./route');
      const response = await POST(request({ applicationId: '11111111-1111-4111-8111-111111111111' }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.snapshotId).toBe('snap-app-1');
      expect(eqCalls).toContainEqual(['application_id', 'app-1']);
    });

    it('confirms through the application-scoped atomic RPC and never falls back to a global insert', async () => {
      mocks.loadCandidateReflection.mockResolvedValue({
        reflection: READY_REFLECTION,
        documents: [],
        confirmedAt: null,
      });
      mocks.rpc.mockResolvedValue({
        data: [{ snapshot_id: 'snap-4', confirmed_at: '2026-08-13T12:00:00Z' }],
        error: null,
      });
      mocks.from.mockImplementation((table: string) => {
        if (table === 'student_profiles') {
          return updateBuilder({ error: null });
        }
        throw new Error(`unexpected table ${table}`);
      });

      const { POST } = await import('./route');
      const response = await POST(request({ applicationId: '11111111-1111-4111-8111-111111111111' }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ snapshotId: 'snap-4', status: 'confirmed', confirmedAt: '2026-08-13T12:00:00Z' });
      expect(mocks.rpc).toHaveBeenCalledWith(
        'confirm_application_candidate_snapshot',
        expect.objectContaining({ p_application_id: 'app-1', p_payload_hash: expect.any(String) }),
      );
      expect(mocks.from).not.toHaveBeenCalledWith('confirmed_candidate_snapshots');
    });

    it('returns 503 when the application confirmation migration is missing', async () => {
      mocks.loadCandidateReflection.mockResolvedValue({
        reflection: READY_REFLECTION,
        documents: [],
        confirmedAt: null,
      });
      mocks.rpc.mockResolvedValue({ data: null, error: { code: '42883', message: 'function does not exist' } });

      const { POST } = await import('./route');
      const response = await POST(request({ applicationId: '11111111-1111-4111-8111-111111111111' }));

      expect(response.status).toBe(503);
    });
  });

  /**
   * Snapshot revisions — a REOPENED application appends a new confirmed
   * snapshot that supersedes (never replaces) the previous one, carrying an
   * integrity hash of its canonical payload.
   */
  describe('snapshot revisions', () => {
    function revisionHarness(options: { previousSnapshotId: string | null }) {
      mocks.rpc.mockResolvedValue({
        data: [{ snapshot_id: 'snap-new', confirmed_at: '2026-08-26T12:00:00Z' }],
        error: null,
      });
      mocks.from.mockImplementation((table: string) => {
        if (table === 'student_profiles') {
          return updateBuilder({ error: null });
        }
        throw new Error(`unexpected table ${table}`);
      });
      return { previousSnapshotId: options.previousSnapshotId };
    }

    beforeEach(() => {
      mocks.verifiedApplicationId.mockResolvedValue('app-1');
      mocks.loadCandidateReflection.mockResolvedValue({
        reflection: READY_REFLECTION,
        documents: [],
        confirmedAt: null, // reopened → editable again
      });
    });

    it('appends a schema v2 snapshot with payload_hash superseding the application’s previous snapshot', async () => {
      revisionHarness({ previousSnapshotId: 'snap-prev' });

      const { POST } = await import('./route');
      const response = await POST(request({ applicationId: '11111111-1111-4111-8111-111111111111' }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.snapshotId).toBe('snap-new');

      expect(mocks.rpc).toHaveBeenCalledWith(
        'confirm_application_candidate_snapshot',
        expect.objectContaining({ p_application_id: 'app-1', p_payload_hash: expect.stringMatching(/^[0-9a-f]{64}$/) }),
      );
    });

    it("confirming one application does not modify another application's snapshot lineage", async () => {
      revisionHarness({ previousSnapshotId: 'snap-prev-a1' });

      const { POST } = await import('./route');
      await POST(request({ applicationId: '11111111-1111-4111-8111-111111111111' }));

      expect(mocks.rpc).toHaveBeenCalledWith(
        'confirm_application_candidate_snapshot',
        expect.objectContaining({ p_application_id: 'app-1' }),
      );
    });

    it('leaves supersedes_snapshot_id unset on the very first confirmation', async () => {
      revisionHarness({ previousSnapshotId: null });

      const { POST } = await import('./route');
      const response = await POST(request({ applicationId: '11111111-1111-4111-8111-111111111111' }));

      expect(response.status).toBe(200);
      expect(mocks.rpc).toHaveBeenCalledTimes(1);
    });
  });
});
