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
 *
 * The `applicationId`-scoped tests guard the later fix: confirming one
 * application must not lock editing for a different, unconfirmed
 * application — see docs/known-issues.md for the incident.
 */

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
      delete: () => builder,
      eq: () => builder,
      insert: async () => ({ error: null }),
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
      auth: {
        getUser: async () => ({
          data: { user: authed ? { id: 'user-1' } : null },
        }),
      },
      from: (table: string) => makeBuilder(table),
    },
    upserts,
    updates,
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

  it('locks per-application: rejects an edit once THIS application has been confirmed', async () => {
    const { supabase, upserts } = buildSupabase({ applicationConfirmedAt: '2026-08-13T10:00:00Z' });
    createClientMock.mockResolvedValue(supabase);

    const response = await PATCH(
      request({ about: { majors: [], countries: [] }, applicationId: '11111111-1111-4111-8111-111111111111' }),
    );
    const body = await response.json();

    expect(response.status).toBe(423);
    expect(body.error).toBe('PROFILE_LOCKED');
    expect(upserts).toHaveLength(0);
  });

  it('allows an edit for a NEW, unconfirmed application even though the student has confirmed a different application before (global confirmed_at set)', async () => {
    const { supabase } = buildSupabase({
      confirmedAt: '2026-08-01T00:00:00Z',
      applicationConfirmedAt: null,
    });
    createClientMock.mockResolvedValue(supabase);

    const response = await PATCH(
      request({ about: { majors: [], countries: [] }, applicationId: '11111111-1111-4111-8111-111111111111' }),
    );

    expect(response.status).toBe(200);
  });

  it('stamps course_applications.personal_summary_reviewed_at for the given application', async () => {
    const { supabase, updates } = buildSupabase();
    createClientMock.mockResolvedValue(supabase);

    const response = await PATCH(
      request({ about: { majors: [], countries: [] }, applicationId: '11111111-1111-4111-8111-111111111111' }),
    );

    expect(response.status).toBe(200);
    const stamp = updates.find(
      (u) => u.table === 'course_applications' && 'personal_summary_reviewed_at' in u.value,
    );
    expect(stamp?.value.personal_summary_reviewed_at).toEqual(expect.any(String));
  });

  it('stamps course_applications.achievements_reviewed_at for the given application', async () => {
    const { supabase, updates } = buildSupabase();
    createClientMock.mockResolvedValue(supabase);

    const response = await PATCH(
      request({ achievements: [], activities: [], applicationId: '11111111-1111-4111-8111-111111111111' }),
    );

    expect(response.status).toBe(200);
    const stamp = updates.find(
      (u) => u.table === 'course_applications' && 'achievements_reviewed_at' in u.value,
    );
    expect(stamp?.value.achievements_reviewed_at).toEqual(expect.any(String));
  });

  it('ignores an applicationId that does not belong to this user, falling back to the global lock', async () => {
    const { supabase, updates } = buildSupabase({
      confirmedAt: '2026-08-13T10:00:00Z',
      applicationOwned: false,
    });
    createClientMock.mockResolvedValue(supabase);

    const response = await PATCH(
      request({ about: { majors: [], countries: [] }, applicationId: '22222222-2222-4222-8222-222222222222' }),
    );

    expect(response.status).toBe(423);
    expect(updates).toHaveLength(0);
  });
});
