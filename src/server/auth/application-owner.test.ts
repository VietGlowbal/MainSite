import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The guard every Feature 2 endpoint sits behind, so its failure modes are
 * tested directly rather than through fourteen routes.
 *
 * `createClient` is mocked at the module boundary because the real one reads
 * `cookies()` from next/headers, which only exists inside a request scope.
 */
const createClient = vi.fn();

vi.mock('@/server/db/server', () => ({
  createClient: () => createClient(),
}));

const OWNER = '11111111-1111-4111-8111-111111111111';
const APP_ID = '22222222-2222-4222-8222-222222222222';

/** A Supabase double whose query chain records what it was asked for. */
function supabaseDouble({
  user,
  row,
  error,
}: {
  user: { id: string } | null;
  row?: Record<string, unknown> | null;
  error?: { message: string } | null;
}) {
  const filters: Record<string, unknown> = {};
  let selected = '';

  const builder = {
    select(cols: string) {
      selected = cols;
      return builder;
    },
    eq(col: string, value: unknown) {
      filters[col] = value;
      return builder;
    },
    single() {
      return Promise.resolve({ data: row ?? null, error: error ?? null });
    },
  };

  return {
    auth: { getUser: () => Promise.resolve({ data: { user } }) },
    from: () => builder,
    // Test-only accessors.
    _filters: filters,
    get _selected() {
      return selected;
    },
  };
}

async function subject() {
  const mod = await import('./application-owner');
  return mod;
}

beforeEach(() => {
  vi.resetModules();
  createClient.mockReset();
});

describe('requireApplicationOwner', () => {
  it('returns 401 when there is no session', async () => {
    createClient.mockResolvedValue(supabaseDouble({ user: null }));
    const { requireApplicationOwner } = await subject();

    const result = await requireApplicationOwner(APP_ID);

    expect('response' in result).toBe(true);
    if (!('response' in result)) return;
    expect(result.response.status).toBe(401);
  });

  it('returns 404 when the application is not owned by the caller', async () => {
    // The ownership predicate means someone else's row simply does not match,
    // so PostgREST returns no rows rather than a permission error.
    createClient.mockResolvedValue(
      supabaseDouble({ user: { id: OWNER }, row: null, error: { message: 'no rows' } }),
    );
    const { requireApplicationOwner } = await subject();

    const result = await requireApplicationOwner(APP_ID);

    expect('response' in result).toBe(true);
    if (!('response' in result)) return;
    expect(result.response.status).toBe(404);
  });

  it('does not reveal whether a non-owned application exists', async () => {
    createClient.mockResolvedValue(
      supabaseDouble({ user: { id: OWNER }, row: null, error: { message: 'no rows' } }),
    );
    const { requireApplicationOwner } = await subject();

    const result = await requireApplicationOwner(APP_ID);
    if (!('response' in result)) throw new Error('expected a response');

    // Same status and same body as a genuinely missing row. A 403 here would
    // confirm the id belongs to another student.
    expect(result.response.status).toBe(404);
    await expect(result.response.json()).resolves.toEqual({ error: 'Application not found' });
  });

  it('returns 404 for a malformed id without querying', async () => {
    // Postgres would raise 22P02 on a non-uuid, surfacing as a 500.
    const client = supabaseDouble({ user: { id: OWNER }, row: null });
    createClient.mockResolvedValue(client);
    const { requireApplicationOwner } = await subject();

    const result = await requireApplicationOwner('not-a-uuid');

    expect('response' in result).toBe(true);
    if (!('response' in result)) return;
    expect(result.response.status).toBe(404);
    expect(client._filters).toEqual({});
  });

  it('resolves the application, user and client for the owner', async () => {
    const row = { id: APP_ID, user_id: OWNER, university_name: 'Oxford', courses: { id: 'c1' } };
    createClient.mockResolvedValue(supabaseDouble({ user: { id: OWNER }, row }));
    const { requireApplicationOwner } = await subject();

    const result = await requireApplicationOwner(APP_ID);

    expect('response' in result).toBe(false);
    if ('response' in result) return;
    expect(result.user.id).toBe(OWNER);
    expect(result.application.university_name).toBe('Oxford');
    expect(result.supabase).toBeDefined();
  });

  it('constrains the query by BOTH id and user_id', async () => {
    // The regression this guards: a copied auth check that keeps the id filter
    // and loses the ownership one still returns a row, and still typechecks.
    const client = supabaseDouble({
      user: { id: OWNER },
      row: { id: APP_ID, user_id: OWNER },
    });
    createClient.mockResolvedValue(client);
    const { requireApplicationOwner } = await subject();

    await requireApplicationOwner(APP_ID);

    expect(client._filters).toEqual({ id: APP_ID, user_id: OWNER });
    expect(client._selected).toContain('courses');
  });
});

describe('isUuid', () => {
  it('accepts a canonical uuid in either case', async () => {
    const { isUuid } = await subject();
    expect(isUuid(APP_ID)).toBe(true);
    expect(isUuid(APP_ID.toUpperCase())).toBe(true);
  });

  it('rejects near-misses', async () => {
    const { isUuid } = await subject();
    for (const bad of [
      '',
      'not-a-uuid',
      APP_ID.slice(0, -1),
      `${APP_ID}0`,
      APP_ID.replace(/-/g, ''),
      `  ${APP_ID}  `,
      'zzzzzzzz-2222-4222-8222-222222222222',
    ]) {
      expect(isUuid(bad), bad).toBe(false);
    }
  });
});
