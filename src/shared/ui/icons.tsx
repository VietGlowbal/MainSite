/**
 * Untitled UI icons, taken from the Figma exports.
 *
 * The path data is verbatim; the only change is `stroke="currentColor"` in
 * place of the literal the export bakes in (#E11D48 on some, white on others,
 * and #9E77ED — leftover kit purple — on arrow-right). That one change is what
 * lets a caller set the colour with a token instead of shipping one asset per
 * colour, and it is why these are components rather than files in public/.
 *
 * SIZING IS NOT `size-6`. Each export's viewBox is the *stroked bounds of the
 * artwork*, which is smaller than the icon frame and usually not square:
 *
 *     zap                    18.865 x 22       in a 24px frame
 *     message-smile-circle   20.608 x 19       in a 24px frame
 *     check-circle           25.6667 x 25.6667 in a 28px frame
 *
 * Figma positions the art with per-side percentage insets that reproduce
 * exactly that box, so the faithful render is the viewBox dimensions in px,
 * scaled by (target frame / the frame it was exported against). Dropping the
 * svg into a square `size-6` instead stretches every one of these ~10% and
 * shifts it off centre — small, but it is wrong on every icon at once.
 */

export type KitIconArt = {
  /** Stroked bounds of the artwork, in the units the export used. */
  readonly w: number;
  readonly h: number;
  /** The icon-frame size those units were exported against. */
  readonly frame: number;
  readonly strokeWidth: number;
  /**
   * One path, or several. Most of the kit's icons export as a single compound
   * path; a few (marker-pin-02) are genuinely two separate `<path>` elements,
   * and concatenating their `d` strings would join the shapes with a stray line.
   */
  readonly d: string | readonly string[];
};

export function KitIcon({
  art,
  frame,
  className,
}: {
  art: KitIconArt;
  /** Side of the icon frame in the design, e.g. 24 inside a 48px featured icon. */
  frame: number;
  className?: string | undefined;
}) {
  const scale = frame / art.frame;
  return (
    <svg
      viewBox={`0 0 ${art.w} ${art.h}`}
      width={art.w * scale}
      height={art.h * scale}
      fill="none"
      stroke="currentColor"
      strokeWidth={art.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...(className ? { className } : {})}
    >
      {(typeof art.d === 'string' ? [art.d] : art.d).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export const ICONS = {
  /** Figma 2:8046 — the metrics and feature-block featured icons. */
  zapFast: {
    w: 25.3663,
    h: 23.0002,
    frame: 28,
    strokeWidth: 2,
    d: 'M9.16667 17.9167H2.75M6.25 11.5001H1M9.16667 5.08342H3.33333M18.5 1.00008L10.8042 11.7743C10.4635 12.2511 10.2932 12.4896 10.3006 12.6884C10.307 12.8614 10.39 13.0227 10.5271 13.1285C10.6846 13.2501 10.9776 13.2501 11.5636 13.2501H17.3333L16.1667 22.0001L23.8625 11.2259C24.2031 10.749 24.3734 10.5106 24.3661 10.3118C24.3597 10.1387 24.2767 9.97745 24.1396 9.87163C23.9821 9.75008 23.6891 9.75008 23.103 9.75008H17.3333L18.5 1.00008Z',
  },
  /** Figma 2:81 — the bullet in every "Check item text". */
  checkCircle: {
    w: 25.6667,
    h: 25.6667,
    frame: 28,
    strokeWidth: 2.33333,
    d: 'M7.58333 12.8333L11.0833 16.3333L18.0833 9.33333M24.5 12.8333C24.5 19.2767 19.2767 24.5 12.8333 24.5C6.39001 24.5 1.16667 19.2767 1.16667 12.8333C1.16667 6.39001 6.39001 1.16667 12.8333 1.16667C19.2767 1.16667 24.5 6.39001 24.5 12.8333Z',
  },
  /** Figma 2:3773 */
  messageChatCircle: {
    w: 22.1052,
    h: 22,
    frame: 24,
    strokeWidth: 2,
    d: 'M5.09438 10.2288C5.03222 9.82823 4.99998 9.41786 4.99998 9C4.99998 4.58172 8.60526 1 13.0526 1C17.5 1 21.1052 4.58172 21.1052 9C21.1052 9.99807 20.9213 10.9535 20.5852 11.8345C20.5154 12.0175 20.4805 12.109 20.4646 12.1804C20.4489 12.2512 20.4429 12.301 20.4411 12.3735C20.4394 12.4466 20.4493 12.5272 20.4692 12.6883L20.8718 15.9585C20.9153 16.3125 20.9371 16.4895 20.8782 16.6182C20.8267 16.731 20.735 16.8205 20.6211 16.8695C20.4911 16.9254 20.3146 16.8995 19.9617 16.8478L16.7765 16.3809C16.6102 16.3565 16.527 16.3443 16.4513 16.3448C16.3763 16.3452 16.3245 16.3507 16.2512 16.3661C16.177 16.3817 16.0824 16.4172 15.893 16.4881C15.0097 16.819 14.0524 17 13.0526 17C12.6344 17 12.2237 16.9683 11.8227 16.9073M6.63159 21C9.59649 21 12 18.5376 12 15.5C12 12.4624 9.59649 10 6.63159 10C3.6667 10 1.26317 12.4624 1.26317 15.5C1.26317 16.1106 1.36029 16.6979 1.53956 17.2467C1.61534 17.4787 1.65324 17.5947 1.66567 17.6739C1.67865 17.7567 1.68093 17.8031 1.67609 17.8867C1.67146 17.9668 1.65143 18.0573 1.61136 18.2383L1.00001 21L3.99482 20.591C4.15828 20.5687 4.24001 20.5575 4.31138 20.558C4.38653 20.5585 4.42642 20.5626 4.50012 20.5773C4.57012 20.5912 4.67417 20.6279 4.88229 20.7014C5.43061 20.8949 6.01912 21 6.63159 21Z',
  },
  /** Figma 2:26564 */
  zap: {
    w: 18.865,
    h: 22.0001,
    frame: 24,
    strokeWidth: 2,
    d: 'M10.4325 1.00006L1.52594 11.6879C1.17713 12.1065 1.00272 12.3158 1.00006 12.4925C0.99774 12.6462 1.06621 12.7924 1.18574 12.8889C1.32323 13.0001 1.59566 13.0001 2.14051 13.0001H9.43248L8.43248 21.0001L17.339 10.3122C17.6878 9.89363 17.8622 9.68435 17.8649 9.50759C17.8672 9.35394 17.7987 9.20775 17.6792 9.11116C17.5417 9.00006 17.2693 9.00006 16.7244 9.00006H9.43248L10.4325 1.00006Z',
  },
  /** Figma 2:3755 */
  chartBreakoutSquare: {
    w: 21.0104,
    h: 21,
    frame: 24,
    strokeWidth: 2,
    d: 'M9.00014 2H5.80014C4.11998 2 3.27991 2 2.63817 2.32698C2.07368 2.6146 1.61474 3.07354 1.32712 3.63803C1.00014 4.27976 1.00014 5.11984 1.00014 6.8V15.2C1.00014 16.8802 1.00014 17.7202 1.32712 18.362C1.61474 18.9265 2.07368 19.3854 2.63817 19.673C3.27991 20 4.11998 20 5.80014 20H14.2001C15.8803 20 16.7204 20 17.3621 19.673C17.9266 19.3854 18.3855 18.9265 18.6732 18.362C19.0001 17.7202 19.0001 16.8802 19.0001 15.2V12M10.0001 7H14.0001V11M13.5001 2.5V1M17.4395 3.56066L18.5001 2.5M18.5104 7.5H20.0104M1.00014 12.3471C1.65208 12.4478 2.32001 12.5 3.00014 12.5C7.3865 12.5 11.2655 10.3276 13.6198 7',
  },
  /** Figma 2:26780 */
  messageSmileCircle: {
    w: 20.608,
    h: 19,
    frame: 24,
    strokeWidth: 2,
    d: 'M7.60796 12C7.60796 12 8.92046 13.5 11.108 13.5C13.2955 13.5 14.608 12 14.608 12M13.858 7H13.868M8.35796 7H8.36796M11.108 18C15.8024 18 19.608 14.1944 19.608 9.5C19.608 4.80558 15.8024 1 11.108 1C6.41354 1 2.60796 4.80558 2.60796 9.5C2.60796 10.45 2.7638 11.3636 3.05133 12.2166C3.15953 12.5376 3.21363 12.6981 3.22338 12.8214C3.23302 12.9432 3.22574 13.0286 3.19561 13.1469C3.1651 13.2668 3.09775 13.3915 2.96305 13.6408L1.32739 16.6684C1.09408 17.1002 0.977426 17.3161 1.00353 17.4828C1.02628 17.6279 1.1117 17.7557 1.23713 17.8322C1.38113 17.9201 1.62526 17.8948 2.1135 17.8444L7.23452 17.315C7.3896 17.299 7.46714 17.291 7.53782 17.2937C7.60733 17.2963 7.6564 17.3029 7.72419 17.3185C7.79311 17.3344 7.87978 17.3678 8.05311 17.4345C9.00116 17.7998 10.0312 18 11.108 18ZM14.358 7C14.358 7.27614 14.1341 7.5 13.858 7.5C13.5818 7.5 13.358 7.27614 13.358 7C13.358 6.72386 13.5818 6.5 13.858 6.5C14.1341 6.5 14.358 6.72386 14.358 7ZM8.85796 7C8.85796 7.27614 8.6341 7.5 8.35796 7.5C8.08181 7.5 7.85796 7.27614 7.85796 7C7.85796 6.72386 8.08181 6.5 8.35796 6.5C8.6341 6.5 8.85796 6.72386 8.85796 7Z',
  },
  /** Figma 2:384 — the dropdown affordance on Select (instance 104:7396, 16px). */
  chevronDown: {
    w: 9.75,
    h: 5.75,
    frame: 16,
    strokeWidth: 1.75,
    d: 'M0.875 0.875L4.875 4.875L8.875 0.875',
  },
  /** Figma 2:467 — trails the "Learn more" link on a feature card. */
  arrowRight: {
    w: 13.3333,
    h: 13.3333,
    frame: 20,
    strokeWidth: 1.66667,
    d: 'M0.833333 6.66667H12.5M6.66667 12.5L12.5 6.66667L6.66667 0.833333',
  },
  /**
   * Leads the "back to the list" link on the course workspace.
   *
   * A true mirror of `arrowRight` about x = 6.66667, unlike the `arrowUpRight`
   * case below: this glyph is a straight shaft plus a symmetrical chevron, with
   * no elbow to give the reflection away.
   */
  arrowLeft: {
    w: 13.3333,
    h: 13.3333,
    frame: 20,
    strokeWidth: 1.66667,
    d: 'M12.5 6.66667H0.833333M6.66667 12.5L0.833333 6.66667L6.66667 0.833333',
  },
  /**
   * Figma 2:31009 — trails "Read post" on a blog card (I153:18284;1390:725).
   * Deliberately a second arrow rather than a rotated `arrowRight`: the kit's
   * up-right glyph has its own elbow (a diagonal shaft plus a corner bracket),
   * so rotating the horizontal one by 45° gives a visibly different mark.
   */
  arrowUpRight: {
    w: 10,
    h: 10,
    frame: 20,
    strokeWidth: 1.66667,
    d: 'M0.833333 9.16667L9.16667 0.833333M9.16667 9.16667V0.833333H0.833333',
  },
  /**
   * Figma 41:4011 — the location line on a saved-list row (223:9502).
   * Two paths: the pin outline and the dot inside it.
   */
  markerPin02: {
    w: 15,
    h: 18.3333,
    frame: 20,
    strokeWidth: 1.66667,
    d: [
      'M7.5 9.58333C8.88071 9.58333 10 8.46404 10 7.08333C10 5.70262 8.88071 4.58333 7.5 4.58333C6.11929 4.58333 5 5.70262 5 7.08333C5 8.46404 6.11929 9.58333 7.5 9.58333Z',
      'M7.5 17.5C9.16667 14.1667 14.1667 12.0152 14.1667 7.5C14.1667 3.8181 11.1819 0.833333 7.5 0.833333C3.8181 0.833333 0.833333 3.8181 0.833333 7.5C0.833333 12.0152 5.83333 14.1667 7.5 17.5Z',
    ],
  },
  /**
   * ⚠️ NOT A FIGMA EXPORT, unlike everything else in this file.
   *
   * The reflection form needs an add control and no frame in the file draws one
   * with an exported glyph, so this is constructed to the kit's conventions
   * rather than taken from it. Replace it with the real export if one is ever
   * added to the file.
   *
   * Note the coordinate space, which is easy to get wrong: `viewBox` is
   * `0 0 w h`, the *stroked bounds*, not the 20px icon frame. So the path runs
   * 0.83333 → 10.83333 rather than 4.16667 → 15.8333, inset by half a stroke
   * exactly as `clock` and `markerPin02` are. Written in frame coordinates it
   * renders clipped to its own top-left corner.
   */
  plus: {
    w: 11.6667,
    h: 11.6667,
    frame: 20,
    strokeWidth: 1.66667,
    d: 'M5.83333 0.83333V10.8333M0.83333 5.83333H10.8333',
  },
  /** Figma 41:8794 — the deadline line on a saved-list row (223:9505). */
  clock: {
    w: 18.3333,
    h: 18.3333,
    frame: 20,
    strokeWidth: 1.66667,
    d: 'M9.16667 4.16667V9.16667L12.5 10.8333M17.5 9.16667C17.5 13.769 13.769 17.5 9.16667 17.5C4.56429 17.5 0.833333 13.769 0.833333 9.16667C0.833333 4.56429 4.56429 0.833333 9.16667 0.833333C13.769 0.833333 17.5 4.56429 17.5 9.16667Z',
  },
  /**
   * Figma 223:9567 — the scholarship bar under the saved list. Exported at 32px
   * with no inset, so `frame` is 32 here rather than the usual 20/24.
   */
  gift01: {
    w: 32,
    h: 32,
    frame: 32,
    strokeWidth: 2,
    d: 'M16 8V29.3333M16 8H11.2857C10.5911 8 9.92493 7.71905 9.43377 7.21895C8.9426 6.71885 8.66667 6.04058 8.66667 5.33333C8.66667 4.62609 8.9426 3.94781 9.43377 3.44772C9.92493 2.94762 10.5911 2.66667 11.2857 2.66667C14.9524 2.66667 16 8 16 8ZM16 8H20.7143C21.4089 8 22.0751 7.71905 22.5662 7.21895C23.0574 6.71885 23.3333 6.04058 23.3333 5.33333C23.3333 4.62609 23.0574 3.94781 22.5662 3.44772C22.0751 2.94762 21.4089 2.66667 20.7143 2.66667C17.0476 2.66667 16 8 16 8ZM26.6667 14.6667V25.0667C26.6667 26.5601 26.6667 27.3069 26.376 27.8773C26.1204 28.3791 25.7124 28.787 25.2106 29.0427C24.6402 29.3333 23.8935 29.3333 22.4 29.3333L9.6 29.3333C8.10653 29.3333 7.35979 29.3333 6.78936 29.0427C6.28759 28.787 5.87964 28.3791 5.62398 27.8773C5.33333 27.3069 5.33333 26.5601 5.33333 25.0667V14.6667M2.66667 10.1333L2.66667 12.5333C2.66667 13.2801 2.66667 13.6534 2.81199 13.9387C2.93982 14.1895 3.1438 14.3935 3.39468 14.5213C3.67989 14.6667 4.05326 14.6667 4.8 14.6667L27.2 14.6667C27.9467 14.6667 28.3201 14.6667 28.6053 14.5213C28.8562 14.3935 29.0602 14.1895 29.188 13.9387C29.3333 13.6534 29.3333 13.2801 29.3333 12.5333V10.1333C29.3333 9.3866 29.3333 9.01323 29.188 8.72801C29.0602 8.47713 28.8562 8.27316 28.6053 8.14533C28.3201 8 27.9467 8 27.2 8L4.8 8C4.05326 8 3.6799 8 3.39468 8.14532C3.1438 8.27316 2.93982 8.47713 2.81199 8.72801C2.66667 9.01323 2.66667 9.3866 2.66667 10.1333Z',
  },
} as const satisfies Record<string, KitIconArt>;

/* ──────────────────────────────────────────────────────────────────────────
   Brand marks.

   Separate from ICONS above because these are FILLED, not stroked: the kit's
   `Social icon` exports carry `fill` paths with no stroke at all, so KitIcon's
   stroke/strokeWidth treatment renders them as hollow outlines. Same idea
   otherwise — path data verbatim from the export, with the baked #737373
   swapped for currentColor so the caller picks the colour with a token.
   ────────────────────────────────────────────────────────────────────────── */

export type BrandIconArt = {
  readonly w: number;
  readonly h: number;
  /** The icon frame these units were exported against. */
  readonly frame: number;
  readonly d: string;
  /** X's mark is a compound path and needs the even-odd rule to keep its hole. */
  readonly evenOdd?: boolean;
};

export function BrandIcon({
  art,
  frame,
  className,
}: {
  art: BrandIconArt;
  /** Side of the icon frame in the design, e.g. 20 in the footer. */
  frame: number;
  className?: string | undefined;
}) {
  const scale = frame / art.frame;
  return (
    <svg
      viewBox={`0 0 ${art.w} ${art.h}`}
      width={art.w * scale}
      height={art.h * scale}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...(className ? { className } : {})}
    >
      <path
        d={art.d}
        {...(art.evenOdd ? { fillRule: 'evenodd' as const, clipRule: 'evenodd' as const } : {})}
      />
    </svg>
  );
}

/**
 * Instagram, carried over verbatim from the legacy footer
 * (src/components/landing/home/home-landing.tsx:932).
 *
 * ⚠️ NOT design art. The Figma social row (104:7422) draws X, LinkedIn and
 * Facebook only, and `search_design_system` finds no Instagram mark in any
 * connected library — so there is nothing to export. This is the shape the site
 * already shipped rather than one invented here, which is the reason it is a
 * hand-shaped outline sitting next to filled brand marks.
 *
 * TODO(design): ask for an Instagram mark on 104:7422, then move this into
 * BRAND_ICONS with the others and delete this component.
 *
 * One fix on the way over: the original's aperture dot is a zero-length <line>
 * with the default butt cap, which renders nothing. `strokeLinecap="round"`
 * is what actually makes it a dot.
 */
export function InstagramMark({ frame = 20, className }: { frame?: number; className?: string }) {
  return (
    <svg
      width={frame}
      height={frame}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...(className ? { className } : {})}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <line x1="17.5" y1="6.5" x2="17.5" y2="6.5" />
    </svg>
  );
}

/** Figma 104:7423–104:7425 — the three marks in the footer's social row. */
export const BRAND_ICONS = {
  x: {
    w: 18.2809,
    h: 17.5,
    frame: 20,
    evenOdd: true,
    d: 'M12.2784 17.5L7.86409 11.208L2.33792 17.5H0L6.82685 9.72928L0 0H6.00246L10.1629 5.93013L15.3757 0H17.7137L11.2036 7.41084L18.2809 17.5H12.2784ZM14.8819 15.7262H13.3079L3.34755 1.77386H4.92175L8.91096 7.36047L9.6008 8.32989L14.8819 15.7262Z',
  },
  linkedin: {
    w: 20,
    h: 20,
    frame: 20,
    d: 'M18.5195 0H1.47656C0.660156 0 0 0.644531 0 1.44141V18.5547C0 19.3516 0.660156 20 1.47656 20H18.5195C19.3359 20 20 19.3516 20 18.5586V1.44141C20 0.644531 19.3359 0 18.5195 0ZM5.93359 17.043H2.96484V7.49609H5.93359V17.043ZM4.44922 6.19531C3.49609 6.19531 2.72656 5.42578 2.72656 4.47656C2.72656 3.52734 3.49609 2.75781 4.44922 2.75781C5.39844 2.75781 6.16797 3.52734 6.16797 4.47656C6.16797 5.42187 5.39844 6.19531 4.44922 6.19531ZM17.043 17.043H14.0781V12.4023C14.0781 11.2969 14.0586 9.87109 12.5352 9.87109C10.9922 9.87109 10.7578 11.0781 10.7578 12.3242V17.043H7.79688V7.49609H10.6406V8.80078H10.6797C11.0742 8.05078 12.043 7.25781 13.4844 7.25781C16.4883 7.25781 17.043 9.23438 17.043 11.8047V17.043V17.043Z',
  },
  facebook: {
    w: 20,
    h: 19.8785,
    frame: 20,
    d: 'M20 10C20 4.47715 15.5229 0 10 0C4.47715 0 0 4.47715 0 10C0 14.9912 3.65684 19.1283 8.4375 19.8785V12.8906H5.89844V10H8.4375V7.79688C8.4375 5.29063 9.93047 3.90625 12.2146 3.90625C13.3084 3.90625 14.4531 4.10156 14.4531 4.10156V6.5625H13.1922C11.95 6.5625 11.5625 7.3334 11.5625 8.125V10H14.3359L13.8926 12.8906H11.5625V19.8785C16.3432 19.1283 20 14.9912 20 10Z',
  },
} as const satisfies Record<string, BrandIconArt>;
