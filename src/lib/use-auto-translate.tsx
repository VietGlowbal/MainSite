'use client';

import { createElement, useEffect, useState, type ReactNode } from 'react';
import { useLanguage } from '@/lib/i18n';

/**
 * Machine-translation for *dynamic* content (DB text, AI article bodies) that
 * can't live in the static UI dictionary. Translates via /api/translate when
 * Vietnamese is active, caching results in memory + localStorage so a string
 * is only ever sent to the translation service once.
 */

// Keep in sync with the key in dom-translate.tsx (they share this cache).
// Bumped to v2 to discard pre-existing rough/PII-tainted client caches.
const LS_KEY = 'glowbal-mt-cache-vi-v2';
const memory = new Map<string, string>();
let loaded = false;

function loadCache() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, string>)) memory.set(k, v);
  } catch {
    /* ignore corrupt cache */
  }
}

function persist() {
  try {
    // DomTranslator shares this storage key. Merge with whatever is already
    // there before writing so the two writers never clobber each other's
    // entries (ours win on conflict — they're the same en→vi mapping anyway).
    const raw = localStorage.getItem(LS_KEY);
    const existing = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    localStorage.setItem(LS_KEY, JSON.stringify({ ...existing, ...Object.fromEntries(memory) }));
  } catch {
    /* storage full/unavailable — keep in-memory only */
  }
}

async function translate(text: string): Promise<string> {
  loadCache();
  const cached = memory.get(text);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: [text], target: 'vi' }),
    });
    if (!res.ok) return text;
    const data = (await res.json()) as { translations?: string[] };
    const out = data.translations?.[0] ?? text;
    memory.set(text, out);
    persist();
    return out;
  } catch {
    return text;
  }
}

/**
 * Returns the Vietnamese translation of `text` when the site language is
 * Vietnamese, otherwise the original text. While the translation is in
 * flight it returns the English source, so content never disappears.
 */
export function useAutoTranslate(text: string | null | undefined): string {
  const { lang } = useLanguage();
  const source = text ?? '';
  const [value, setValue] = useState(source);

  useEffect(() => {
    let cancelled = false;
    if (lang !== 'vi' || !source.trim()) {
      queueMicrotask(() => {
        if (!cancelled) setValue(source);
      });
      return () => { cancelled = true; };
    }
    loadCache();
    const cached = memory.get(source);
    if (cached !== undefined) {
      queueMicrotask(() => {
        if (!cancelled) setValue(cached);
      });
      return () => { cancelled = true; };
    }
    queueMicrotask(() => {
      if (!cancelled) setValue(source); // show English until the translation resolves
    });
    translate(source).then((out) => {
      if (!cancelled) setValue(out);
    });
    return () => {
      cancelled = true;
    };
  }, [lang, source]);

  return value;
}

/**
 * Renders auto-translated dynamic text. Defaults to a <span>; pass `as` to use
 * another element (e.g. "p", "h1").
 */
export function AutoTranslate({
  text,
  as = 'span',
  className,
}: {
  text: string | null | undefined;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
}): ReactNode {
  const translated = useAutoTranslate(text);
  return createElement(as, { className }, translated);
}
