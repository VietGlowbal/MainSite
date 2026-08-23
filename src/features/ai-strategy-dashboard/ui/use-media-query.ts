'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Reactive CSS-media-query state for React rendering decisions.
 *
 * WHY THIS EXISTS. The Planner's Part-5 mobile model renders a structurally
 * different surface on narrow screens (one active status column with a
 * switcher; a day agenda under the calendar) rather than hiding desktop DOM
 * with breakpoints. Hiding would keep both trees interactive-for-tests but
 * leave duplicate tab stops and two sources of truth for "which column is
 * open"; a media query lets each viewport render exactly one tree while both
 * keep reading the same shared controller.
 *
 * SSR-SAFE. On the server there is no `window`, so `getServerSnapshot` always
 * claims the DESKTOP shape (`initialState` default true); React hydrates
 * against that snapshot and then re-renders to the real value — an ordinary
 * post-hydration update, never a mismatch. Components must therefore treat
 * the desktop tree as the hydration default — never render something
 * desktop-only that would break hydration when flipped, and never gate
 * content behind mobile-only.
 *
 * `useSyncExternalStore`, not setState-in-an-effect: matchMedia is an external
 * store, so React subscribes and reads snapshots directly. That keeps the
 * update outside the effect-setState pattern the hooks lint forbids and makes
 * the read tear-free under concurrent rendering.
 *
 * TESTABILITY. jsdom has no real `matchMedia`; `src/__tests__/setup.ts`
 * installs a stub whose `matches` tests can override per query. Every snapshot
 * read goes through `window.matchMedia(query).matches` afresh, so a test that
 * flips the stub's result before a render is observed on the next render.
 */
export function useMediaQuery(query: string, initialState = true): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onStoreChange);
      return () => list.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => initialState, [initialState]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
