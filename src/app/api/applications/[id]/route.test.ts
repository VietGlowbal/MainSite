import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));

import { DELETE } from './route';

/**
 * `DELETE` relies on the `course_applications` RLS owner policy plus the
 * `.eq('user_id', user.id)` in the query itself for defence in depth. These
 * tests assert the query is scoped that way and that the three outcomes
 * (deleted / not found or not owned / unauthenticated) map to the right
 * status codes — see the handler's own comment for why no child-row cleanup
 * is needed (everything is `ON DELETE CASCADE` except `personal_statements`,
 * which is `SET NULL`).
 */

function buildSupabase(options: { authed?: boolean; deletedRow?: { id: string } | null; error?: unknown }) {
  const authed = options.authed ?? true;
  const calls: { table: string; op: string; filters: Record<string, unknown> }[] = [];

  function makeBuilder(table: string) {
    const filters: Record<string, unknown> = {};
    const builder: Record<string, unknown> = {
      delete: () => {
        calls.push({ table, op: 'delete', filters });
        return builder;
      },
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      },
      select: () => builder,
      maybeSingle: async () => ({ data: options.deletedRow ?? null, error: options.error ?? null }),
    };
    return builder;
  }

  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: authed ? { id: 'user-1' } : null }, error: null }) },
      from: (table: string) => makeBuilder(table),
    },
    calls,
  };
}

function request() {
  return new Request('http://localhost/api/applications/app-1', { method: 'DELETE' });
}

beforeEach(() => {
  createClientMock.mockReset();
});

describe('DELETE /api/applications/[id]', () => {
  it('rejects an unauthenticated request', async () => {
    const { supabase } = buildSupabase({ authed: false });
    createClientMock.mockResolvedValue(supabase);

    const response = await DELETE(request(), { params: Promise.resolve({ id: 'app-1' }) });
    expect(response.status).toBe(401);
  });

  it('deletes the application, scoped to the caller', async () => {
    const { supabase, calls } = buildSupabase({ deletedRow: { id: 'app-1' } });
    createClientMock.mockResolvedValue(supabase);

    const response = await DELETE(request(), { params: Promise.resolve({ id: 'app-1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    const deleteCall = calls.find((c) => c.table === 'course_applications' && c.op === 'delete');
    expect(deleteCall?.filters).toEqual({ id: 'app-1', user_id: 'user-1' });
  });

  it('404s when the row does not exist or is not owned by the caller', async () => {
    const { supabase } = buildSupabase({ deletedRow: null });
    createClientMock.mockResolvedValue(supabase);

    const response = await DELETE(request(), { params: Promise.resolve({ id: 'someone-elses-app' }) });
    expect(response.status).toBe(404);
  });

  it('500s on a database error', async () => {
    const { supabase } = buildSupabase({ deletedRow: null, error: { message: 'boom' } });
    createClientMock.mockResolvedValue(supabase);

    const response = await DELETE(request(), { params: Promise.resolve({ id: 'app-1' }) });
    expect(response.status).toBe(500);
  });
});
