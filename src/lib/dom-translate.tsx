'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/lib/i18n';
import { translations as dictionary } from '@/lib/i18n-catalog';

/**
 * Whole-page auto-translation.
 *
 * Walks the visible text inside the main content area and machine-translates
 * it to Vietnamese via /api/translate (OpenAI-backed), caching every result so
 * a string is only ever translated once. This gives broad coverage across
 * pages that haven't been hand-wrapped with t() yet.
 *
 * Design notes / safety:
 * - Text nodes are translated, plus a small allow-list of user-visible
 *   attributes (placeholder, aria-label, title). An input's `value` is NEVER
 *   touched — it's controlled state owned by React.
 * - <script>, <style>, <code>, <pre>, <textarea> and anything inside a
 *   [data-no-auto-translate] region are skipped. Report roots may explicitly
 *   opt in with [data-report-auto-translate] so private AI-generated report
 *   prose follows the user's selected language without enabling translation
 *   for the rest of a private page.
 * - Original English is remembered per node/attribute, so toggling back to
 *   English restores it instantly.
 * - A MutationObserver re-translates content that React re-renders or that
 *   arrives from client navigation; our own writes are suppressed to avoid
 *   loops.
 * - Pure numbers/symbols (no letters) are ignored.
 */

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'SVG', 'PATH',
]);

// User-visible text that lives in attributes rather than text nodes. `value` is
// deliberately excluded — it's React-controlled state and writing it would
// corrupt user input.
const ATTRS = ['placeholder', 'aria-label', 'title'] as const;

// Routes that render private user data — names, emails, application details,
// uploaded document names, transcript/passport info, admin records, etc.
// Whole-page machine translation is DISABLED here so that no PII is ever
// forwarded to the translation service (/api/translate → OpenAI). These pages
// still localise their chrome/labels via the static dictionary (t()) and any
// explicit <AutoTranslate> the developer opted in to. Report roots are the
// deliberate exception: the user asked for AI translation of report prose.
const PII_ROUTE_PREFIXES = [
  '/profile',
  '/apply',
  '/dashboard',
  '/admin',
  '/onboarding',
  '/my-universities',
  '/auth',
  '/ai-strategy',
];

function isPiiRoute(pathname: string): boolean {
  return PII_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
// Bumped to v2 to discard pre-existing client caches that may hold rough
// machine translations (older prompt) or strings captured before PII routing
// existed. Must stay in sync with the key in use-auto-translate.tsx.
const LS_KEY = 'glowbal-mt-cache-vi-v2';
const HAS_LETTER = /\p{L}/u;

// english(core) -> vietnamese. Seeded with the static dictionary so common
// strings are instant and free (no API round-trip).
const cache = new Map<string, string>(Object.entries(dictionary));
const translatedValues = new Set(Object.values(dictionary));
const original = new WeakMap<Text, string>();
// Per-element snapshot of original attribute values, so toggling back to
// English restores them (mirrors `original` for text nodes).
const originalAttrs = new WeakMap<Element, Record<string, string>>();
let cacheLoaded = false;

function loadCache() {
  if (cacheLoaded || typeof window === 'undefined') return;
  cacheLoaded = true;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, string>))
      if (!(k in dictionary)) cache.set(k, v);   // chỉ nạp MT cho key CHƯA có trong từ điển
  } catch {
    /* ignore */
  }
}

function persist() {
  try {
    // useAutoTranslate shares this storage key. Merge with whatever is already
    // there before writing so the two writers never clobber each other's
    // entries (ours win on conflict — they're the same en→vi mapping anyway).
    const raw = localStorage.getItem(LS_KEY);
    const existing = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    localStorage.setItem(LS_KEY, JSON.stringify({ ...existing, ...Object.fromEntries(cache) }));
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
  const protectedRegion = parent.closest('[data-no-auto-translate]');
  if (protectedRegion && !parent.closest('[data-report-auto-translate]')) return false;
  return true;
}

function reportOptedIn(element: Element | null): boolean {
  return Boolean(element?.closest('[data-report-auto-translate]'));
}

// Same trust boundary as text nodes, applied to an attribute's value. Values
// with no letters (numeric ranks, codes, percentages) are ignored.
function eligibleAttrValue(el: Element, value: string | null): value is string {
  if (!value || !HAS_LETTER.test(value)) return false;
  if (SKIP_TAGS.has(el.tagName)) return false;
  if ((el as HTMLElement).isContentEditable) return false;
  const protectedRegion = el.closest('[data-no-auto-translate]');
  if (protectedRegion && !el.closest('[data-report-auto-translate]')) return false;
  return true;
}

function splitWhitespace(raw: string): [string, string, string] {
  const m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return m ? [m[1], m[2], m[3]] : ['', raw, ''];
}

async function translateBatch(cores: string[], signal: AbortSignal): Promise<void> {
  const CHUNK = 40;
  for (let i = 0; i < cores.length; i += CHUNK) {
    if (signal.aborted) return;
    const chunk = cores.slice(i, i + CHUNK);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: chunk, target: 'vi' }),
        signal,
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { translations?: string[] };
      if (signal.aborted) return;
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
    loadCache();
    const mainRoot = document.querySelector('main.glowbal-main-content');
    if (!mainRoot) return;
    // Canvas section details render through a body-level portal. Include only
    // explicitly opted-in report roots outside <main>; the main root already
    // contains any report subtree rendered in the normal page flow.
    const getRoots = (): Element[] => [
      mainRoot,
      ...Array.from(document.querySelectorAll('[data-report-auto-translate]')).filter(
        (element) => !mainRoot.contains(element),
      ),
    ];

    // On private pages, only a report root explicitly opted in with
    // data-report-auto-translate may send uncovered strings to /api/translate.
    // Everything else keeps the PII-safe static-dictionary-only behaviour.
    const networkAllowed = !isPiiRoute(pathname);
    const controller = new AbortController();

    let suppress = false;
    let frame = 0;

    const collect = (): Text[] => {
      const nodes = new Set<Text>();
      for (const root of getRoots()) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
          acceptNode: (n) => (eligible(n as Text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
        });
        for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.add(n as Text);
      }
      return [...nodes];
    };

    const write = (node: Text, value: string) => {
      if (node.nodeValue !== value) {
        node.nodeValue = value;
      }
    };

    const collectAttrEls = (): Element[] => {
      const elements = new Set<Element>();
      for (const root of getRoots()) {
        for (const element of root.querySelectorAll('[placeholder],[aria-label],[title]')) {
          elements.add(element);
        }
      }
      return [...elements];
    };

    const writeAttr = (el: Element, attr: string, value: string) => {
      if (el.getAttribute(attr) !== value) el.setAttribute(attr, value);
    };

    // Translate (or restore) the allow-listed attributes on one element. Shared
    // by the first pass and the post-fetch second pass. Cores that miss the
    // cache are collected into `missing` for the batched /api/translate call.
    const applyAttrs = (el: Element, missing: Set<string> | null) => {
      let snap = originalAttrs.get(el);
      for (const attr of ATTRS) {
        const current = el.getAttribute(attr);
        if (current == null) continue;
        if (!snap) {
          snap = {};
          originalAttrs.set(el, snap);
        }
        if (!(attr in snap)) snap[attr] = current;
        const raw = snap[attr];
        if (!eligibleAttrValue(el, raw)) continue;
        const [lead, core, trail] = splitWhitespace(raw);
        if (!core) continue;

        if (lang === 'en') {
          writeAttr(el, attr, raw);
          continue;
        }
        if (translatedValues.has(core)) {
          writeAttr(el, attr, raw);
          continue;
        }
        const vi = cache.get(core);
        if (vi) writeAttr(el, attr, `${lead}${vi}${trail}`);
        else if (missing && (networkAllowed || reportOptedIn(el))) missing.add(core);
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
        if (translatedValues.has(core)) {
          write(node, raw);
          continue;
        }
        const vi = cache.get(core);
        if (vi) write(node, `${lead}${vi}${trail}`);
        else if (networkAllowed || reportOptedIn(node.parentElement)) missing.add(core);
      }
      // Same pass for user-visible attributes (placeholder/aria-label/title).
      for (const el of collectAttrEls()) applyAttrs(el, missing);
      // release the suppression after this paint so our writes don't re-trigger
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        suppress = false;
      });

      if (lang === 'vi' && missing.size > 0) {
        await translateBatch([...missing], controller.signal);
        if (controller.signal.aborted) return;
        // second pass to apply the freshly-fetched translations
        suppress = true;
        for (const node of collect()) {
          const raw = original.get(node);
          if (!raw) continue;
          const [lead, core, trail] = splitWhitespace(raw);
          const vi = cache.get(core);
          if (vi) write(node, `${lead}${vi}${trail}`);
        }
        // second pass for attributes (cache-hit only — no new network calls)
        for (const el of collectAttrEls()) applyAttrs(el, null);
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
      let meaningful = false;
      for (const r of records) {
        if (r.type === 'characterData') {
          // React rewrote this text node in place (e.g. switching the active
          // Reach/Recommended/Safe banner reuses the same node). Our cached
          // "original" English is now stale — if we don't refresh it, the next
          // pass would "restore" the old copy over the new text, making the UI
          // appear to revert after the debounce. Re-snapshot the live value as
          // the new source of truth.
          const target = r.target as Text;
          if (original.has(target)) original.set(target, target.nodeValue ?? '');
          meaningful = true;
        } else if (r.type === 'childList') {
          meaningful = true;
        }
      }
      if (meaningful) schedule();
    });

    void apply();
    observer.observe(mainRoot, { childList: true, subtree: true, characterData: true });
    const observeReportRoots = () => {
      for (const root of getRoots()) {
        if (root !== mainRoot) {
          observer.observe(root, { childList: true, subtree: true, characterData: true });
        }
      }
    };
    observeReportRoots();
    // A Personal Canvas modal is portaled to <body>. Watch only direct body
    // insertions for a report marker, then observe that report subtree; other
    // private modal content never enters the translation observer.
    const portalObserver = new MutationObserver((records) => {
      const reportRootAdded = records.some(
        (record) =>
          Array.from(record.addedNodes).some(
            (node) =>
              node instanceof Element &&
              (node.matches('[data-report-auto-translate]') ||
                node.querySelector('[data-report-auto-translate]')),
          ),
      );
      if (!reportRootAdded) return;
      observeReportRoots();
      schedule();
    });
    portalObserver.observe(document.body, { childList: true });

    return () => {
      controller.abort();
      observer.disconnect();
      portalObserver.disconnect();
      clearTimeout(debounce);
      cancelAnimationFrame(frame);
    };
  }, [lang, pathname]);

  return null;
}
