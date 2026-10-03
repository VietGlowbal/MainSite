/**
 * The aggregate in the scholarship showcase heading ("… with $150M in total
 * scholarship value").
 *
 * ⚠️ THIS IS A MARKETING FIGURE, NOT A CATALOGUE FIGURE. The owner confirmed
 * that on 2026-09-20 and accepted the gap; it is recorded here so nobody
 * re-derives the surprise, and so nobody "fixes" it by wiring it to the
 * repository — the number would fall by an order of magnitude, and that would
 * not be a bug in the wiring, it is what our data says: summing every USD
 * row's ceiling in `scholarships` gave $30.4M on 2026-09-20, and $12M of that
 * is one row that is almost certainly bad crawler output, so the defensible
 * figure is nearer $18M. "$150M" describes the scale of fully-funded places
 * over whole degrees, a different quantity from any sum of rows.
 * Change the copy with the owner, never the source.
 *
 * History: each orbiting crest also carried an "Up to $450K / $600K" strip
 * (five values the owner supplied, six filled from the owner's two tiers).
 * The owner removed the strips on 2026-09-29, so the per-university map went
 * with them — it is in git history if they ever come back.
 */
export const PARTNER_TOTAL_SCHOLARSHIP_VALUE = '$150M';
