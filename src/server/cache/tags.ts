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

/** Invalidate the published scholarship directory (and the home index). */
export function revalidateScholarships(): void {
  revalidateTag(CACHE_TAGS.scholarships, SWR);
}

/** Invalidate the team roster. */
export function revalidateTeam(): void {
  revalidateTag(CACHE_TAGS.team, SWR);
}
