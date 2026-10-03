import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/server/db/admin';
import {
  aggregateFrequentlyPicked,
  DEFAULT_FREQUENTLY_PICKED_POLICY,
  normalizeFrequentlyPickedScholarshipIds,
  validateFrequentlyPickedPolicy,
  type FrequentlyPickedAggregate,
  type FrequentlyPickedPolicy,
  type FrequentlyPickedRow,
} from '../domain/frequently-picked';

/**
 * Browser save/remove mutations currently write directly through Supabase's
 * authenticated client. Until those writes have an authenticated cache
 * invalidation boundary, keep the popularity cache short and explicit.
 */
export const FREQUENTLY_PICKED_CACHE_TTL_SECONDS = 60;
export const FREQUENTLY_PICKED_CACHE_TAG = 'frequently-picked';

export type FrequentlyPickedRowsReader = (
  scholarshipIds: readonly number[],
) => Promise<readonly FrequentlyPickedRow[]>;

export type LoadFrequentlyPickedInput = {
  scholarshipIds: readonly number[];
  policy?: FrequentlyPickedPolicy;
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
function parseRow(value: unknown): FrequentlyPickedRow | null {
  const row = record(value);
  if (!row) return null;
  const scholarshipId = typeof row.scholarship_id === 'number'
    ? row.scholarship_id
    : Number(row.scholarship_id);
  const userId = typeof row.user_id === 'string' ? row.user_id.trim() : '';
  if (!Number.isSafeInteger(scholarshipId) || scholarshipId <= 0 || !userId) return null;
  return { scholarshipId, userId };
}

/**
 * Read only the current save rows needed for this batch. This is deliberately
 * service-role server code: authenticated RLS users may read their own rows,
 * but popularity requires an aggregate across all users. Raw user ids never
 * leave this function's server-side reducer.
 */
async function readCurrentFrequentlyPickedRows(
  scholarshipIds: readonly number[],
): Promise<readonly FrequentlyPickedRow[]> {
  const { data, error } = await createAdminClient()
    .from('user_scholarships')
    .select('scholarship_id, user_id')
    .in('scholarship_id', [...scholarshipIds]);

  if (error) {
    throw new Error(`Frequently-picked query failed: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map(parseRow)
    .filter((row): row is FrequentlyPickedRow => row !== null);
}

/**
 * Uncached seam used by tests and by future server jobs that need fresh
 * counts. Production page/API callers should use loadFrequentlyPicked().
 */
export async function loadFrequentlyPickedUncached(
  input: LoadFrequentlyPickedInput & { readRows?: FrequentlyPickedRowsReader },
): Promise<FrequentlyPickedAggregate> {
  const ids = normalizeFrequentlyPickedScholarshipIds(input.scholarshipIds);
  const policy = validateFrequentlyPickedPolicy(
    input.policy ?? DEFAULT_FREQUENTLY_PICKED_POLICY,
  );
  if (ids.length === 0) return {};

  const rows = input.readRows
    ? await input.readRows(ids)
    : await readCurrentFrequentlyPickedRows(ids);
  return aggregateFrequentlyPicked(rows, ids, policy);
}

/**
 * The cache key includes the normalized id list, threshold, and policy
 * version. The cache contains aggregate counts only and is independent from
 * the public catalogue/ranking cache and all user-specific ranking caches.
 */
const loadFrequentlyPickedCached = unstable_cache(
  async (
    scholarshipIds: readonly number[],
    threshold: number,
    policyVersion: string,
  ): Promise<FrequentlyPickedAggregate> => loadFrequentlyPickedUncached({
    scholarshipIds,
    policy: { threshold, version: policyVersion },
  }),
  ['frequently-picked-aggregate', DEFAULT_FREQUENTLY_PICKED_POLICY.version],
  {
    revalidate: FREQUENTLY_PICKED_CACHE_TTL_SECONDS,
    tags: [FREQUENTLY_PICKED_CACHE_TAG],
  },
);

export async function loadFrequentlyPicked(
  input: LoadFrequentlyPickedInput,
): Promise<FrequentlyPickedAggregate> {
  const ids = normalizeFrequentlyPickedScholarshipIds(input.scholarshipIds);
  const policy = validateFrequentlyPickedPolicy(
    input.policy ?? DEFAULT_FREQUENTLY_PICKED_POLICY,
  );
  if (ids.length === 0) return {};
  return loadFrequentlyPickedCached(ids, policy.threshold, policy.version);
}
