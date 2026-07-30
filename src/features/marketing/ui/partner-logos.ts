/**
 * The eleven universities shown in the partners section.
 *
 * ⚠️ TWO THINGS TO SETTLE BEFORE THIS REACHES "/" IN ĐỢT 5.
 *
 * 1. The section is headed "Đối tác tiêu biểu của chúng tôi" — "our featured
 *    partners". Nothing in this repo suggests GLOWBAL has a partnership with
 *    MIT, Harvard, Oxford or the other eight, and the crests are registered
 *    trademarks. The audience is students choosing where to spend years and a
 *    lot of money, so an unearned endorsement is not a small thing. If the
 *    claim cannot be substantiated the fix is the heading, not the list: the
 *    same logos are unobjectionable under something like "Các trường trong kho
 *    dữ liệu" (universities in our database).
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
};

export const PARTNER_LOGOS: readonly PartnerLogo[] = [
  { name: 'Massachusetts Institute of Technology', src: '/partners/mit.png' },
  { name: 'Imperial College London', src: '/partners/imperial.png' },
  { name: 'Stanford University', src: '/partners/stanford.png' },
  { name: 'University of Oxford', src: '/partners/oxford.png' },
  { name: 'Harvard University', src: '/partners/harvard.png' },
  { name: 'University of Cambridge', src: '/partners/cambridge.png' },
  { name: 'California Institute of Technology', src: '/partners/caltech.png' },
  { name: 'National University of Singapore', src: '/partners/nus.png' },
  { name: 'The University of Hong Kong', src: '/partners/hku.png' },
  { name: 'Cornell University', src: '/partners/cornell.png' },
  { name: 'ETH Zürich', src: '/partners/eth-zurich.png' },
];
