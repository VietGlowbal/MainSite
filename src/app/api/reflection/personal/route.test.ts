import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));

import { PATCH } from './route';

type UpsertCall = { table: string; value: Record<string, unknown> };
type UpdateCall = { table: string; value: Record<string, unknown> };

function buildSupabase(
  options: {
    authed?: boolean;
    confirmedAt?: string | null;
    applicationOwned?: boolean;
    applicationConfirmedAt?: string | null;
  } = {},
) {
  const upserts: UpsertCall[] = [];
  const updates: UpdateCall[] = [];
  const authed = options.authed ?? true;
  const confirmedAt = options.confirmedAt ?? null;
  const applicationOwned = options.applicationOwned ?? true;
  const applicationConfirmedAt = options.applicationConfirmedAt ?? null;

  function makeBuilder(table: string) {
    let selected = '';
    const builder: Record<string, unknown> = {
      eq: () => builder,
      upsert: async (value: Record<string, unknown>) => {
        upserts.push({ table, value });
        return { error: null };
      },
      update: (value: Record<string, unknown>) => {
        updates.push({ table, value });
        return builder;
      },
      select: (columns?: string) => {
        selected = columns ?? '';
        return builder;
      },
      maybeSingle: async () => {
        if (table === 'student_profiles') return { data: { confirmed_at: confirmedAt }, error: null };
        if (table === 'course_applications') {
          if (selected === 'id') {
            return applicationOwned ? { data: { id: 'app-1' }, error: null } : { data: null, error: null };
          }
          if (selected === 'candidate_confirmed_at') {
            return { data: { candidate_confirmed_at: applicationConfirmedAt }, error: null };
          }
        }
        return { data: null, error: null };
      },
      then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(onFulfilled),
    };
    return builder;
  }

  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: authed ? { id: 'user-1' } : null } }) },
      from: (table: string) => makeBuilder(table),
    },
    upserts,
    updates,
  };
}

function request(body: unknown) {
  return new Request('http://localhost/api/reflection/personal', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  createClientMock.mockReset();
});

describe('PATCH /api/reflection/personal', () => {
  it('rejects an unauthenticated request', async () => {
    const { supabase } = buildSupabase({ authed: false });
    createClientMock.mockResolvedValue(supabase);

    const response = await PATCH(request({ answers: { q1: 'answer' } }));
    expect(response.status).toBe(401);
  });

  it('rejects an invalid payload', async () => {
    const { supabase } = buildSupabase();
    createClientMock.mockResolvedValue(supabase);

    const response = await PATCH(request({ answers: { q1: 123 } }));
    expect(response.status).toBe(400);
  });

  it('saves the answers and stamps personal_reflection_completed_at globally', async () => {
    const { supabase, upserts } = buildSupabase();
    createClientMock.mockResolvedValue(supabase);

    const response = await PATCH(
      request({ answers: { q1: 'Answer one', q2: 'Answer two' } }),
    );

    expect(response.status).toBe(200);
    const profileUpsert = upserts.find((u) => u.table === 'student_profiles');
    expect(profileUpsert?.value.personal_reflection_answers).toEqual({
      q1: 'Answer one',
      q2: 'Answer two',
    });
    expect(profileUpsert?.value.personal_reflection_completed_at).toEqual(expect.any(String));
  });

  it('stamps the per-application review column too when an applicationId is given', async () => {
    const { supabase, updates } = buildSupabase();
    createClientMock.mockResolvedValue(supabase);

    await PATCH(
      request({ answers: { q1: 'a' }, applicationId: '11111111-1111-4111-8111-111111111111' }),
    );

    const stamped = updates.find((u) => 'personal_reflection_reviewed_at' in u.value);
    expect(stamped?.value.personal_reflection_reviewed_at).toEqual(expect.any(String));
  });

  it('rejects an edit once this application is confirmed', async () => {
    const { supabase, upserts } = buildSupabase({
      applicationConfirmedAt: '2026-01-01T00:00:00Z',
    });
    createClientMock.mockResolvedValue(supabase);

    const response = await PATCH(
      request({ answers: { q1: 'a' }, applicationId: '11111111-1111-4111-8111-111111111111' }),
    );

    expect(response.status).toBe(423);
    expect(upserts.filter((u) => u.table === 'student_profiles')).toHaveLength(0);
  });

  it('rejects an edit once the global profile is confirmed (no application context)', async () => {
    const { supabase, upserts } = buildSupabase({ confirmedAt: '2026-01-01T00:00:00Z' });
    createClientMock.mockResolvedValue(supabase);

    const response = await PATCH(request({ answers: { q1: 'a' } }));

    expect(response.status).toBe(423);
    expect(upserts).toHaveLength(0);
  });
});
