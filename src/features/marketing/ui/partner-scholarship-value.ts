/**
 * The award ceiling shown on each orbiting crest, and the aggregate in the
 * section heading.
 *
 * ⚠️ THESE NUMBERS ARE SUPPLIED BY THE PROJECT OWNER. They are NOT computed
 * from `scholarships.amount_max`, and they must never be presented as though
 * they were. The owner confirmed the source on 2026-09-20 when asked, because
 * the database does not support them and nothing here should imply it does:
 *
 *   | Shown here          | What the database actually holds (measured 2026-09-20) |
 *   |---------------------|--------------------------------------------------------|
 *   | "$150M" total       | $30.4M summing every USD row's ceiling — and $12M of    |
 *   |                     | that is a single row that is almost certainly bad       |
 *   |                     | crawler output, so the defensible figure is ~$18M.      |
 *   | "Up to $450K/$600K" | Harvard $56,392 · Stanford $22,900 · HKU $18,760 ·      |
 *   |                     | NUS SGD 6,000 · MIT $2,000. Caltech and Cornell have    |
 *   |                     | no scholarship carrying an amount at all.               |
 *
 * So: if someone later "fixes" this file by wiring it to the repository, the
 * numbers will drop by one to two orders of magnitude. That is not a bug in the
 * wiring — it is what our data says. Change the copy with the owner, not the
 * source of the figures.
 *
 * ⚠️ SIX OF THE ELEVEN ARE STILL MISSING. The five below are the ones legible
 * in the owner's screenshot; the rest were too small to read and are
 * deliberately absent rather than guessed. A university with no entry renders
 * NO badge — an empty crest is honest, an invented number is not. Fill these in
 * as the owner supplies them.
 *
 * Keyed by `PartnerLogo.name` so the two lists cannot drift apart silently —
 * see the `satisfies` check at the bottom, which fails the build if a key here
 * is not a real partner.
 */
import { PARTNER_LOGOS } from './partner-logos';

/** The aggregate in the heading. Owner-supplied, same caveat as above. */
export const PARTNER_TOTAL_SCHOLARSHIP_VALUE = '$150M';

type PartnerName = (typeof PARTNER_LOGOS)[number]['name'];

/**
 * Award ceiling per university, already formatted — the owner gave them as
 * display strings ("$450K"), not as numbers, and inventing a currency and a
 * magnitude to store them as numbers would be adding precision nobody supplied.
 */
export const PARTNER_SCHOLARSHIP_VALUE: Partial<Record<PartnerName, string>> = {
  'Stanford University': '$450K',
  'Imperial College London': '$600K',
  'The University of Hong Kong': '$450K',
  'Cornell University': '$600K',
  'ETH Zürich': '$450K',
  // Awaiting the owner: MIT, Oxford, Harvard, Cambridge, Caltech, NUS.
} satisfies Partial<Record<PartnerName, string>>;

export function partnerScholarshipValue(name: string): string | null {
  return PARTNER_SCHOLARSHIP_VALUE[name as PartnerName] ?? null;
}
