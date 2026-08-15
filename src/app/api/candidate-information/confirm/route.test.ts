import { beforeEach, describe, expect, it, vi } from 'vitest';

const READY_REFLECTION = {
  majors: ['computer-science'],
  countries: ['GB'],
  intendedLevel: 'Bachelor’s Degree' as const,
  intake: { type: 'undecided' as const },
  achievements: [],
  activities: [],
};

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  loadCandidateReflection: vi.fn(),
  verifiedApplicationId: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  }),
}));

vi.mock('@/features/apply/api', () => ({
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

  it('rejects confirmation while a required question is unanswered', async () => {
    mocks.loadCandidateReflection.mockResolvedValue({
      reflection: { ...READY_REFLECTION, majors: [] },
      documents: [],
      confirmedAt: null,
    });

    const { POST } = await import('./route');
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toBe('NOT_READY');
    expect(body.blockingIssues).toEqual([
      { key: 'majors', message: 'Choose at least one subject you’re interested in.' },
    ]);
  });

  it('rejects confirmation while an extracted achievement still needs review', async () => {
    mocks.loadCandidateReflection.mockResolvedValue({
      reflection: {
        ...READY_REFLECTION,
        achievements: [{ category: 'academic_award', title: 'Demo', reviewStatus: 'needs_review' }],
      },
      documents: [],
      confirmedAt: null,
    });

    const { POST } = await import('./route');
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.achievementsNeedingReview).toBe(1);
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

  /**
   * Per-application coverage — the fix for "a new application can't be
   * confirmed, it always uses the old one" (docs/known-issues.md).
   */
  describe('with a verified applicationId', () => {
    beforeEach(() => {
      mocks.verifiedApplicationId.mockResolvedValue('app-1');
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
      const response = await POST(request({ applicationId: 'app-1' }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.snapshotId).toBe('snap-app-1');
      expect(eqCalls).toContainEqual(['application_id', 'app-1']);
    });

    it('tags the new snapshot with application_id and locks course_applications.candidate_confirmed_at, not just the global profile', async () => {
      mocks.loadCandidateReflection.mockResolvedValue({
        reflection: READY_REFLECTION,
        documents: [],
        confirmedAt: null,
      });
      const insertedRows: Record<string, unknown>[] = [];
      const courseApplicationUpdate: { value?: Record<string, unknown>; eq?: unknown[] } = {};
      mocks.from.mockImplementation((table: string) => {
        if (table === 'confirmed_candidate_snapshots') {
          return insertBuilder(
            { data: { id: 'snap-4', confirmed_at: '2026-08-13T12:00:00Z' }, error: null },
            insertedRows,
          );
        }
        if (table === 'course_applications') {
          return updateBuilder({ error: null }, courseApplicationUpdate);
        }
        if (table === 'student_profiles') {
          return updateBuilder({ error: null });
        }
        throw new Error(`unexpected table ${table}`);
      });

      const { POST } = await import('./route');
      const response = await POST(request({ applicationId: 'app-1' }));

      expect(response.status).toBe(200);
      expect(insertedRows[0]?.application_id).toBe('app-1');
      expect(courseApplicationUpdate.value?.candidate_confirmed_at).toEqual(expect.any(String));
      expect(courseApplicationUpdate.eq).toEqual(['id', 'app-1']);
    });

    it('still succeeds, tolerant of application_id not being migrated on the snapshot table yet', async () => {
      mocks.loadCandidateReflection.mockResolvedValue({
        reflection: READY_REFLECTION,
        documents: [],
        confirmedAt: null,
      });
      let snapshotInsertAttempt = 0;
      mocks.from.mockImplementation((table: string) => {
        if (table === 'confirmed_candidate_snapshots') {
          snapshotInsertAttempt += 1;
          if (snapshotInsertAttempt === 1) {
            return insertBuilder({
              data: null,
              error: { code: '42703', message: 'column "application_id" does not exist' },
            });
          }
          return insertBuilder({ data: { id: 'snap-5', confirmed_at: '2026-08-13T12:00:00Z' }, error: null });
        }
        if (table === 'course_applications' || table === 'student_profiles') {
          return updateBuilder({ error: null });
        }
        throw new Error(`unexpected table ${table}`);
      });

      const { POST } = await import('./route');
      const response = await POST(request({ applicationId: 'app-1' }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.snapshotId).toBe('snap-5');
      expect(snapshotInsertAttempt).toBe(2);
    });
  });
});
