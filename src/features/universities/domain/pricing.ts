import { parseTuitionRange } from './formatting';

/**
 * Net-tuition estimation.
 *
 * Answers "what would this actually cost after the best scholarship on offer",
 * which is the number a student cares about. Pure: no React, no I/O.
 *
 * These are display-only estimates. Awards are competitive and FX moves, so the
 * goal is order-of-magnitude honesty, not accounting accuracy.
 */

/** The scholarship fields net-tuition needs. Structural, so any richer type fits. */
export interface ScholarshipLike {
  name: string;
  coverage: string | null;
  fundingType: string[] | null;
  amountMin: number | null;
  amountMax: number | null;
  amountCurrency: string | null;
}

export interface NetTuition {
  netLo: number;
  netHi: number;
  scholarshipName: string;
}

/**
 * Highest tuition-coverage percentage in a free-text coverage string.
 *
 * "100% tuition" -> 100, "80%–90% tuition" -> 90, "50%, 60% or 70%" -> 70.
 * Falls back to 100 for full-ride funding when no number is present.
 * Returns null when there is no usable signal.
 */
export function parseCoveragePercent(
  coverage: string | null | undefined,
  fundingType: string[] | null | undefined,
): number | null {
  const text = (coverage ?? '').trim();
  if (text) {
    const percentages = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)]
      .map((m) => (m[1] ? Number.parseFloat(m[1]) : Number.NaN))
      .filter((p) => Number.isFinite(p) && p > 0 && p <= 100);
    if (percentages.length) return Math.max(...percentages);
  }
  if ((fundingType ?? []).includes('full-ride')) return 100;
  return null;
}

/**
 * Approximate FX rates to USD.
 *
 * Static and intentionally rough — see the module note. Update when a rate
 * drifts far enough to change an order of magnitude, not on every move.
 */
const USD_PER: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  AUD: 0.66,
  CAD: 0.73,
  SGD: 0.74,
  CHF: 1.12,
  VND: 0.00004,
};

/** Convert a major-unit amount to USD, or null for an unknown currency. */
export function amountToUsd(amount: number, currency: string | null | undefined): number | null {
  const rate = USD_PER[(currency ?? 'USD').toUpperCase()];
  return rate == null ? null : amount * rate;
}

/**
 * Tuition after the single best (largest-reduction) scholarship.
 *
 * A parseable coverage percentage scales the tuition; otherwise the cash award
 * is converted to USD and subtracted. Returns null when nothing discounts the
 * bill — unparseable tuition, already free, or no scholarship that reduces it.
 */
export function computeNetTuition(
  tuitionText: string | null | undefined,
  scholarships: readonly ScholarshipLike[] | null | undefined,
): NetTuition | null {
  const range = parseTuitionRange(tuitionText);
  if (range === null || range === 'free') return null;

  let best: NetTuition | null = null;

  for (const s of scholarships ?? []) {
    let netLo: number;
    let netHi: number;

    const pct = parseCoveragePercent(s.coverage, s.fundingType);
    if (pct != null) {
      const factor = 1 - pct / 100;
      netLo = range.lo * factor;
      netHi = range.hi * factor;
    } else {
      const amount = s.amountMax ?? s.amountMin;
      if (amount == null) continue;
      const amountUsd = amountToUsd(amount, s.amountCurrency);
      if (amountUsd == null) continue;
      netLo = Math.max(0, range.lo - amountUsd);
      netHi = Math.max(0, range.hi - amountUsd);
    }

    // Ignore awards that don't actually reduce the bill.
    if (netHi >= range.hi) continue;
    if (!best || netHi < best.netHi) {
      best = { netLo, netHi, scholarshipName: s.name };
    }
  }

  return best;
}
