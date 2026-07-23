/**
 * The eleven university tiles scattered across Figma 104:7135, with each one's
 * position and size on the design's 1440x977 stage.
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
 * 2. Every source file is 90x90 and the design paints them at 100-140px, so
 *    they are already upscaled before the device pixel ratio is applied — on a
 *    2x screen the largest tile is drawn at 3.1x its real resolution. Ask the
 *    designer for the vector or 2x originals.
 *
 * The coordinates are the raw Figma frame numbers rather than percentages, so
 * they can be checked against get_metadata without arithmetic. The component
 * turns them into percentages, which is what makes the whole arrangement scale
 * as one piece.
 */
export type PartnerLogo = {
  /** Alt text. An institution name — never translated, per the i18n rules. */
  readonly name: string;
  readonly src: string;
  /** Top-left corner in the design's 1440x977 frame. */
  readonly x: number;
  readonly y: number;
  /** Tiles are square in the design; this is both width and height. */
  readonly size: number;
};

/** Figma 104:7135. Wider than the 1280 container — tiles run from x=168 to x=1373. */
export const PARTNER_STAGE = { width: 1440, height: 977 } as const;

/**
 * Heading 104:7136 sits at y=439 and is 64px tall, so its centre is at 471 of
 * 977 — a touch above the true middle. Kept exact rather than rounded to 50%.
 */
export const PARTNER_HEADING_CENTER_Y = 471 / PARTNER_STAGE.height;

export const PARTNER_LOGOS: readonly PartnerLogo[] = [
  { name: 'Massachusetts Institute of Technology', src: '/partners/mit.png', x: 366, y: 232, size: 120 },
  { name: 'Imperial College London', src: '/partners/imperial.png', x: 168, y: 415, size: 140 },
  { name: 'Stanford University', src: '/partners/stanford.png', x: 605, y: 125, size: 120 },
  { name: 'University of Oxford', src: '/partners/oxford.png', x: 840, y: 71, size: 110 },
  { name: 'Harvard University', src: '/partners/harvard.png', x: 321, y: 620, size: 130 },
  { name: 'University of Cambridge', src: '/partners/cambridge.png', x: 534, y: 718, size: 120 },
  { name: 'California Institute of Technology', src: '/partners/caltech.png', x: 791, y: 763, size: 120 },
  { name: 'National University of Singapore', src: '/partners/nus.png', x: 981, y: 624, size: 106 },
  { name: 'The University of Hong Kong', src: '/partners/hku.png', x: 1159, y: 512, size: 102 },
  { name: 'Cornell University', src: '/partners/cornell.png', x: 1055, y: 182, size: 120 },
  { name: 'ETH Zürich', src: '/partners/eth-zurich.png', x: 1273, y: 346, size: 100 },
];
