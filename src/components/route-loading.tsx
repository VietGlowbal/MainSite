'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
// Deep import, not the `@/shared/ui` barrel. This module needs one function
// from one file, and the barrel would pull every primitive in the design system
// (TopNav, Modal, Pagination, ...) into the graph of a component that renders
// nothing — which shows up as a bundle cost on every page and, more visibly, as
// a coverage cliff, since the ratchet in vitest.config.ts measures files the
// tests actually load.
import { beginLoading } from '@/shared/ui/loading-overlay';

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

/**
 * The part of the URL whose change means the router has work to do.
 *
 * Deliberately EXCLUDES the hash. A fragment change is the browser scrolling
 * within a document it already has; nothing is fetched and nothing is worth
 * showing a loader for.
 */
function navKey(): string {
  return `${window.location.pathname}${window.location.search}`;
}

export function RouteLoading() {
  const pathname = usePathname();
  // The open handle, if a navigation is in flight.
  const endRef = useRef<(() => void) | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /**
   * The last URL we consider "settled", hash excluded.
   *
   * `popstate` fires AFTER the address bar has already updated, so a handler
   * cannot read where the user came from — it has to have been remembered. This
   * is that memory, and it is what lets a fragment jump be told apart from a
   * real history traversal.
   */
  const lastKeyRef = useRef<string>('');

  /** Close any open handle and stop the timers watching for it. */
  const end = useCallback(() => {
    if (safetyRef.current) {
      clearTimeout(safetyRef.current);
      safetyRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (typeof window !== 'undefined') lastKeyRef.current = navKey();
    endRef.current?.();
    endRef.current = null;
  }, []);

  useEffect(() => {
    lastKeyRef.current = navKey();

    /**
     * @param pollFrom The URL we are leaving, when there is one to poll away
     *   from. `null` disables the poll — see onPopState for the only caller that
     *   passes it, and why polling is meaningless there.
     */
    function start(pollFrom: string | null) {
      // A second click while one is already pending replaces the first, so the
      // safety timer is always measured from the most recent intent.
      end();
      endRef.current = beginLoading();
      safetyRef.current = setTimeout(end, SAFETY_MS);

      if (pollFrom == null) return;
      pollRef.current = setInterval(() => {
        if (navKey() !== pollFrom) end();
      }, URL_POLL_MS);
    }

    function onClick(event: MouseEvent) {
      if (!isPlainLeftClick(event)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a');
      if (!anchor || !navigatesInApp(anchor)) return;
      // The URL has not changed yet, so this really is where we are leaving from.
      start(navKey());
    }

    /**
     * Back/forward. The router re-renders the same way it does for a click —
     * but ONLY when the document actually changes.
     *
     * ⚠️ Chrome fires `popstate` for a same-document fragment navigation too, so
     * every in-page anchor click used to land here and open a handle that
     * nothing could close: `usePathname()` does not change on a hash change, and
     * the poll's "from" was captured after the URL had already updated, so it
     * compared the new URL against itself forever. The loader therefore sat
     * there for the full SAFETY_MS — a flat 10 seconds of fake loading on every
     * jump-to-section link, which is how it was reported.
     *
     * Comparing against the remembered key is the fix: same pathname+search
     * means the hash moved and there is nothing to wait for.
     */
    function onPopState() {
      const to = navKey();
      const from = lastKeyRef.current;
      lastKeyRef.current = to;

      // Hash-only: the browser scrolls, nothing is fetched.
      if (to === from) return;

      /*
       * A traversal that keeps the same pathname and only moves the query string
       * gets no loader either. Those are served from the router's client cache
       * and are imperceptible — and crucially they are UNENDABLE here: popstate
       * runs after the address bar has updated, so there is no URL left to poll
       * away from, and `usePathname()` does not change, so the commit effect
       * below never fires. Showing a loader we cannot clear would mean a flat
       * SAFETY_MS hang on Back out of every filter and page change.
       */
      if (new URL(to, window.location.origin).pathname === new URL(from || '/', window.location.origin).pathname) {
        return;
      }

      // Pathname really changed: the commit effect below will end this. No poll
      // for the same reason as above — the URL is already at its destination.
      start(null);
    }

    // Capture phase: a handler on the link itself may call stopPropagation,
    // and a navigation that happens anyway should still show the loader.
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState);

    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState);
      end();
    };
    // `end` is stable (useCallback with no deps); everything else is a ref.
  }, [end]);

  // The route committed — whatever we were waiting for has arrived. Runs on
  // mount too, which is harmless (there is no handle open yet).
  useEffect(() => {
    end();
  }, [pathname, end]);

  return null;
}
