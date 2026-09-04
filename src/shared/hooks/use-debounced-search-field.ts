'use client';

import { useCallback, useEffect, useRef, type ChangeEvent, type RefObject } from 'react';

/**
 * A search box whose text belongs to the reader, not to the server.
 *
 * Both directories (/universities, /scholarships) search as you type: the field
 * debounces, navigates, and the response re-renders the page with the query the
 * server actually answered. The trap is that last step. Re-seeding the box from
 * the response looks harmless -- the value is usually the one just sent -- but
 * the response lands a debounce plus a round trip AFTER the keystroke that
 * triggered it, and by then the reader has typed more. Those extra characters
 * were overwritten by the older server value, which reads exactly like the box
 * jumping back to the previous search. Both pages re-seeded by remounting (a
 * changing `key`, or `defaultValue`), so the caret and the focus went with it
 * and everything typed afterwards landed nowhere. A slow typist hit this on
 * every character, because every pause longer than the debounce starts another
 * request.
 *
 * The fix is not a longer debounce -- that only widens the window the reader has
 * to type into. It is to make the two directions of sync asymmetric:
 *
 *   - reader -> server: debounced, and the value we send is remembered;
 *   - server -> reader: applied ONLY when the incoming value is not an echo of
 *     what we last sent, i.e. only for changes the reader did not cause --
 *     Back/Forward, "clear filters", a deep link.
 *
 * So the response to "har" cannot touch a box that has since become "harv",
 * while Back to `?q=oxford` still refills it.
 *
 * The input is deliberately UNCONTROLLED, with that rare adoption written
 * straight to the DOM node. It makes the guarantee structural rather than
 * conventional -- a re-render has no `value` to push -- and keeps typing off the
 * render path entirely, which matters when the box sits inside a directory page
 * that would otherwise re-render its whole result grid on every keystroke.
 */

/** Quiet period before a typed query is sent. Coalesces a burst of keystrokes. */
export const SEARCH_DEBOUNCE_MS = 300;

type Options = {
  /** The value the URL and the latest response reflect for this field. */
  value: string;
  /** Runs once typing settles, with the normalised draft. Never with an echo. */
  onCommit: (value: string) => void;
  /** Quiet period in ms. Defaults to {@link SEARCH_DEBOUNCE_MS}. */
  delay?: number;
  /** Draft -> the form sent to the server. Defaults to trimming. */
  normalize?: (draft: string) => string;
};

export type DebouncedSearchField = {
  /**
   * Spread onto the `<input>`. Do NOT add `value` or `key` alongside it: either
   * one hands ownership of the text back to the server and reinstates the bug
   * this hook exists to fix.
   */
  inputProps: {
    ref: RefObject<HTMLInputElement | null>;
    defaultValue: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  };
  /**
   * Cancel the pending commit and hand back the value the caller is about to
   * send in its place -- for a submit button, or a sibling filter that navigates
   * on the reader's behalf. Without it those keystrokes would either be dropped
   * or fire a second, conflicting navigation once the debounce elapsed.
   */
  takePending: () => string;
};

const trimmed = (draft: string) => draft.trim();

export function useDebouncedSearchField({
  value,
  onCommit,
  delay = SEARCH_DEBOUNCE_MS,
  normalize = trimmed,
}: Options): DebouncedSearchField {
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** The draft, mirrored so `takePending` still works while the box is unmounted. */
  const draftRef = useRef(value);
  /** The last value this field asked the server for -- how an echo is spotted. */
  const sentRef = useRef(value);
  const timerRef = useRef<number | null>(null);

  // Reached through refs so a pending timer runs the newest closures: `onCommit`
  // typically captures sibling filter state, and firing a 300ms-old copy of it
  // is the same stale-snapshot bug wearing a different hat.
  const onCommitRef = useRef(onCommit);
  const normalizeRef = useRef(normalize);
  useEffect(() => {
    onCommitRef.current = onCommit;
    normalizeRef.current = normalize;
  });

  const cancel = useCallback(() => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => {
    if (value === sentRef.current) return; // our own echo -- leave the box alone
    sentRef.current = value;
    draftRef.current = value;
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
    // A timer left pending by the keystrokes we just discarded is harmless: it
    // re-reads draftRef, finds the adopted value, and matches sentRef.
  }, [value]);

  useEffect(() => cancel, [cancel]);

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      draftRef.current = event.target.value;
      cancel();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const settled = normalizeRef.current(draftRef.current);
        if (settled === sentRef.current) return; // only whitespace moved
        sentRef.current = settled;
        onCommitRef.current(settled);
      }, delay);
    },
    [cancel, delay],
  );

  const takePending = useCallback(() => {
    cancel();
    const settled = normalizeRef.current(inputRef.current?.value ?? draftRef.current);
    draftRef.current = settled;
    sentRef.current = settled;
    return settled;
  }, [cancel]);

  return {
    inputProps: { ref: inputRef, defaultValue: value, onChange },
    takePending,
  };
}
