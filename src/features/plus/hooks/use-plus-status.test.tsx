import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePlusStatus, clearPlusStatusCache } from './use-plus-status';

describe('usePlusStatus', () => {
  beforeEach(() => {
    clearPlusStatusCache();
    vi.restoreAllMocks();
  });

  it('initializes immediately when initialPlus is provided', () => {
    const { result } = renderHook(() => usePlusStatus(true));
    expect(result.current.isPlus).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('fetches entitlement status from API and caches it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ plan: 'plus' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePlusStatus());
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.isPlus).toBe(true);
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second hook call should use cache immediately without loading state
    const { result: secondResult } = renderHook(() => usePlusStatus());
    expect(secondResult.current.isPlus).toBe(true);
    expect(secondResult.current.loading).toBe(false);
  });
});
