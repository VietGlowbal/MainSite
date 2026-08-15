import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type UniversityRow = {
  id: number;
  name: string;
  image_url: string | null;
  logo_url: string | null;
};

const mocks = vi.hoisted(() => ({
  authorized: true,
  rows: [] as UniversityRow[],
  orders: [] as Array<[string, Record<string, unknown>]>,
  updates: [] as Array<{ id: number; payload: Record<string, unknown> }>,
  resolveUniversityImagery: vi.fn(),
  persistUniversityLogo: vi.fn(),
  revalidateUniversities: vi.fn(),
}));

function universityQuery() {
  const query = {
    or: vi.fn(() => query),
    order: vi.fn((column: string, options: Record<string, unknown>) => {
      mocks.orders.push([column, options]);
      return query;
    }),
    limit: vi.fn(async () => ({ data: mocks.rows, error: null })),
  };
  return query;
}

const from = vi.fn(() => ({
  select: vi.fn(() => universityQuery()),
  update: (payload: Record<string, unknown>) => ({
    eq: vi.fn(async (_column: string, id: number) => {
      mocks.updates.push({ id, payload });
      return { error: null };
    }),
  }),
}));

vi.mock('@/lib/cron-auth', () => ({
  isAuthorizedCron: () => mocks.authorized,
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from }),
}));
vi.mock('@/lib/wiki-images', () => ({
  resolveUniversityImagery: mocks.resolveUniversityImagery,
}));
vi.mock('@/server/cache', () => ({
  revalidateUniversities: mocks.revalidateUniversities,
}));
vi.mock('@/server/university-images/logo-storage', () => ({
  persistUniversityLogo: mocks.persistUniversityLogo,
}));

const { POST } = await import('./route');

function makeRows(count: number): UniversityRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `University ${index + 1}`,
    image_url: `https://assets.example/campus-${index + 1}.webp`,
    logo_url: null,
  }));
}

function resolvedFor(rows: UniversityRow[]) {
  return new Map(
    rows.map((row) => [
      row.name.replaceAll(' ', '_'),
      { campus: null, logo: `https://source.example/logo-${row.id}.png` },
    ]),
  );
}

async function call() {
  const response = await POST(
    new NextRequest('http://localhost/api/cron/university-images'),
  );
  return response.json();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorized = true;
  mocks.rows = makeRows(8);
  mocks.orders.length = 0;
  mocks.updates.length = 0;
  mocks.resolveUniversityImagery.mockResolvedValue(resolvedFor(mocks.rows));
  mocks.persistUniversityLogo.mockImplementation(
    async (_admin, university: { id: number }) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return `https://storage.example/logo-${university.id}.webp`;
    },
  );
});

afterEach(() => vi.restoreAllMocks());

describe('university-images cron budget', () => {
  it('persists logos with at most four rows in flight and stores their durable URLs', async () => {
    let active = 0;
    let maxActive = 0;
    mocks.persistUniversityLogo.mockImplementation(
      async (_admin, university: { id: number }) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return `https://storage.example/logo-${university.id}.webp`;
      },
    );

    const body = await call();

    expect(maxActive).toBe(4);
    expect(mocks.persistUniversityLogo).toHaveBeenCalledTimes(8);
    expect(mocks.persistUniversityLogo).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.stringContaining('https://source.example/'),
      expect.objectContaining({
        deadlineMs: expect.any(Number),
        requestTimeoutMs: 6_000,
      }),
    );
    expect(mocks.updates).toHaveLength(8);
    expect(mocks.updates[0]?.payload).toMatchObject({
      logo_url: 'https://storage.example/logo-1.webp',
      images_resolved_at: expect.any(String),
    });
    expect(body).toMatchObject({
      ok: true,
      scanned: 8,
      processed: 8,
      updated: 8,
      stillMissing: 0,
      deferred: 0,
    });
    expect(mocks.revalidateUniversities).toHaveBeenCalledOnce();
  });

  it('caps imagery resolution separately and rotates oldest attempts before rank', async () => {
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(new AbortController().signal);

    await call();

    expect(timeout).toHaveBeenCalledWith(20_000);
    expect(mocks.resolveUniversityImagery).toHaveBeenCalledWith(
      expect.any(Array),
      { signal: expect.any(AbortSignal) },
    );
    expect(mocks.orders).toEqual([
      ['images_resolved_at', { ascending: true, nullsFirst: true }],
      ['qs_rank', { ascending: true, nullsFirst: false }],
    ]);
  });

  it('defers resolver entries that were never started instead of marking them attempted', async () => {
    mocks.resolveUniversityImagery.mockResolvedValue(resolvedFor(mocks.rows.slice(0, 4)));

    const body = await call();

    expect(mocks.persistUniversityLogo).toHaveBeenCalledTimes(4);
    expect(mocks.updates).toHaveLength(4);
    expect(body).toMatchObject({
      scanned: 8,
      processed: 4,
      updated: 4,
      deferred: 4,
    });
  });

  it('records a failed logo attempt so the row rotates behind unattempted rows', async () => {
    mocks.rows = makeRows(1);
    mocks.resolveUniversityImagery.mockResolvedValue(resolvedFor(mocks.rows));
    mocks.persistUniversityLogo.mockResolvedValue(null);

    const body = await call();

    expect(mocks.updates).toHaveLength(1);
    expect(mocks.updates[0]?.payload).toMatchObject({
      logo_url: null,
      images_resolved_at: expect.any(String),
    });
    expect(body).toMatchObject({ updated: 0, stillMissing: 1, deferred: 0 });
    expect(mocks.revalidateUniversities).not.toHaveBeenCalled();
  });
});
