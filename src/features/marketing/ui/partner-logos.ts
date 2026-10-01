/**
 * The eleven universities shown in the partners section.
 *
 * ⚠️ ONE THING LEFT TO SETTLE BEFORE THIS REACHES "/" IN ĐỢT 5.
 *
 * 1. RESOLVED — the partnership claim. The section used to be headed "Đối tác
 *    tiêu biểu của chúng tôi" ("our featured partners"), and nothing in this
 *    repo substantiates a partnership with MIT, Harvard, Oxford or the other
 *    eight. The heading is now "Study <country>" (it was "Study <university>"
 *    until the 2026-09-27 handoff), which claims only that you can study there
 *    and that we will help you apply — which is true, and each logo still links
 *    to that university's page in the directory. Do not put the old heading
 *    back without a signed agreement behind it.
 *
 * 2. Every source file is 90x90 and the orbit paints them between about 60 and
 *    125px, so the ones at the near side of the orbit are upscaled before the
 *    device pixel ratio is applied. Ask the designer for the vector or 2x
 *    originals.
 *
 * The order is the order they sit around the orbit — evenly spaced, so it is a
 * seating plan rather than a ranking. It reads as the Figma scatter did (roughly
 * anticlockwise from MIT) so the two are diffable.
 *
 * ─── WHAT USED TO BE HERE ───────────────────────────────────────────────────
 *
 * Each entry also carried an `x`, `y` and `size`: the hand-placed coordinates
 * from Figma 104:7135, which the component turned into percentages of a fixed
 * 1440x977 stage. That stage is gone — the logos now orbit, and their positions
 * come from `../domain/orbit-path`. Nothing read the coordinates any more, so
 * they went with it rather than sitting here looking authoritative.
 */
export type PartnerLogo = {
  /** Alt text. An institution name — never translated, per the i18n rules. */
  readonly name: string;
  readonly src: string;
  /**
   * What the heading says after "Study " while this logo is hovered — the
   * university's COUNTRY since the sales-journey handoff (2026-09-27), which
   * swapped it in for the short name ("Study MIT" → "Study the United States").
   *
   * Both languages are written out rather than looked up: the English carries
   * the article the sentence needs ("the United Kingdom"), and the Vietnamese
   * reads as a destination after "Du học" ("Du học Anh", not "Vương quốc Anh").
   * Values are the handoff's `crests` table, verbatim.
   */
  readonly country: { readonly en: string; readonly vi: string };
};

const US = { en: 'the United States', vi: 'Mỹ' } as const;
const UK = { en: 'the United Kingdom', vi: 'Anh' } as const;

export const PARTNER_LOGOS: readonly PartnerLogo[] = [
  { name: 'Massachusetts Institute of Technology', src: '/partners/mit.png', country: US },
  { name: 'Imperial College London', src: '/partners/imperial.png', country: UK },
  { name: 'Stanford University', src: '/partners/stanford.png', country: US },
  { name: 'University of Oxford', src: '/partners/oxford.png', country: UK },
  { name: 'Harvard University', src: '/partners/harvard.png', country: US },
  { name: 'University of Cambridge', src: '/partners/cambridge.png', country: UK },
  { name: 'California Institute of Technology', src: '/partners/caltech.png', country: US },
  { name: 'National University of Singapore', src: '/partners/nus.png', country: { en: 'Singapore', vi: 'Singapore' } },
  { name: 'The University of Hong Kong', src: '/partners/hku.png', country: { en: 'Hong Kong', vi: 'Hồng Kông' } },
  { name: 'Cornell University', src: '/partners/cornell.png', country: US },
  { name: 'ETH Zürich', src: '/partners/eth-zurich.png', country: { en: 'Switzerland', vi: 'Thuỵ Sĩ' } },
];
