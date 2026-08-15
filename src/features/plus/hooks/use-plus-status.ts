'use client';

import { useEffect, useState } from 'react';

type EntitlementsApiResponse = {
  plan?: 'free' | 'plus' | 'team' | 'admin';
  error?: string;
};

/**
 * Hook to retrieve user's Plus entitlement status.
 *
 * If `initialPlus` is supplied (e.g. from server component), it initializes
 * immediately without extra network roundtrips.
 * Otherwise, it queries `/api/entitlements/usage`.
 */
export function usePlusStatus(initialPlus?: boolean) {
  const [fetchedIsPlus, setFetchedIsPlus] = useState(false);
  const [fetching, setFetching] = useState(initialPlus === undefined);
  const isPlus = initialPlus ?? fetchedIsPlus;
  const loading = initialPlus === undefined && fetching;

  useEffect(() => {
    if (initialPlus !== undefined) return;

    if (typeof window === 'undefined') return;

    let isMounted = true;
    async function checkEntitlement() {
      try {
        const url = typeof window !== 'undefined' && window.location?.origin
          ? `${window.location.origin}/api/entitlements/usage`
          : '/api/entitlements/usage';
        const res = await fetch(url);
        if (!res.ok) {
          if (isMounted) setFetching(false);
          return;
        }
        const data: EntitlementsApiResponse = await res.json();
        if (isMounted) {
          const active = data.plan === 'plus' || data.plan === 'admin' || data.plan === 'team';
          setFetchedIsPlus(active);
          setFetching(false);
        }
      } catch {
        if (isMounted) setFetching(false);
      }
    }

    checkEntitlement();

    return () => {
      isMounted = false;
    };
  }, [initialPlus]);

  return { isPlus, loading };
}
