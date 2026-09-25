/**
 * Public, privacy-safe popularity derived from the current
 * `user_scholarships` rows. This domain contract deliberately has no concept
 * of applications, awards, historical saves, or individual users.
 */

export const FREQUENTLY_PICKED_POLICY_VERSION = 'frequently-picked-v1';
export const DEFAULT_FREQUENTLY_PICKED_THRESHOLD = 3;

export type FrequentlyPickedPolicy = {
  version: string;
  threshold: number;
};

export const DEFAULT_FREQUENTLY_PICKED_POLICY: FrequentlyPickedPolicy = {
  version: FREQUENTLY_PICKED_POLICY_VERSION,
  threshold: DEFAULT_FREQUENTLY_PICKED_THRESHOLD,
};

/** The only row data the server-side reducer needs. */
export type FrequentlyPickedRow = {
  scholarshipId: number;
  userId: string;
  /** Optional internal context; it must never affect the distinct-user count. */
  universityId?: number | null;
};

/** The only data allowed to cross the server/client boundary. */
export type FrequentlyPickedSummary = {
  count: number;
  threshold: number;
  isFrequentlyPicked: boolean;
};

export type FrequentlyPickedAggregate = Readonly<Record<string, FrequentlyPickedSummary>>;

function validScholarshipId(value: number): value is number {
  return Number.isSafeInteger(value) && value > 0;
}

export function normalizeFrequentlyPickedScholarshipIds(ids: readonly number[]): number[] {
  return [...new Set(ids.filter(validScholarshipId))].sort((left, right) => left - right);
}

export function validateFrequentlyPickedPolicy(
  policy: FrequentlyPickedPolicy,
): FrequentlyPickedPolicy {
  if (!policy.version.trim()) {
    throw new Error('Frequently-picked policy version is required.');
  }
  if (!Number.isSafeInteger(policy.threshold) || policy.threshold <= 0) {
    throw new Error('Frequently-picked threshold must be a positive integer.');
  }
  return {
    version: policy.version.trim(),
    threshold: policy.threshold,
  };
}

/**
 * Count distinct current users for each requested scholarship. Duplicate
 * rows, including rows that differ only by university context, are collapsed
 * by user id before the threshold is applied.
 */
export function aggregateFrequentlyPicked(
  rows: readonly FrequentlyPickedRow[],
  scholarshipIds: readonly number[],
  policy: FrequentlyPickedPolicy = DEFAULT_FREQUENTLY_PICKED_POLICY,
): FrequentlyPickedAggregate {
  const validatedPolicy = validateFrequentlyPickedPolicy(policy);
  const ids = normalizeFrequentlyPickedScholarshipIds(scholarshipIds);
  const requestedIds = new Set(ids);
  const usersByScholarship = new Map<number, Set<string>>();

  for (const row of rows) {
    if (!validScholarshipId(row.scholarshipId)) continue;
    if (!requestedIds.has(row.scholarshipId)) continue;
    const userId = row.userId.trim();
    if (!userId) continue;
    const users = usersByScholarship.get(row.scholarshipId) ?? new Set<string>();
    users.add(userId);
    usersByScholarship.set(row.scholarshipId, users);
  }

  const result: Record<string, FrequentlyPickedSummary> = {};
  for (const scholarshipId of ids) {
    const count = usersByScholarship.get(scholarshipId)?.size ?? 0;
    result[String(scholarshipId)] = {
      count,
      threshold: validatedPolicy.threshold,
      isFrequentlyPicked: count >= validatedPolicy.threshold,
    };
  }
  return result;
}
