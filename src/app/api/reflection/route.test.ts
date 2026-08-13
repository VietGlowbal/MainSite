import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));

import { PATCH } from './route';

/**
 * `personal_summary_completed_at`/`achievements_completed_at` are what
 * `fetchOnboardingState` reads as `personalSummaryComplete`/
 * `achievementsComplete` (see docs/known-issues.md §5g) — neither was ever
 * written by this route until now, so a student could submit either
 * reflection step any number of times and never actually complete it. These
 * tests assert the upsert that sets each flag actually happens, not just
 * that the row-specific insert/delete calls do.
 */

type UpsertCall = { table: string; value: Record<string, unknown> };

function buildSupabase(options: { authed?: boolean; confirmedAt?: string | null } = {}) {
  const upserts: UpsertCall[] = [];
  const authed = options.authed ?? true;
  const confirmedAt = options.confirmedAt ?? null;

  function makeBuilder(table: string) {
    const builder: Record<string, unknown> = {
      delete: () => builder,
      eq: () => builder,
      insert: async () => ({ error: null }),
      upsert: async (value: Record<string, unknown>) => {
        upserts.push({ table, value });
        return { error: null };
      },
      select: () => builder,
      // Only `student_profiles.select('confirmed_at').eq(...).maybeSingle()`
      // (the lock check) calls this; every other read path in the route
      // uses `then`/`insert`/`upsert`, which do not go through it.
      maybeSingle: async () =>
        table === 'student_profiles' ? { data: { confirmed_at: confirmedAt }, error: null } : { data: null, error: null },
      then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(onFulfilled),
    };
    return builder;
  }

  return {
    supabase: {
      auth: {
        getUser: async () => ({
          data: { user: authed ? { id: 'user-1' } : null },
        }),
      },
      from: (table: string) => makeBuilder(table),
    },
    upserts,
  };
}

function request(body: unknown) {
  return new Request('http://localhost/api/reflection', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  createClientMock.mockReset();
});

describe('PATCH /api/reflection', () => {
  it('rejects an unauthenticated request', async () => {
    const { supabase } = buildSupabase({ authed: false });
    createClientMock.mockResolvedValue(supabase);

    const response = await PATCH(request({ about: {} }));
    expect(response.status).toBe(401);
  });

  it('marks personal_summary_completed_at when the about step is saved', async () => {
    const { supabase, upserts } = buildSupabase();
    createClientMock.mockResolvedValue(supabase);

    const response = await PATCH(request({ about: { majors: [], countries: [] } }));

    expect(response.status).toBe(200);
    const profileUpsert = upserts.find((u) => u.table === 'student_profiles');
    expect(profileUpsert?.value.personal_summary_completed_at).toEqual(expect.any(String));
  });

  it('marks achievements_completed_at when achievements/activities are saved, even empty', async () => {
    const { supabase, upserts } = buildSupabase();
    createClientMock.mockResolvedValue(supabase);

    const response = await PATCH(request({ achievements: [], activities: [] }));

    expect(response.status).toBe(200);
    const profileUpsert = upserts.find(
      (u) => u.table === 'student_profiles' && 'achievements_completed_at' in u.value,
    );
    expect(profileUpsert?.value.achievements_completed_at).toEqual(expect.any(String));
  });

  it('does not touch achievements_completed_at when only the about step is saved', async () => {
    const { supabase, upserts } = buildSupabase();
    createClientMock.mockResolvedValue(supabase);

    await PATCH(request({ about: {} }));

    const achievementsUpsert = upserts.find(
      (u) => u.table === 'student_profiles' && 'achievements_completed_at' in u.value,
    );
    expect(achievementsUpsert).toBeUndefined();
  });

  it('rejects an invalid payload', async () => {
    const { supabase } = buildSupabase();
    createClientMock.mockResolvedValue(supabase);

    const response = await PATCH(request({ achievements: [{ title: '' }] }));
    expect(response.status).toBe(400);
  });

  it('rejects an edit once the profile has been confirmed', async () => {
    const { supabase, upserts } = buildSupabase({ confirmedAt: '2026-08-13T10:00:00Z' });
    createClientMock.mockResolvedValue(supabase);

    const response = await PATCH(request({ about: { majors: [], countries: [] } }));
    const body = await response.json();

    expect(response.status).toBe(423);
    expect(body.error).toBe('PROFILE_LOCKED');
    expect(upserts).toHaveLength(0);
  });

  it('allows an edit when confirmed_at is not set', async () => {
    const { supabase } = buildSupabase({ confirmedAt: null });
    createClientMock.mockResolvedValue(supabase);

    const response = await PATCH(request({ about: { majors: [], countries: [] } }));
    expect(response.status).toBe(200);
  });
});
