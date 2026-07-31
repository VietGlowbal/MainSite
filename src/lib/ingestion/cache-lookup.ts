/**
 * Crawl Cache Lookup
 *
 * Before enqueueing a new ingestion job, search completed crawl runs in
 * Supabase for a programme whose official URL matches the submitted URL.
 * Uses canonical URL equality to avoid minor formatting differences.
 *
 * Selection priority (when multiple matches exist):
 *   1. 'approved' run before 'completed'
 *   2. Newest finished_at / imported_at
 *   3. HUMAN_VERIFIED / RULE_VALIDATED before lower statuses
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { canonicalizeUrl } from './url-utils';

export interface CacheHitResult {
  found: true;
  runId: string;
  programmeId: string;
  courseId: string;
  programmeName: string | null;
  degreeLevel: string | null;
  deliveryMode: string | null;
  officialUrl: string;
  runStatus: string;
  verificationStatus: string;
}

export interface CacheMissResult {
  found: false;
}

export type CacheLookupResult = CacheHitResult | CacheMissResult;

const VERIFICATION_RANK: Record<string, number> = {
  HUMAN_VERIFIED: 3,
  RULE_VALIDATED: 2,
  AI_EXTRACTED: 1,
  FETCHED: 0,
  DISCOVERED: 0,
  NEEDS_REVIEW: -1,
  REJECTED: -99,
};

const RUN_STATUS_RANK: Record<string, number> = {
  approved: 2,
  completed: 1,
};

/**
 * Search completed crawl runs for a programme matching the submitted URL.
 * Returns the best match, or { found: false } if nothing usable exists.
 */
export async function lookupCrawlCache(
  submittedUrl: string
): Promise<CacheLookupResult> {
  const supabase = createAdminClient();

  // Canonicalize for comparison — strip tracking params, normalize path
  let canonicalUrl: string;
  try {
    canonicalUrl = canonicalizeUrl(submittedUrl);
  } catch {
    // If we can't canonicalize, fall back to the raw URL
    canonicalUrl = submittedUrl.trim();
  }

  // Query crawl_programmes joined with crawl_runs
  // official_url must match canonical or submitted URL
  const { data, error } = await supabase
    .from('crawl_programmes')
    .select(
      `
      programme_id,
      programme_name,
      degree_level,
      delivery_mode,
      official_url,
      verification_status,
      run_id,
      crawl_runs!crawl_programmes_run_id_fkey!inner (
        id,
        status,
        finished_at,
        imported_at
      )
    `
    )
    .in('crawl_runs.status', ['completed', 'approved'])
    .neq('verification_status', 'REJECTED')
    .in(
      'official_url',
      [...new Set([canonicalUrl, submittedUrl.trim()])]
    )
    .limit(20);

  if (error) {
    console.error('[cache-lookup] Supabase query error:', error.message);
    return { found: false };
  }

  if (!data || data.length === 0) {
    return { found: false };
  }

  // Sort by priority: run status > finished_at (newest) > verification_status
  const ranked = [...data].sort((a, b) => {
    // 1. Approved run wins
    const runA = Array.isArray(a.crawl_runs) ? a.crawl_runs[0] : a.crawl_runs;
    const runB = Array.isArray(b.crawl_runs) ? b.crawl_runs[0] : b.crawl_runs;
    const runStatusDiff =
      (RUN_STATUS_RANK[runB?.status ?? ''] ?? 0) -
      (RUN_STATUS_RANK[runA?.status ?? ''] ?? 0);
    if (runStatusDiff !== 0) return runStatusDiff;

    // 2. Newest run
    const timeA = new Date(runA?.finished_at ?? runA?.imported_at ?? 0).getTime();
    const timeB = new Date(runB?.finished_at ?? runB?.imported_at ?? 0).getTime();
    if (timeB !== timeA) return timeB - timeA;

    // 3. Highest verification status
    return (
      (VERIFICATION_RANK[b.verification_status] ?? 0) -
      (VERIFICATION_RANK[a.verification_status] ?? 0)
    );
  });

  const best = ranked[0];
  const run = Array.isArray(best.crawl_runs) ? best.crawl_runs[0] : best.crawl_runs;
  const { data: catalogCourses, error: catalogError } = await supabase
    .from('courses')
    .select('id')
    .eq('source_programme_id', best.programme_id)
    .limit(2);

  // A crawl-only match is still useful, but it must pass through the worker
  // once so promote_crawl_run can create the stable product entity.
  if (catalogError || !catalogCourses || catalogCourses.length !== 1) {
    return { found: false };
  }

  return {
    found: true,
    runId: run?.id ?? best.run_id,
    programmeId: best.programme_id,
    courseId: catalogCourses[0].id,
    programmeName: best.programme_name ?? null,
    degreeLevel: best.degree_level ?? null,
    deliveryMode: best.delivery_mode ?? null,
    officialUrl: best.official_url,
    runStatus: run?.status ?? 'completed',
    verificationStatus: best.verification_status,
  };
}
