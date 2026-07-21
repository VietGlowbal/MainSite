/**
 * Cache topology: tag names, TTLs, and the invalidation helpers that pair with
 * them. Keeping this in one module means the eventual move to Next 16's
 * `use cache` is a single-module rewrite rather than a scattered migration.
 */
export {
  CACHE_TAGS,
  CACHE_TTL_LONG,
  revalidateUniversities,
  revalidateScholarships,
  revalidateTeam,
  type CacheTag,
} from './tags';
