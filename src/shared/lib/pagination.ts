/**
 * Generic pagination primitives.
 *
 * Lives in shared/ rather than in a feature because more than one repository
 * returns paginated results, and a feature importing another feature's `Page`
 * type would violate the cross-feature boundary (see eslint.config.mjs).
 */

/** One page of results plus the metadata a pagination control needs. */
export interface Page<T> {
  items: T[];
  /** Total rows matching the query, ignoring pagination. */
  total: number;
  /** 1-based. */
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Clamp a caller-supplied page size into [1, max]. */
export function clampPageSize(pageSize: number, max: number, fallback: number): number {
  if (!Number.isFinite(pageSize)) return fallback;
  return Math.min(Math.max(Math.trunc(pageSize), 1), max);
}

/** Clamp a caller-supplied page number to a 1-based index. */
export function clampPage(page: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.max(Math.trunc(page), 1);
}

/** Zero-based offset of the first row on `page`. */
export function pageOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/** Build a `Page` from a result set plus the query that produced it. */
export function toPage<T>(items: T[], total: number, page: number, pageSize: number): Page<T> {
  return {
    items,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}
