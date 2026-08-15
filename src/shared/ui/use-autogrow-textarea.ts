'use client';

import { useLayoutEffect, useRef } from 'react';

/**
 * Grows a `<textarea>` to fit its content instead of showing a fixed-height
 * "wall of blank space" or forcing a scrollbar for a short answer. Re-runs
 * whenever `value` changes — covers both typing and a programmatic value
 * swap (e.g. switching between reflection dimensions, each with its own
 * saved answer length).
 *
 * `maxHeight` caps growth so one very long answer cannot push the rest of a
 * dialog off-screen; the textarea scrolls internally past that point.
 */
export function useAutoGrowTextarea<T extends HTMLTextAreaElement>(
  value: string,
  options?: { maxHeight?: number },
) {
  const ref = useRef<T | null>(null);
  const maxHeight = options?.maxHeight ?? 320;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value, maxHeight]);

  return ref;
}
