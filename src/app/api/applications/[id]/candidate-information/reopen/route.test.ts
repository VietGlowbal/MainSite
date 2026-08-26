import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * POST /api/applications/[id]/candidate-information/reopen
 *
 * Reopening Candidate Information for ONE application clears ONLY that
 * application's edit lock — never another application's, never any stored
 * snapshot or report version.
 */

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  }),
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

function updateBuilder(
  result: { error: unknown },
  calls: { values?: Record<string, unknown>[]; eqCalls?: unknown[][] } = {},
) {
  const builder: Record<string, unknown> = {
    update: (value: Record<string, unknown>) => {
      (calls.values ??= []).push(value);
      return builder;
    },
    // Chainable like the real PostgREST builder; every filter pair recorded.
    eq: (...args: unknown[]) => {
      (calls.eqCalls ??= []).push(args);
      return builder;
    },
    // Awaitable terminal.
    then(onFulfilled: (value: unknown) => unknown) {
      return Promise.resolve(result).then(onFulfilled);
    },
  };
  return builder;
}

function request() {
  return new Request('http://localhost/api/applications/app-1/candidate-information/reopen', {
    method: 'POST',
  });
}

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
});

describe('POST /api/applications/[id]/candidate-information/reopen', () => {
  it('rejects an unauthenticated request', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { POST } = await import('./route');
    const response = await POST(request(), routeContext('app-1'));
    expect(response.status).toBe(401);
  });

  it('returns 404 and never writes when the application is not owned by this user (application B cannot reopen application A)', async () => {
    const tablesTouched: string[] = [];
    mocks.from.mockImplementation((table: string) => {
      tablesTouched.push(table);
      return selectBuilder({ data: null, error: null }); // not owned / not found
    });

    const { POST } = await import('./route');
    const response = await POST(request(), routeContext('app-other'));
    expect(response.status).toBe(404);

    // Only the ownership read happened — no write of any kind.
    expect(tablesTouched).toEqual(['course_applications']);
  });

  it("clears ONLY this application's candidate_confirmed_at", async () => {
    const tablesTouched: string[] = [];
    const updateCalls: { values?: Record<string, unknown>[]; eqCalls?: unknown[][] } = {};
    // Deterministic dispatch: 1st course_applications call = ownership SELECT,
    // 2nd = the unlock UPDATE.
    let courseAppCalls = 0;
    mocks.from.mockImplementation((table: string) => {
      tablesTouched.push(table);
      if (table === 'course_applications') {
        courseAppCalls += 1;
        return courseAppCalls === 1
          ? selectBuilder({ data: { id: 'app-1' }, error: null })
          : updateBuilder({ error: null }, updateCalls);
      }
      throw new Error(`unexpected table ${table}`);
    });

    const { POST } = await import('./route');
    const response = await POST(request(), routeContext('app-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('reopened');

    // Only the lock flag is cleared — review timestamps are RETAINED so the
    // student can edit just the section they need to.
    expect(updateCalls.values?.[0]).toEqual({ candidate_confirmed_at: null });
    expect(updateCalls.eqCalls).toContainEqual(['id', 'app-1']);
    expect(updateCalls.eqCalls).toContainEqual(['user_id', 'user-1']);
    expect(courseAppCalls).toBe(2);
    expect(tablesTouched.every((t) => t === 'course_applications')).toBe(true);
  });

  it('never deletes old snapshots or reports while reopening', async () => {
    let courseAppCalls = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table === 'course_applications') {
        courseAppCalls += 1;
        return courseAppCalls === 1
          ? selectBuilder({ data: { id: 'app-1' }, error: null })
          : updateBuilder({ error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const { POST } = await import('./route');
    const response = await POST(request(), routeContext('app-1'));

    expect(response.status).toBe(200);
    // Snapshots and report versions were never touched, let alone deleted.
    expect(mocks.from).not.toHaveBeenCalledWith('confirmed_candidate_snapshots');
    expect(mocks.from).not.toHaveBeenCalledWith('student_personal_report_versions');
    expect(courseAppCalls).toBe(2);
  });

  it('returns 500 when the unlock update fails', async () => {
    let courseAppCalls = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table === 'course_applications') {
        courseAppCalls += 1;
        return courseAppCalls === 1
          ? selectBuilder({ data: { id: 'app-1' }, error: null })
          : updateBuilder({ error: { code: '42501', message: 'row-level security violation' } });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const { POST } = await import('./route');
    const response = await POST(request(), routeContext('app-1'));
    expect(response.status).toBe(500);
  });
});
