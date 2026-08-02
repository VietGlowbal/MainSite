'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Debounced save-on-edit, shared by the target profile, the CV editor and the
 * statement editor.
 *
 * WHY ONE HOOK FOR THREE EDITORS. The three screens save different shapes to
 * different endpoints, but the student-visible behaviour has to be identical:
 * type, pause, see "Saved". Three implementations would drift in the details that
 * matter most — whether a failure is announced, whether a second edit during an
 * in-flight save is lost — and those are the details nobody notices until data
 * goes missing.
 *
 * LAST WRITE WINS, AND THE LAST WRITE IS THE ONE THAT MATTERS. `save` is called
 * with the current value on every keystroke. Only the trailing call inside the
 * debounce window reaches the network, and if an edit arrives while a request is
 * in flight the response from the older request is ignored — otherwise the
 * version it returns would clobber the newer one and the next save would be
 * rejected as stale.
 *
 * FAILURE IS STICKY. `error` does not clear itself on a timer. A save that failed
 * means the student's work is only in the browser, and a status line that quietly
 * returns to "Saved" after four seconds is worse than no status line at all.
 */

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** How long after the last keystroke the save fires. */
const DEBOUNCE_MS = 1200;

/** How long "Saved" stays up before the line goes quiet again. */
const SETTLE_MS = 2400;

export type AutosaveResult = { version?: number | undefined };

export function useAutosave<T>(
  /**
   * Performs the write. Resolves with the server's new version when it has one,
   * throws to signal failure — the hook does not inspect a response body.
   */
  persist: (value: T) => Promise<AutosaveResult | void>,
  options?: { initialVersion?: number | undefined; debounceMs?: number | undefined },
) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [version, setVersion] = useState<number | undefined>(options?.initialVersion);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Monotonic id of the newest save intent; stale responses compare against it. */
  const generation = useRef(0);
  /** The value the last attempt carried, so `retry` does not need it passed again. */
  const pending = useRef<T | null>(null);
  const mounted = useRef(true);

  // `persist` is usually an inline closure, so it is a new function identity on
  // every render. Held in a ref rather than in the dependency list so `save`
  // stays stable and does not restart the debounce timer on each keystroke.
  //
  // Synced in an effect rather than assigned during render: writing to a ref
  // while rendering is unsafe under concurrent rendering, where a render can be
  // thrown away. The debounce means no save can fire before the effect has run.
  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (debounce.current) clearTimeout(debounce.current);
      if (settle.current) clearTimeout(settle.current);
    };
  }, []);

  const run = useCallback(async (value: T) => {
    const mine = ++generation.current;
    pending.current = value;
    setStatus('saving');

    try {
      const result = await persistRef.current(value);
      // A newer edit already started saving. Its response is the truth; this
      // one's version is behind and applying it would make the next save stale.
      if (!mounted.current || mine !== generation.current) return;

      if (result && typeof result.version === 'number') setVersion(result.version);
      pending.current = null;
      setStatus('saved');

      if (settle.current) clearTimeout(settle.current);
      settle.current = setTimeout(() => {
        if (mounted.current) setStatus('idle');
      }, SETTLE_MS);
    } catch {
      if (!mounted.current || mine !== generation.current) return;
      // Deliberately not cleared on a timer, and `pending` is deliberately kept:
      // `retry` needs the value, and the student needs to keep seeing that it
      // did not save.
      setStatus('error');
    }
  }, []);

  const save = useCallback(
    (value: T) => {
      if (debounce.current) clearTimeout(debounce.current);
      if (settle.current) clearTimeout(settle.current);
      debounce.current = setTimeout(() => {
        void run(value);
      }, options?.debounceMs ?? DEBOUNCE_MS);
    },
    [run, options?.debounceMs],
  );

  /** Write immediately — for an explicit Save, or before navigating away. */
  const flush = useCallback(
    (value: T) => {
      if (debounce.current) clearTimeout(debounce.current);
      return run(value);
    },
    [run],
  );

  const retry = useCallback(() => {
    if (pending.current === null) return;
    void run(pending.current);
  }, [run]);

  return { status, version, save, flush, retry };
}
