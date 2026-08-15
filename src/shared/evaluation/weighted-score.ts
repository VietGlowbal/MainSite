/**
 * The one arithmetic primitive every scoring framework in this engine is
 * built from: a weighted average over metrics, any of which may be `null`
 * ("not available" — no confusion with a real zero), with the remaining
 * weights renormalized to sum to 1.
 *
 * Core principle 6: "Missing metrics become N/A and weights are renormalized
 * where appropriate." This is the "where appropriate" implementation, used by
 * F1, F2, F3 and F4's base metrics so the rule is enforced identically
 * everywhere rather than reimplemented — and possibly forgotten — per
 * framework.
 */

export type WeightedMetric = {
  key: string;
  /** The metric's canonical weight. All of a framework's weights should sum to 1. */
  weight: number;
  /** `null` means this metric could not be assessed — not a zero score. */
  value: number | null;
};

export type WeightedScoreResult = {
  /** `null` only when every metric was N/A. */
  score: number | null;
  /** True when at least one metric was N/A and the rest were rescaled to compensate. */
  renormalized: boolean;
  /** Keys of the metrics that were N/A. */
  missingKeys: string[];
  /** Keys of the metrics that were used. */
  presentKeys: string[];
};

export function weightedScore(metrics: readonly WeightedMetric[]): WeightedScoreResult {
  const present = metrics.filter((metric) => metric.value !== null);
  const missingKeys = metrics.filter((metric) => metric.value === null).map((metric) => metric.key);
  const presentKeys = present.map((metric) => metric.key);

  if (present.length === 0) {
    return { score: null, renormalized: false, missingKeys, presentKeys };
  }

  const totalWeight = present.reduce((sum, metric) => sum + metric.weight, 0);
  if (totalWeight <= 0) {
    return { score: null, renormalized: false, missingKeys, presentKeys };
  }

  const score = present.reduce(
    (sum, metric) => sum + (metric.value as number) * (metric.weight / totalWeight),
    0,
  );

  return {
    score,
    renormalized: missingKeys.length > 0,
    missingKeys,
    presentKeys,
  };
}
