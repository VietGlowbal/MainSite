/**
 * Free-text parsers for university reference data.
 *
 * The `universities` table stores acceptance rates, tuition and deadlines as
 * prose ("14–18% overall; Engineering competitive", "42,000-65,000 USD",
 * "January 15"), because that is how the source material is published. These
 * functions turn that prose into something a card can render or sort on.
 *
 * Extracted from university-explorer-client.tsx so the logic survives the UI
 * rewrite. Pure: no React, no I/O.
 */

/** First number in an acceptance-rate string, e.g. "14–18%" -> 14. */
export function parseAcceptanceRate(rate: string | null | undefined): number | null {
  if (!rate) return null;
  const match = rate.match(/(\d+(\.\d+)?)/);
  const captured = match?.[1];
  return captured ? Number.parseFloat(captured) : null;
}

/**
 * Strip everything non-numeric and parse.
 *
 * Lossy by design and only safe for single-value strings: "42,000-65,000"
 * fuses into 4200065000. Use {@link parseTuitionRange} for anything that might
 * be a range.
 */
export function parseTuition(tuition: string | null | undefined): number | null {
  if (!tuition) return null;
  const num = tuition.replace(/[^0-9.]/g, '');
  return num ? Number.parseFloat(num) : null;
}

/**
 * Compact acceptance rate for a stat row.
 *
 * The stored value is often too noisy for a 3-column grid, so pick the first
 * percentage expression and keep the range if there is one. Callers show the
 * full string as a tooltip.
 */
export function formatAcceptanceForCard(rate: string | null | undefined): string {
  if (!rate) return '—';
  const trimmed = rate.trim();
  if (!trimmed || trimmed === '—') return '—';

  const range = trimmed.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*%/);
  if (range?.[1] && range[2]) return `${range[1]}–${range[2]}%`;

  const single = trimmed.match(/(\d+(?:\.\d+)?)\s*%/);
  if (single?.[1]) return `${single[1]}%`;

  return trimmed.length > 12 ? `${trimmed.slice(0, 11).trim()}…` : trimmed;
}

/**
 * Parse a free-text tuition string into USD major units.
 *
 * Returns a {lo, hi} range, the sentinel 'free', or null when nothing parses.
 * Deliberately does NOT reuse {@link parseTuition}, which would fuse the two
 * halves of a range into one number.
 */
export function parseTuitionRange(
  tuition: string | null | undefined,
): { lo: number; hi: number } | 'free' | null {
  if (!tuition) return null;
  const trimmed = tuition.trim();
  if (!trimmed || trimmed === '—') return null;
  if (/free/i.test(trimmed)) return 'free';

  const cleaned = trimmed.replace(/,/g, '');

  const range = cleaned.match(/(\d{3,6})\s*[–-]\s*(\d{3,6})/);
  if (range?.[1] && range[2]) {
    return { lo: Number.parseInt(range[1], 10), hi: Number.parseInt(range[2], 10) };
  }

  const single = cleaned.match(/(\d{3,6})/);
  if (single?.[1]) {
    const n = Number.parseInt(single[1], 10);
    return { lo: n, hi: n };
  }
  return null;
}

/** Thousands-separated major units: 62000 -> "62,000". */
export function formatUsdOne(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** "$62,000" or "$41,000–45,000". */
export function formatUsdCompact(lo: number, hi?: number): string {
  if (hi != null && hi !== lo) return `$${formatUsdOne(lo)}–${formatUsdOne(hi)}`;
  return `$${formatUsdOne(lo)}`;
}

/** Tuition for a stat row: "$42,000–65,000", "Free", or a truncated fallback. */
export function formatTuitionForCard(tuition: string | null | undefined): string {
  const parsed = parseTuitionRange(tuition);
  if (parsed === 'free') return 'Free';
  if (parsed) return formatUsdCompact(parsed.lo, parsed.hi);

  if (!tuition) return '—';
  const trimmed = tuition.trim();
  if (!trimmed || trimmed === '—') return '—';
  return trimmed.length > 10 ? `${trimmed.slice(0, 9).trim()}…` : trimmed;
}

const MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
] as const;

/**
 * Best-effort deadline parser.
 *
 * Tries `Date.parse` first, then falls back to a leading month name, resolving
 * to the next future occurrence so a past "Jan 15" means January of next year.
 *
 * @param now Injectable clock. Defaults to the current time; pass a fixed date
 *   in tests so the rollover behaviour is assertable.
 */
export function parseDeadline(raw: string | null | undefined, now: Date = new Date()): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '—') return null;

  const direct = Date.parse(trimmed);
  if (!Number.isNaN(direct)) return new Date(direct);

  const lower = trimmed.toLowerCase();
  const monthIdx = MONTHS.findIndex((m) => lower.startsWith(m));
  if (monthIdx === -1) return null;

  const dayMatch = lower.match(/\b(\d{1,2})\b/);
  const day = dayMatch?.[1] ? Number.parseInt(dayMatch[1], 10) : 15;

  let year = now.getFullYear();
  let candidate = new Date(year, monthIdx, day);
  if (candidate.getTime() < now.getTime()) {
    year += 1;
    candidate = new Date(year, monthIdx, day);
  }
  return candidate;
}
