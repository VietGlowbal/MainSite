/**
 * Lazy access to the Vietnamese translation catalog.
 *
 * `i18n-catalog` composes nine dictionaries totalling 534 KB of source. Until
 * 2026-09-05 it was a *static* import in all three of `i18n.tsx`,
 * `dom-translate.tsx` and `i18n/locale.ts` — every one of which the root layout
 * pulls in — so it landed in the first-load bundle of every route: 584 KB raw /
 * 178 KB gzipped, a third of the JS transfer, on `/terms` exactly as much as on
 * `/`. English never reads a byte of it: `t()` returns the source string before
 * it ever reaches the lookup.
 *
 * So the catalog now lives behind a dynamic import, and this module hands out
 * whatever has been loaded so far. Two things populate it:
 *
 *   - `/vi/*` primes it synchronously (see `src/app/vi/vi-catalog.tsx`), so the
 *     server render and the hydration that follows both see the full map and no
 *     text swaps underneath the reader.
 *   - Toggling EN → VI on any other route calls `loadCatalog()`, which fetches
 *     the chunk and re-renders. That is a click, not first paint.
 *
 * ⚠️ Never `import` the catalog statically from a module the client can reach —
 * that puts all 584 KB back into every route's initial bundle and silently
 * undoes this. `getCatalog()` is the only client-side entry point.
 *
 * A miss means "no Vietnamese for this key yet", which callers must render as
 * the English source. That is the same contract the catalog has always had for
 * a key with no entry, so the fallback path is not new behaviour.
 */
export type Catalog = Record<string, string>;

/** Distinct object identity so `isCatalogLoaded` needs no extra flag. */
const EMPTY: Catalog = {};

let catalog: Catalog = EMPTY;
let loader: Promise<Catalog> | null = null;

/** Whatever is loaded right now. Empty until primed or awaited — never null. */
export function getCatalog(): Catalog {
  return catalog;
}

export function isCatalogLoaded(): boolean {
  return catalog !== EMPTY;
}

/**
 * Install the catalog synchronously. Used by the `/vi` layout, which statically
 * imports it precisely so those routes pay the cost and no others do.
 */
export function primeCatalog(entries: Catalog): void {
  catalog = entries;
  loader ??= Promise.resolve(entries);
}

/** Fetch the catalog chunk. Idempotent — concurrent callers share one import. */
export function loadCatalog(): Promise<Catalog> {
  loader ??= import('./i18n-catalog').then((module) => {
    catalog = module.translations;
    return catalog;
  });
  return loader;
}
