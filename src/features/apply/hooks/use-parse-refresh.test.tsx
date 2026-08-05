import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useParseRefresh } from './use-parse-refresh';

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

const pending = [{ id: 'app-1', parseStatus: 'pending' }];

describe('useParseRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.refresh.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('polls status without refreshing while parsing is still pending', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'app-1', parseStatus: 'pending', progressPercentage: 10 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useParseRefresh(pending));

    await act(() => vi.advanceTimersByTimeAsync(4_000));

    expect(fetchMock).toHaveBeenCalledWith('/api/applications/app-1/parse-status');
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('refreshes exactly once when a parse completes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'app-1', parseStatus: 'complete', progressPercentage: 100 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useParseRefresh(pending));

    await act(() => vi.advanceTimersByTimeAsync(12_000));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('does not poll while the tab is hidden', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useParseRefresh(pending));

    await act(() => vi.advanceTimersByTimeAsync(8_000));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('stops polling after an authorization failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useParseRefresh(pending));

    await act(() => vi.advanceTimersByTimeAsync(12_000));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('stops polling at the four-minute ceiling', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'app-1', parseStatus: 'pending', progressPercentage: 10 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useParseRefresh(pending));

    await act(() => vi.advanceTimersByTimeAsync(260_000));
    const callsAtCeiling = fetchMock.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(60_000));

    expect(callsAtCeiling).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(callsAtCeiling);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
