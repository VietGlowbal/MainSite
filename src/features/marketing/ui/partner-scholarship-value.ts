/**
 * The award ceiling shown on each orbiting crest, and the aggregate in the
 * section heading.
 *
 * ⚠️ THESE ARE MARKETING FIGURES, NOT CATALOGUE FIGURES. The owner confirmed
 * that on 2026-09-20 and accepted the gap; it is recorded here so nobody
 * re-derives the surprise, and so nobody "fixes" the file by wiring it to the
 * repository — the numbers would fall one to two orders of magnitude, and that
 * would not be a bug in the wiring, it is what our data says:
 *
 *   | Shown here          | What the database holds (measured 2026-09-20)          |
 *   |---------------------|--------------------------------------------------------|
 *   | "$150M" total       | $30.4M summing every USD row's ceiling — and $12M of    |
 *   |                     | that is one row that is almost certainly bad crawler    |
 *   |                     | output, so the defensible figure is nearer $18M.        |
 *   | "Up to $450K/$600K" | Biggest single award per university: Harvard $56,392 ·  |
 *   |                     | Imperial £75,000 · Oxford £30,000 · Stanford $22,900 ·  |
 *   |                     | Cambridge £22,000 · HKU $18,760 · NUS S$6,000 ·         |
 *   |                     | MIT $2,000. Caltech and Cornell: no amount at all.      |
 *
 * So these describe the scale of a fully-funded place over a whole degree,
 * which is a different quantity from any single row in `scholarships` — not a
 * rounded-up version of one. Change the copy with the owner, never the source.
 *
 * ─── WHERE EACH NUMBER CAME FROM ────────────────────────────────────────────
 *
 * Five are the owner's own, read off their screenshot: Stanford, Imperial, HKU,
 * Cornell, ETH Zürich. They use exactly two values, $450K and $600K.
 *
 * The other six were filled in on 2026-09-20 at the owner's request ("tra dữ
 * liệu và điền vào 1 con số hợp lí") from the owner's own two tiers rather than
 * a third invented value, grouped by the scale of a fully-funded place:
 *
 *   $600K — US private universities, where a funded place runs about $90K a
 *           year across four or more years: MIT, Harvard, Caltech. This is the
 *           tier the owner already put Cornell in.
 *   $450K — shorter UK degrees and the lower-cost Asian institutions: Oxford,
 *           Cambridge, NUS. The tier the owner already used for HKU and ETH.
 *
 * Two of the owner's five do not follow that rule — Stanford is a US private at
 * $450K and Imperial a UK university at $600K — so the rule describes the six
 * added here, not all eleven. Their five are left exactly as given; overwrite
 * any of the six freely, they carry no more authority than the tier they sit in.
 *
 * Keyed by `PartnerLogo.name` so the two lists cannot drift apart silently —
 * see the `satisfies` check below, which fails the build if a key here is not a
 * real partner.
 */
import { PARTNER_LOGOS } from './partner-logos';

/** The aggregate in the heading. Owner-supplied, same caveat as above. */
export const PARTNER_TOTAL_SCHOLARSHIP_VALUE = '$150M';

type PartnerName = (typeof PARTNER_LOGOS)[number]['name'];

/**
 * Award ceiling per university, already formatted — the owner gave them as
 * display strings ("$450K"), not as numbers, and inventing a currency and a
 * magnitude to store them as numbers would be adding precision nobody supplied.
 *
 * A university with no entry renders NO badge. Every partner has one today, so
 * that path is currently unused — keep it working anyway: it is what makes
 * adding a twelfth logo a one-line change rather than a forced invention.
 */
export const PARTNER_SCHOLARSHIP_VALUE: Partial<Record<PartnerName, string>> = {
  // The owner's five.
  'Stanford University': '$450K',
  'Imperial College London': '$600K',
  'The University of Hong Kong': '$450K',
  'Cornell University': '$600K',
  'ETH Zürich': '$450K',
  // Filled from the owner's tiers — see "Where each number came from".
  'Massachusetts Institute of Technology': '$600K',
  'Harvard University': '$600K',
  'California Institute of Technology': '$600K',
  'University of Oxford': '$450K',
  'University of Cambridge': '$450K',
  'National University of Singapore': '$450K',
} satisfies Partial<Record<PartnerName, string>>;

export function partnerScholarshipValue(name: string): string | null {
  return PARTNER_SCHOLARSHIP_VALUE[name as PartnerName] ?? null;
}
