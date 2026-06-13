'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/lib/i18n';
import { translations as dictionary } from '@/lib/i18n-dictionary';

/**
 * Whole-page auto-translation.
 *
 * Walks the visible text inside the main content area and machine-translates
 * it to Vietnamese via /api/translate (OpenAI-backed), caching every result so
 * a string is only ever translated once. This gives broad coverage across
 * pages that haven't been hand-wrapped with t() yet.
 *
 * Design notes / safety:
 * - Only text nodes are touched — input values, placeholders and attributes
 *   are left alone.
 * - <script>, <style>, <code>, <pre>, <textarea> and anything inside a
 *   [data-no-auto-translate] region are skipped. The nav and the news/guide
 *   pages opt out that way because they already translate via the dictionary.
 * - Original English is remembered per node, so toggling back to English
 *   restores it instantly.
 * - A MutationObserver re-translates content that React re-renders or that
 *   arrives from client navigation; our own writes are suppressed to avoid
 *   loops.
 * - Pure numbers/symbols (no letters) are ignored.
 */

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'SVG', 'PATH', 'OPTION', 'SELECT',
]);

// Routes that render private user data — names, emails, application details,
// uploaded document names, transcript/passport info, admin records, etc.
// Whole-page machine translation is DISABLED here so that no PII is ever
// forwarded to the translation service (/api/translate → OpenAI). These pages
// still localise their chrome/labels via the static dictionary (t()) and any
// explicit <AutoTranslate> the developer opted in to — and personal data like
// a user's name or email should never be translated anyway.
const PII_ROUTE_PREFIXES = [
  '/profile',
  '/apply',
  '/dashboard',
  '/admin',
  '/onboarding',
  '/my-universities',
  '/auth',
];

function isPiiRoute(pathname: string): boolean {
  return PII_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
const LS_KEY = 'glowbal-mt-cache-vi';
const HAS_LETTER = /\p{L}/u;

// english(core) -> vietnamese. Seeded with the static dictionary so common
// strings are instant and free (no API round-trip).
const cache = new Map<string, string>(Object.entries(dictionary));
const original = new WeakMap<Text, string>();
let cacheLoaded = false;

function loadCache() {
  if (cacheLoaded || typeof window === 'undefined') return;
  cacheLoaded = true;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, string>)) cache.set(k, v);
  } catch {
    /* ignore */
  }
}

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(cache)));
  } catch {
    /* ignore */
  }
}

function eligible(node: Text): boolean {
  const value = node.nodeValue;
  if (!value || !HAS_LETTER.test(value)) return false;
  const parent = node.parentElement;
  if (!parent) return false;
  if (SKIP_TAGS.has(parent.tagName)) return false;
  if (parent.isContentEditable) return false;
  if (parent.closest('[data-no-auto-translate]')) return false;
  return true;
}

function splitWhitespace(raw: string): [string, string, string] {
  const m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return m ? [m[1], m[2], m[3]] : ['', raw, ''];
}

async function translateBatch(cores: string[]): Promise<void> {
  const CHUNK = 40;
  for (let i = 0; i < cores.length; i += CHUNK) {
    const chunk = cores.slice(i, i + CHUNK);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: chunk, target: 'vi' }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { translations?: string[] };
      const out = data.translations ?? [];
      chunk.forEach((core, k) => {
        const vi = out[k];
        if (typeof vi === 'string' && vi.trim()) cache.set(core, vi);
      });
    } catch {
      /* leave English */
    }
  }
  persist();
}

export function DomTranslator() {
  const { lang } = useLanguage();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Never machine-translate pages that render private user data.
    if (isPiiRoute(pathname)) return;
    loadCache();
    const root = document.querySelector('main.glowbal-main-content');
    if (!root) return;

    let suppress = false;
    let frame = 0;

    const collect = (): Text[] => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (eligible(n as Text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
      });
      const nodes: Text[] = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
      return nodes;
    };

    const write = (node: Text, value: string) => {
      if (node.nodeValue !== value) {
        node.nodeValue = value;
      }
    };

    const apply = async () => {
      const nodes = collect();
      const missing = new Set<string>();

      suppress = true;
      for (const node of nodes) {
        if (!original.has(node)) original.set(node, node.nodeValue ?? '');
        const raw = original.get(node)!;
        const [lead, core, trail] = splitWhitespace(raw);
        if (!core) continue;

        if (lang === 'en') {
          write(node, raw);
          continue;
        }
        const vi = cache.get(core);
        if (vi) write(node, `${lead}${vi}${trail}`);
        else missing.add(core);
      }
      // release the suppression after this paint so our writes don't re-trigger
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        suppress = false;
      });

      if (lang === 'vi' && missing.size > 0) {
        await translateBatch([...missing]);
        // second pass to apply the freshly-fetched translations
        suppress = true;
        for (const node of collect()) {
          const raw = original.get(node);
          if (!raw) continue;
          const [lead, core, trail] = splitWhitespace(raw);
          const vi = cache.get(core);
          if (vi) write(node, `${lead}${vi}${trail}`);
        }
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          suppress = false;
        });
      }
    };

    let debounce = 0;
    const schedule = () => {
      clearTimeout(debounce);
      debounce = window.setTimeout(() => void apply(), 150);
    };

    const observer = new MutationObserver((records) => {
      if (suppress) return;
      // Ignore mutations that are purely our own attribute noise.
      const meaningful = records.some(
        (r) => r.type === 'childList' || r.type === 'characterData',
      );
      if (meaningful) schedule();
    });

    void apply();
    observer.observe(root, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      clearTimeout(debounce);
      cancelAnimationFrame(frame);
    };
  }, [lang, pathname]);

  return null;
}
