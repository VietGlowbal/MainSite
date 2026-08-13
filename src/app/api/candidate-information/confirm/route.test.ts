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
  from: vi.fn(),
  snapshotSelect: vi.fn(),
  snapshotInsert: vi.fn(),
  profileUpdate: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  }),
}));

vi.mock('@/features/apply/api', () => ({
  loadCandidateReflection: mocks.loadCandidateReflection,
}));

function selectBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => result,
  };
  return builder;
}

function insertBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    insert: () => builder,
    select: () => builder,
    single: async () => result,
  };
  return builder;
}

function updateBuilder(result: { error: unknown }) {
  const builder: Record<string, unknown> = {
    update: () => builder,
    eq: async () => result,
  };
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});

describe('POST /api/candidate-information/confirm', () => {
  it('rejects an unauthenticated request', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await import('./route');
    const response = await POST();
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
    const response = await POST();
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
    const response = await POST();
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
    const response = await POST();
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
    const response = await POST();
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
    const response = await POST();
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
    const response = await POST();
    expect(response.status).toBe(503);
  });
});
