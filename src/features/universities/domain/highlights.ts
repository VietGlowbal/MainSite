/**
 * Turning the `universities` table's editorial prose into scannable UI.
 *
 * Every column this module touches is free text written for a human to read, so
 * nothing here parses meaning — these are two shape helpers, and both are lossy
 * on purpose:
 *
 *   splitList     a comma-separated field -> the chips it was always a list of
 *   leadFragment  a long prose field      -> its first clause, for a stat tile
 *
 * Neither is allowed to invent. `leadFragment` only ever returns a prefix of its
 * input, and the call sites all keep the full string reachable (as a `title`,
 * and again in the section further down the page) rather than replacing it.
 *
 * Pure: no React, no I/O.
 */

/**
 * Split a comma-separated editorial field into its items.
 *
 * `strengths` and `best_for` are populated on all 97 rows and are commas all the
 * way down — "Engineering, CS, Physics, Economics, Management, Architecture,
 * Neuroscience". Rendered as one string they are a wall; rendered as chips they
 * are the fastest thing on the page to read.
 *
 * ⚠️ Splits on commas ONLY, never on "and" or "&". "Arts & Social Sciences" and
 * "Business (NUS Business School)" are single items that contain a conjunction
 * and a bracket respectively, and a cleverer splitter shreds both.
 *
 * @param max Optional cap. The remainder is not summarised — callers that pass
 *   this render an explicit "+N more" from the full length, so nothing is
 *   silently dropped.
 */
export function splitList(value: string | null | undefined, max?: number): string[] {
  if (!value) return [];
  const items = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  // Case-insensitive dedupe, first spelling wins. A few rows repeat a subject
  // between `strengths` and `best_for`, and two identical chips read as a bug.
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return max == null ? unique : unique.slice(0, max);
}

/**
 * The first clause of a prose field, for somewhere too small to hold all of it.
 *
 * The stat tiles at the top of /universities/[id] are ~150px wide and the data
 * they show is not: `gpa_range` on VinUni is "Competitive applicants generally
 * 3.5+/4.0 equivalent; estimated minimum admission ~3.2+ but scholarship
 * applicants usually much higher". The useful part is the head of it, and the
 * separators the source material actually uses to start qualifying itself are
 * `;`, `(` and `|`.
 *
 * Returns null rather than a placeholder when there is nothing to show, so a
 * caller can drop the tile instead of printing an em dash into a headline slot.
 *
 * @param maxChars Hard ceiling applied after the clause split, since a first
 *   clause can still be long. Truncation breaks on a word boundary and is
 *   marked with an ellipsis, so a clipped value never reads as a complete one.
 */
export function leadFragment(
  value: string | null | undefined,
  maxChars = 34,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === '—') return null;

  // Take the shortest clause the separators produce, then tidy trailing
  // punctuation the cut may have exposed.
  const clause = (trimmed.split(/[;|(]/)[0] ?? trimmed).trim().replace(/[,;:–-]+$/, '').trim();
  const head = clause.length > 0 ? clause : trimmed;

  if (head.length <= maxChars) return head;

  const cut = head.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  // Only break on a space if one survives reasonably far in; a single very long
  // token would otherwise collapse to almost nothing.
  const base = lastSpace > maxChars * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[,;:–-]+$/, '').trim()}…`;
}
