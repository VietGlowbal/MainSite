/**
 * @deprecated Moved to `@/features/universities/ui/explorer-context`.
 *
 * Kept as a re-export so the three existing importers keep compiling. Note one
 * of them is `src/app/universities/page.tsx`, a Server Component importing a
 * type from a `'use client'` module — that works only because types erase, and
 * is why `ApplicationEntry` now also lives in the feature's domain slice.
 *
 * The context itself is still the 14-field / 14-action God Context it always
 * was. Splitting it into per-concern providers is Track B's job: the right
 * boundaries follow from which components subscribe to which slice, and that
 * component tree does not exist yet.
 */
export {
  UniversityExplorerProvider,
  useExplorer,
  filterUniversities,
  type ApplicationEntry,
  type ExplorerActions,
  type ExplorerState,
  type ExplorerUniversity,
} from '@/features/universities/ui/explorer-context';
