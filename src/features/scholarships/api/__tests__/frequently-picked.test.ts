import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  in: vi.fn(),
  cacheKeyParts: [] as string[],
  cacheOptions: null as { revalidate?: number; tags?: string[] } | null,
}));

vi.mock('next/cache', () => ({
  unstable_cache: (
    loader: (...args: unknown[]) => unknown,
    keyParts: string[],
    options: { revalidate?: number; tags?: string[] },
  ) => {
    mocks.cacheKeyParts = keyParts;
    mocks.cacheOptions = options;
    return loader;
  },
}));
vi.mock('@/server/db/admin', () => ({ createAdminClient: mocks.createAdminClient }));

import {
  FREQUENTLY_PICKED_CACHE_TAG,
  FREQUENTLY_PICKED_CACHE_TTL_SECONDS,
  loadFrequentlyPicked,
  loadFrequentlyPickedUncached,
} from '../frequently-picked';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAdminClient.mockReturnValue({ from: mocks.from });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ in: mocks.in });
});

describe('frequently-picked server provider', () => {
  it('uses one service-role batch query and returns aggregate-only data', async () => {
    mocks.in.mockResolvedValue({
      data: [
        { scholarship_id: 7, user_id: 'user-1' },
        { scholarship_id: 7, user_id: 'user-1' },
        { scholarship_id: 7, user_id: 'user-2' },
        { scholarship_id: 8, user_id: 'user-1' },
      ],
      error: null,
    });

    const result = await loadFrequentlyPicked({
      scholarshipIds: [8, 7, 7],
      policy: { version: 'test-frequently-picked-v1', threshold: 2 },
    });

    expect(mocks.createAdminClient).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledWith('user_scholarships');
    expect(mocks.select).toHaveBeenCalledOnce();
    expect(mocks.select).toHaveBeenCalledWith('scholarship_id, user_id');
    expect(mocks.in).toHaveBeenCalledOnce();
    expect(mocks.in).toHaveBeenCalledWith('scholarship_id', [7, 8]);
    expect(result).toEqual({
      '7': { count: 2, threshold: 2, isFrequentlyPicked: true },
      '8': { count: 1, threshold: 2, isFrequentlyPicked: false },
    });
    expect(JSON.stringify(result)).not.toContain('user-1');
    expect(JSON.stringify(result)).not.toContain('user-2');
  });

  it('uses a separate short-lived aggregate cache contract', async () => {
    mocks.in.mockResolvedValue({ data: [], error: null });

    await loadFrequentlyPicked({ scholarshipIds: [7] });

    expect(mocks.cacheKeyParts).toEqual([
      'frequently-picked-aggregate',
      'frequently-picked-v1',
    ]);
    expect(mocks.cacheOptions).toEqual({
      revalidate: FREQUENTLY_PICKED_CACHE_TTL_SECONDS,
      tags: [FREQUENTLY_PICKED_CACHE_TAG],
    });
    expect(FREQUENTLY_PICKED_CACHE_TTL_SECONDS).toBe(60);
  });

  it('returns no query and no user data for an empty candidate set', async () => {
    await expect(loadFrequentlyPicked({ scholarshipIds: [] })).resolves.toEqual({});
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('supports save and remove changes through a fresh uncached read', async () => {
    let rows = [{ scholarshipId: 7, userId: 'user-1' }];
    const readRows = vi.fn(async () => rows);
    const input = {
      scholarshipIds: [7],
      policy: { version: 'test-frequently-picked-v1', threshold: 2 },
      readRows,
    };

    await expect(loadFrequentlyPickedUncached(input)).resolves.toEqual({
      '7': { count: 1, threshold: 2, isFrequentlyPicked: false },
    });

    rows = [...rows, { scholarshipId: 7, userId: 'user-2' }];
    await expect(loadFrequentlyPickedUncached(input)).resolves.toEqual({
      '7': { count: 2, threshold: 2, isFrequentlyPicked: true },
    });

    rows = rows.filter((row) => row.userId !== 'user-1');
    await expect(loadFrequentlyPickedUncached(input)).resolves.toEqual({
      '7': { count: 1, threshold: 2, isFrequentlyPicked: false },
    });
    expect(readRows).toHaveBeenCalledTimes(3);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('fails closed on a database query error', async () => {
    mocks.in.mockResolvedValue({ data: null, error: { message: 'RLS/query failure' } });

    await expect(loadFrequentlyPicked({ scholarshipIds: [7] })).rejects.toThrow(
      /RLS\/query failure/,
    );
  });
});
