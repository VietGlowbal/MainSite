import '@testing-library/jest-dom';
import { translations } from '@/lib/i18n-catalog';
import { primeCatalog } from '@/lib/i18n-catalog-runtime';

// Mock window.matchMedia for tests that use responsive hooks.
//
// HOW A QUERY RESOLVES. jsdom implements no layout, so naively every query
// would be false — which silently flips any component whose hydration default
// is desktop (see `use-media-query.ts`) onto its mobile tree after mount.
// Instead, width-based queries resolve against a virtual desktop viewport of
// 1024×768 (jsdom's own default window size): `min-width: N px` matches when
// 1024 ≥ N, `max-width: N px` matches when 1024 ≤ N. Everything else —
// prefers-reduced-motion and friends — keeps resolving to false.
//
// HOW TO OVERRIDE FROM A TEST. Call `window.__setMediaQueryMatches(query,
// matches)` BEFORE rendering to pin one query's result (e.g. simulate a phone:
// `(min-width: 768px)` → false), and reset between tests with
// `window.__resetMediaQueryMatches()` — an override outlives its test
// otherwise, because the map lives for the whole file.

const VIRTUAL_VIEWPORT_WIDTH = 1024;

const overrides = new Map<string, boolean>();

function resolveMatches(query: string): boolean {
  const pinned = overrides.get(query);
  if (pinned !== undefined) return pinned;
  const minWidth = /min-width\s*:\s*(\d+)px/.exec(query);
  if (minWidth?.[1] !== undefined) return Number(minWidth[1]) <= VIRTUAL_VIEWPORT_WIDTH;
  const maxWidth = /max-width\s*:\s*(\d+)px/.exec(query);
  if (maxWidth?.[1] !== undefined) return Number(maxWidth[1]) >= VIRTUAL_VIEWPORT_WIDTH;
  return false;
}

declare global {
  interface Window {
    __setMediaQueryMatches: (query: string, matches: boolean) => void;
    __resetMediaQueryMatches: () => void;
  }
}

Object.defineProperty(window, '__setMediaQueryMatches', {
  writable: true,
  value: (query: string, matches: boolean) => {
    overrides.set(query, matches);
  },
});

Object.defineProperty(window, '__resetMediaQueryMatches', {
  writable: true,
  value: () => {
    overrides.clear();
  },
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: resolveMatches(query),
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});

// ── Translation catalog ──────────────────────────────────────────────────────
//
// In the browser the Vietnamese catalog is loaded on demand, so that 584 KB of
// strings does not sit in every route's first-load bundle — see
// `src/lib/i18n-catalog-runtime.ts`. `/vi/*` primes it in its layout; nothing
// else has it until the reader asks for Vietnamese.
//
// A component test renders neither layout, so without this line every
// `t('...')` and `getLocaleText('vi', ...)` would fall back to English and the
// assertions on Vietnamese copy would fail — which is exactly what happened
// when the lazy load landed. Priming here restores the eager behaviour the
// suite was written against: tests assert translation *behaviour*, and the
// bundle boundary they would otherwise be measuring is a build concern checked
// in `docs/performance.md`, not a runtime one.

primeCatalog(translations);
