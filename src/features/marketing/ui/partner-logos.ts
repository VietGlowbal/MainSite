/**
 * The eleven universities shown in the partners section.
 *
 * ⚠️ ONE THING LEFT TO SETTLE BEFORE THIS REACHES "/" IN ĐỢT 5.
 *
 * 1. RESOLVED — the partnership claim. The section used to be headed "Đối tác
 *    tiêu biểu của chúng tôi" ("our featured partners"), and nothing in this
 *    repo substantiates a partnership with MIT, Harvard, Oxford or the other
 *    eight. The heading is now "Study <university>", which claims only that
 *    the place exists in the directory and that we will help you apply — which
 *    is true, and is now literally true, because each logo links to that
 *    university's page. Do not put the old heading back without a signed
 *    agreement behind it.
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
   * What the heading says after "Study " while this logo is hovered.
   *
   * ⚠️ NOT DERIVABLE FROM `name`, which is why it is written out. "Study
   * Massachusetts Institute of Technology" wraps the heading onto a second line
   * and nobody says it out loud; "Study MIT" is what a student would type. Any
   * rule that produces one from the other ("drop 'University of'", "take the
   * first word") gets Caltech, NUS, HKU and Imperial wrong.
   *
   * Keep these SHORT — the heading reserves the width of the longest of them
   * (see PARTNER_STUDY_WORDS in home-partners.tsx) so the line never re-centres
   * mid-flip, and a long one leaves a visible gap for every other logo.
   *
   * Never translated: these are institution names, same rule as `name`.
   */
  readonly shortName: string;
};

export const PARTNER_LOGOS: readonly PartnerLogo[] = [
  { name: 'Massachusetts Institute of Technology', src: '/partners/mit.png', shortName: 'MIT' },
  { name: 'Imperial College London', src: '/partners/imperial.png', shortName: 'Imperial' },
  { name: 'Stanford University', src: '/partners/stanford.png', shortName: 'Stanford' },
  { name: 'University of Oxford', src: '/partners/oxford.png', shortName: 'Oxford' },
  { name: 'Harvard University', src: '/partners/harvard.png', shortName: 'Harvard' },
  { name: 'University of Cambridge', src: '/partners/cambridge.png', shortName: 'Cambridge' },
  { name: 'California Institute of Technology', src: '/partners/caltech.png', shortName: 'Caltech' },
  { name: 'National University of Singapore', src: '/partners/nus.png', shortName: 'NUS' },
  { name: 'The University of Hong Kong', src: '/partners/hku.png', shortName: 'HKU' },
  { name: 'Cornell University', src: '/partners/cornell.png', shortName: 'Cornell' },
  { name: 'ETH Zürich', src: '/partners/eth-zurich.png', shortName: 'ETH Zürich' },
];
