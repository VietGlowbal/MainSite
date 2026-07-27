'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { beginLoading } from '@/shared/ui';

/**
 * RouteLoading — puts the globe loader up during client-side navigation.
 *
 * WHY THIS EXISTS AT ALL. The App Router has no global "a navigation is in
 * flight" signal. `loading.tsx` only covers the wait for a segment that has to
 * be fetched, and `useLinkStatus()` is per-`<Link>` — using it would mean
 * touching every link in the app and would still miss `router.push()`. So this
 * infers the transition the way progress bars have always done it: start on
 * the click, stop when the route actually changes.
 *
 * TRADE-OFF, stated plainly. This is inference, not instrumentation. It can be
 * wrong in one direction — a click that turns out not to navigate (a `<Link>`
 * whose default is prevented by a handler further up, a route that redirects
 * back to itself) leaves a handle open. That is what SAFETY_MS is for: the
 * loader clears itself rather than wedging the page. It cannot be wrong in the
 * other direction in a way that matters, because a navigation nobody clicked
 * for is a navigation nobody is waiting on.
 */

/** Nothing in this app legitimately takes longer than this to navigate. */
const SAFETY_MS = 10_000;

/**
 * How often to check whether the URL has changed, while — and only while — a
 * navigation is pending.
 *
 * `usePathname()` is the precise signal, but it does not fire when only the
 * query string changes, and this app navigates that way constantly (every
 * paginated grid, every filter chip). The alternative, `useSearchParams()`,
 * would drag the root layout out of static rendering and needs its own
 * Suspense boundary. A 100ms poll that exists for at most the length of one
 * navigation is the cheaper trade.
 */
const URL_POLL_MS = 100;

/** Modified clicks are the browser's ("open in new tab"), not the router's. */
function isPlainLeftClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  );
}

/**
 * Whether clicking this anchor will hand control to the App Router — as
 * opposed to leaving the site, opening a tab, downloading, or jumping to an
 * anchor on the page we are already on.
 */
function navigatesInApp(anchor: HTMLAnchorElement): boolean {
  // `download`, `target="_blank"`, and explicit opt-outs are the browser's job.
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;
  if (anchor.dataset['noLoader'] !== undefined) return false;

  // `href` on the element resolves relative URLs against the document, which
  // is exactly what is needed to compare origins.
  const href = anchor.href;
  if (!href) return false;

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }

  if (url.origin !== window.location.origin) return false;
  // mailto:, tel:, and friends never reach here (different origin), but an
  // explicit check keeps the intent readable.
  if (!url.protocol.startsWith('http')) return false;

  // Same page, different hash — the browser scrolls, the router does not fetch.
  const current = window.location;
  if (url.pathname === current.pathname && url.search === current.search) return false;

  return true;
}

export function RouteLoading() {
  const pathname = usePathname();
  // The open handle, if a navigation is in flight.
  const endRef = useRef<(() => void) | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function end() {
      if (safetyRef.current) {
        clearTimeout(safetyRef.current);
        safetyRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      endRef.current?.();
      endRef.current = null;
    }

    function start() {
      // A second click while one is already pending replaces the first, so the
      // safety timer is always measured from the most recent intent.
      end();
      endRef.current = beginLoading();
      safetyRef.current = setTimeout(end, SAFETY_MS);

      const from = window.location.href;
      pollRef.current = setInterval(() => {
        if (window.location.href !== from) end();
      }, URL_POLL_MS);
    }

    function onClick(event: MouseEvent) {
      if (!isPlainLeftClick(event)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a');
      if (!anchor || !navigatesInApp(anchor)) return;
      start();
    }

    // Capture phase: a handler on the link itself may call stopPropagation,
    // and a navigation that happens anyway should still show the loader.
    document.addEventListener('click', onClick, true);
    // Back/forward. The router re-renders the same way it does for a click.
    window.addEventListener('popstate', start);

    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', start);
      end();
    };
    // Mount-only: `start`/`end` close over refs, not over props.
  }, []);

  // The route committed — whatever we were waiting for has arrived. Runs on
  // mount too, which is harmless (there is no handle open yet).
  useEffect(() => {
    if (safetyRef.current) {
      clearTimeout(safetyRef.current);
      safetyRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    endRef.current?.();
    endRef.current = null;
  }, [pathname]);

  return null;
}
