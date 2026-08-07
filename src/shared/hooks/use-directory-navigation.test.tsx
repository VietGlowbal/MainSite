import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDirectoryNavigation } from './use-directory-navigation';

type Payload = { value: string; canonicalSearch: string };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('useDirectoryNavigation', () => {
  it('keeps the current data visible until the latest request resolves', async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useDirectoryNavigation<Payload>({
        pathname: '/items',
        endpoint: '/api/items',
        initialData: { value: 'page-1', canonicalSearch: '' },
      }),
    );

    act(() => result.current.navigate('/items?page=2'));
    expect(result.current.data.value).toBe('page-1');
    expect(result.current.busy).toBe(true);

    act(() => result.current.navigate('/items?page=3'));
    second.resolve(
      new Response(JSON.stringify({ value: 'page-3', canonicalSearch: 'page=3' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await waitFor(() => expect(result.current.data.value).toBe('page-3'));
    first.resolve(
      new Response(JSON.stringify({ value: 'page-2', canonicalSearch: 'page=2' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await act(async () => Promise.resolve());

    expect(result.current.data.value).toBe('page-3');
    expect(window.location.search).toBe('?page=3');
  });

  it('restores cached data on popstate without another request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ value: 'page-2', canonicalSearch: 'page=2' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useDirectoryNavigation<Payload>({
        pathname: '/items',
        endpoint: '/api/items',
        initialData: { value: 'page-1', canonicalSearch: '' },
      }),
    );

    act(() => result.current.navigate('/items?page=2'));
    await waitFor(() => expect(result.current.data.value).toBe('page-2'));

    act(() => {
      window.history.replaceState(null, '', '/items');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await waitFor(() => expect(result.current.data.value).toBe('page-1'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps prior data and restores the last successful URL on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const { result } = renderHook(() =>
      useDirectoryNavigation<Payload>({
        pathname: '/items',
        endpoint: '/api/items',
        initialData: { value: 'page-1', canonicalSearch: '' },
      }),
    );

    act(() => result.current.navigate('/items?page=2'));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.data.value).toBe('page-1');
    expect(window.location.pathname).toBe('/items');
    expect(window.location.search).toBe('');
  });
});
