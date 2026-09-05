'use client';

import { translations } from '@/lib/i18n-catalog';
import { primeCatalog } from '@/lib/i18n-catalog-runtime';

/**
 * The one place the full translation catalog is imported statically.
 *
 * `/vi/*` renders Vietnamese on the server, so `getLocaleText` and `t()` must
 * both resolve synchronously during SSR *and* during hydration — anything
 * async here would paint English first and swap, which is the layout shift this
 * work is removing, not adding.
 *
 * Being a static import inside a `'use client'` module reached only from
 * `src/app/vi/layout.tsx` is what keeps the 584 KB off the other 250-odd
 * routes: Next builds the client manifest per route, so the chunk is listed for
 * `/vi/*` and nowhere else. Importing this file from anywhere outside `app/vi`
 * would put it back on every page — check `docs/performance.md` before moving
 * it.
 *
 * The priming is a module-scope side effect on purpose. It runs when the module
 * is evaluated — on the server as the layout is imported, and in the browser as
 * the route's chunks load, both strictly before any child renders — so no
 * consumer can observe a half-populated catalog.
 */
primeCatalog(translations);

/** Renders nothing; exists so the layout has something to pull the import in. */
export function ViCatalog() {
  return null;
}
