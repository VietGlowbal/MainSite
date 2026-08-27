'use client';

import { useEffect, useState } from 'react';

type EntitlementsApiResponse = {
  plan?: 'free' | 'plus' | 'team' | 'admin';
  error?: string;
};

let cachedIsPlus: boolean | null = null;
let inFlightRequest: Promise<boolean> | null = null;

export function clearPlusStatusCache(): void {
  cachedIsPlus = null;
  inFlightRequest = null;
}

/**
 * Hook to retrieve user's Plus entitlement status.
 *
 * If `initialPlus` is supplied (e.g. from server component), it initializes
 * immediately without extra network roundtrips.
 * Otherwise, it queries `/api/entitlements/usage` and caches the result across
 * component mounts and tab switches to prevent UI flash/flicker.
 */
export function usePlusStatus(initialPlus?: boolean) {
  const [fetchedIsPlus, setFetchedIsPlus] = useState<boolean>(() => {
    if (initialPlus !== undefined) return initialPlus;
    return cachedIsPlus ?? false;
  });
  const [fetching, setFetching] = useState<boolean>(() => {
    if (initialPlus !== undefined) return false;
    return cachedIsPlus === null;
  });

  const isPlus = initialPlus ?? (cachedIsPlus ?? fetchedIsPlus);
  const loading = initialPlus === undefined && cachedIsPlus === null && fetching;

  useEffect(() => {
    if (initialPlus !== undefined) return;
    if (typeof window === 'undefined') return;

    if (cachedIsPlus !== null) return;

    let isMounted = true;
    async function checkEntitlement(): Promise<boolean> {
      if (cachedIsPlus !== null) return cachedIsPlus;

      if (!inFlightRequest) {
        inFlightRequest = (async () => {
          try {
            const url =
              typeof window !== 'undefined' && window.location?.origin
                ? `${window.location.origin}/api/entitlements/usage`
                : '/api/entitlements/usage';
            const res = await fetch(url);
            if (!res.ok) return false;
            const data: EntitlementsApiResponse = await res.json();
            const active = data.plan === 'plus' || data.plan === 'admin' || data.plan === 'team';
            cachedIsPlus = active;
            return active;
          } catch {
            return false;
          } finally {
            inFlightRequest = null;
          }
        })();
      }

      const active = await inFlightRequest;
      if (isMounted) {
        setFetchedIsPlus(active);
        setFetching(false);
      }
      return active;
    }

    void checkEntitlement();

    return () => {
      isMounted = false;
    };
  }, [initialPlus]);

  return { isPlus, loading };
}
