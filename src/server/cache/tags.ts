import { revalidateTag } from 'next/cache';

/**
 * Cache topology.
 *
 * Every `unstable_cache` in the app declares one or more of these tags, but
 * before this module existed nothing ever invalidated them — `revalidateTag`
 * was called zero times repo-wide. The practical effect was that the nightly
 * crons which rewrite the `universities` table could not surface their work for
 * up to twelve hours, because the cached read still held the previous payload.
 *
 * Concentrating the tag names, the TTL, and the invalidation helpers here also
 * means that migrating to Next 16's `use cache` later is a single-module
 * rewrite rather than a hunt through four scattered call sites.
 *
 * Current producers:
 *   universities   -> getAllUniversities            (src/app/universities/page.tsx)
 *                     getHomeIndex                  (src/lib/home-search.ts)
 *                     getMatchingCatalogue          (src/features/universities/api/
 *                                                    university-matching-loader.ts)
 *
 * ⚠️ `getMatchingCatalogue` also caches `catalog_programmes`, which the
 * `universities` writers do not touch. Its own writer is
 * `scripts/import-university-programs-csv.mjs --apply`, which calls
 * `/api/admin/universities/revalidate` for exactly this reason. If you add
 * another `catalog_programmes` writer, invalidate this tag from it too.
 *   scholarships   -> getPublishedScholarships      (src/lib/scholarships-data.ts)
 *                     getHomeIndex                  (src/lib/home-search.ts)
 *   team           -> getTeamMembers                (src/lib/team.ts)
 */
export const CACHE_TAGS = {
  universities: 'universities',
  scholarships: 'scholarships',
  team: 'team',
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * Twelve hours — the TTL every cached read in this app uses. Prefer importing
 * this over repeating the literal, so the number moves in one place.
 */
export const CACHE_TTL_LONG = 43_200;

/**
 * Stale-while-revalidate profile.
 *
 * Next 16 requires a second argument on `revalidateTag`; the single-argument
 * form is deprecated and does a blocking expiry. `'max'` marks the tag stale
 * and serves the old payload while the new one is fetched in the background —
 * the right trade for cron-driven writes, where no user is waiting on the
 * result and a blocking miss would just punish whoever loads the page next.
 *
 * Note this means invalidation is lazy: nothing refetches until a page
 * carrying the tag is actually visited.
 */
const SWR: string = 'max';

/**
 * Invalidate everything derived from the `universities` table.
 *
 * This covers the home search index too — it is tagged `universities` because
 * it embeds university names and ids, so leaving it warm would serve stale
 * names alongside fresh university data.
 */
export function revalidateUniversities(): void {
  revalidateTag(CACHE_TAGS.universities, SWR);
}

/**
 * Immediately expire university reads after an external/manual import.
 *
 * The regular cron path above deliberately uses stale-while-revalidate. A CSV
 * import is different: the operator has just changed canonical URLs and needs
 * the next directory request to block on fresh data rather than serving the
 * old cards once more. Next 16 documents `{ expire: 0 }` for this webhook-like
 * case.
 */
export function expireUniversitiesNow(): void {
  revalidateTag(CACHE_TAGS.universities, { expire: 0 });
}

/** Invalidate the published scholarship directory (and the home index). */
export function revalidateScholarships(): void {
  revalidateTag(CACHE_TAGS.scholarships, SWR);
}

/** Invalidate the team roster. */
export function revalidateTeam(): void {
  revalidateTag(CACHE_TAGS.team, SWR);
}
