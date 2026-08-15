'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Retry fragment scrolling after an App Router destination has mounted.
 *
 * Next.js performs its built-in hash lookup in the layout router. During a
 * cross-page transition to a streamed route, that lookup can run before the
 * destination's client content exists; Next then falls back to the page root
 * and does not retry. A passive effect runs after that navigation work and can
 * scroll the now-mounted target reliably.
 */
export function useHashScrollTarget<T extends HTMLElement>(hash: `#${string}`): RefObject<T | null> {
  const targetRef = useRef<T>(null);

  useEffect(() => {
    function scrollIfTargeted() {
      if (window.location.hash !== hash) return;
      targetRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }

    // Handles cross-page navigation and a direct request to /apply#saved.
    scrollIfTargeted();
    // Retains native same-page fragment behavior even if the router changes
    // how it handles hash-only links in a future Next.js release.
    window.addEventListener('hashchange', scrollIfTargeted);
    return () => window.removeEventListener('hashchange', scrollIfTargeted);
  }, [hash]);

  return targetRef;
}
