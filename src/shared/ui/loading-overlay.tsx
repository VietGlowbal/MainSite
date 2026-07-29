'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { GlobeLoader } from './globe-loader';

/* ─────────────────────────────────────────────────────────────────────────
   The loading store

   A module singleton read through useSyncExternalStore, not a context
   provider. Three reasons, all of which bit an earlier draft:

     1. A caller can start the loader from anywhere — an event handler, a
        `finally` block, a module outside the React tree — without the call
        site having to sit under a provider. Half the loading states in this
        app live in files that would otherwise need one threaded to them.
     2. Starting the loader does not re-render the subtree that started it.
        With a context provider, `useLoadingIndicator` in a form would
        re-render that form on every begin/end.
     3. Concurrent loaders compose. Two saves in flight hold two handles, and
        the overlay only lifts when both let go — which a boolean prop or a
        single `setState` cannot express.
   ───────────────────────────────────────────────────────────────────────── */

type Snapshot = {
  readonly active: boolean;
  /** The most recently begun task's label, if it named one. */
  readonly label: string | undefined;
};

const IDLE: Snapshot = { active: false, label: undefined };

/** Insertion-ordered: the newest entry wins the label. */
const tasks = new Map<number, string | undefined>();
const listeners = new Set<() => void>();

let nextId = 1;
let snapshot: Snapshot = IDLE;

function recompute() {
  if (tasks.size === 0) {
    snapshot = IDLE;
  } else {
    // The newest task is the one the user just triggered, so it is the one
    // whose label describes what they are waiting on.
    let label: string | undefined;
    for (const value of tasks.values()) label = value ?? label;
    snapshot = { active: true, label };
  }
  for (const listener of listeners) listener();
}

/**
 * Register a task. Returns its `end` — idempotent, so calling it twice (a
 * `finally` block plus an unmount cleanup, say) does not release someone
 * else's handle when ids are eventually reused.
 */
export function beginLoading(label?: string): () => void {
  const id = nextId++;
  tasks.set(id, label);
  recompute();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    tasks.delete(id);
    recompute();
  };
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

const getSnapshot = () => snapshot;
// The server never has a task in flight, and returning a fresh object here
// would make useSyncExternalStore loop forever.
const getServerSnapshot = () => IDLE;

/** Subscribe to the loading store. Mostly for the overlay itself. */
export function useLoadingSnapshot(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Imperative handle, for async work that is not already mirrored into state:
 *
 *   const begin = useBeginLoading();
 *   const done = begin('Sending your application');
 *   try { await submit(); } finally { done(); }
 *
 * Always release in `finally`. A handle leaked on the error path leaves the
 * overlay up forever — there is no timeout on this one, deliberately, because
 * a timeout would hide the bug rather than the overlay.
 */
export function useBeginLoading(): (label?: string) => () => void {
  return useCallback((label?: string) => beginLoading(label), []);
}

/**
 * Declarative form, for the common case where a component already tracks its
 * own boolean:
 *
 *   const [saving, setSaving] = useState(false);
 *   useLoadingIndicator(saving, t('Saving your profile'));
 *
 * Holds a handle for exactly as long as `active` is true, and releases it on
 * unmount — so a component that navigates away mid-request cannot strand the
 * overlay.
 */
export function useLoadingIndicator(active: boolean, label?: string): void {
  // The label is read once, when the task begins. Keeping it in a ref means a
  // label that changes identity every render (an interpolated `t(...)` call,
  // for instance) does not tear the task down and start a new one.
  //
  // Synced in its own effect rather than assigned during render: a ref written
  // mid-render is torn under concurrent rendering, and this effect is declared
  // first, so the ref is already current when the effect below reads it.
  const labelRef = useRef(label);
  useEffect(() => {
    labelRef.current = label;
  }, [label]);

  useEffect(() => {
    if (!active) return undefined;
    return beginLoading(labelRef.current);
  }, [active]);
}

/* ─────────────────────────────────────────────────────────────────────────
   The overlay
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Wait this long before showing anything. Most requests in this app finish
 * inside it, and a card that flashes for 80ms reads as a glitch rather than as
 * feedback.
 */
const SHOW_DELAY_MS = 180;

/**
 * Once shown, stay up at least this long. Without it, a request that resolves
 * at 200ms puts the card on screen for 20ms — strictly worse than never having
 * shown it.
 */
const MIN_VISIBLE_MS = 650;

/**
 * GlobalLoadingOverlay — mounted once, in the root layout.
 *
 * Floats a GlobeLoader over the page whenever anything holds a handle on the
 * loading store, behind a light scrim that also swallows clicks. Blocking
 * input is intended: the overlay is up during saves and submissions, and the
 * double-submit it prevents is a worse outcome than the half-second of
 * unresponsiveness it costs.
 *
 * `z-index` sits above `Modal` (z-50) on purpose — a dialog's own save button
 * is one of the most common things to trigger this.
 */
export function GlobalLoadingOverlay() {
  const { active, label } = useLoadingSnapshot();
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (active && !visible) {
      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, SHOW_DELAY_MS);
      return () => clearTimeout(timer);
    }

    if (!active && visible) {
      const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));
      const timer = setTimeout(() => setVisible(false), remaining);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [active, visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim-soft p-gb-xl backdrop-blur-[1px]"
      // The card inside is the live region; announcing the scrim as well would
      // double up. Pointer events are still captured — `inert` would let clicks
      // through, which is the opposite of what this is for.
      aria-hidden="false"
    >
      <div className="animate-gb-loader-in motion-reduce:animate-none">
        <GlobeLoader {...(label === undefined ? {} : { label })} />
      </div>
    </div>
  );
}
