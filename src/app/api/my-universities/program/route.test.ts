import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateClient } = vi.hoisted(() => ({ mockCreateClient: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }));

import { PATCH } from './route';

function request(body: unknown) {
  return new Request('http://localhost/api/my-universities/program', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function client(result: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const chain = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.eq = chain;
  builder.select = chain;
  builder.maybeSingle = vi.fn(async () => result);
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: vi.fn(() => builder),
    builder,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('PATCH /api/my-universities/program', () => {
  it('returns the authoritative saved row after an owner-scoped update', async () => {
    const current = client({
      data: { id: 7, program: 'Computer Science', program_url: 'https://example.edu/cs' },
      error: null,
    });
    mockCreateClient.mockResolvedValue(current);

    const response = await PATCH(
      request({ savedId: 7, program: 'Computer Science', programUrl: 'https://example.edu/cs' }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      saved: { id: 7, program: 'Computer Science', program_url: 'https://example.edu/cs' },
    });
    expect(current.builder.update).toHaveBeenCalledWith({
      program: 'Computer Science',
      program_url: 'https://example.edu/cs',
    });
    expect(current.builder.eq).toHaveBeenNthCalledWith(1, 'id', 7);
    expect(current.builder.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-1');
  });

  it('does not treat an RLS-filtered zero-row update as success', async () => {
    const current = client({ data: null, error: null });
    mockCreateClient.mockResolvedValue(current);

    const response = await PATCH(
      request({ savedId: 7, program: 'Computer Science', programUrl: null }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ errorCode: 'NOT_SAVED' });
  });

  it('rejects unauthenticated and malformed requests', async () => {
    const current = client({ data: null, error: null });
    current.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null } as never);
    mockCreateClient.mockResolvedValue(current);
    expect((await PATCH(request({ savedId: 7, program: 'CS', programUrl: null }))).status).toBe(401);

    current.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null });
    expect((await PATCH(request({ savedId: 7, program: '', programUrl: 'javascript:alert(1)' }))).status).toBe(400);
  });
});
