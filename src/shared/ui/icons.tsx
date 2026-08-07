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
  filled = false,
}: {
  art: KitIconArt;
  /** Side of the icon frame in the design, e.g. 24 inside a 48px featured icon. */
  frame: number;
  className?: string | undefined;
  /**
   * Paint the interior in `currentColor` as well as the stroke.
   *
   * Only meaningful for icons whose path is a closed shape — `heart`, for its
   * saved state. Every other icon here is an open stroke, where a fill would
   * flood the area the path happens to enclose. Defaults to off, which is the
   * behaviour every existing caller already relies on.
   */
  filled?: boolean | undefined;
}) {
  const scale = frame / art.frame;
  return (
    <svg
      viewBox={`0 0 ${art.w} ${art.h}`}
      width={art.w * scale}
      height={art.h * scale}
      fill={filled ? 'currentColor' : 'none'}
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
  /**
   * Figma I375:21812 — the paper plane in the 56px featured icon on the mentor
   * profile's booking card (375:21811).
   *
   * The instance carries a check-circle variant at the same two sizes; the
   * visible one is this. Exported at the xl step (28px icon in a 56px tile),
   * which is why `frame` is 28 and not 24.
   */
  send: {
    w: 24.4373,
    h: 24.4373,
    frame: 28,
    strokeWidth: 2,
    d: 'M10.4763 13.961L22.7263 1.71095M10.6252 14.3437L13.6913 22.228C13.9614 22.9226 14.0965 23.2699 14.2911 23.3713C14.4598 23.4592 14.6607 23.4593 14.8295 23.3716C15.0243 23.2704 15.1597 22.9233 15.4306 22.2291L23.1194 2.52668C23.3639 1.89997 23.4862 1.58662 23.4193 1.38639C23.3612 1.2125 23.2248 1.07603 23.0509 1.01794C22.8507 0.951051 22.5373 1.07334 21.9106 1.3179L2.20823 9.00663C1.51398 9.27756 1.16685 9.41303 1.06569 9.60775C0.977992 9.77655 0.978111 9.97751 1.066 10.1462C1.16739 10.3408 1.51468 10.4759 2.20925 10.746L10.0936 13.8121C10.2346 13.8669 10.3051 13.8944 10.3644 13.9367C10.417 13.9742 10.4631 14.0202 10.5006 14.0728C10.5429 14.1322 10.5703 14.2027 10.6252 14.3437Z',
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
  /**
   * ⚠️ NOT A FIGMA EXPORT — see the note on `plus`.
   *
   * The upload frames draw an upload-cloud glyph, but the file has no export of
   * one, so these two are constructed to the kit's conventions. Same coordinate
   * trap as `plus`: `viewBox` is `0 0 w h`, the STROKED bounds, so a path
   * written in the 24px design frame renders clipped. Both were laid out at 24
   * with strokeWidth 2 (half-stroke 1) and then translated so the stroked box
   * starts at the origin — for `uploadCloud` that is x−3, y−6.
   */
  uploadCloud: {
    w: 18,
    h: 15,
    frame: 24,
    strokeWidth: 2,
    d: ['M9 9V1', 'M5.5 4.5L9 1L12.5 4.5', 'M1 9v3a2 2 0 002 2h12a2 2 0 002-2V9'],
  },
  /** ⚠️ NOT A FIGMA EXPORT. Removes an uploaded file. Translated x−2, y−2. */
  trash: {
    w: 20,
    h: 21,
    frame: 24,
    strokeWidth: 2,
    d: [
      'M1 4h18',
      'M6 4V2a1 1 0 011-1h6a1 1 0 011 1v2',
      'M17 4v14a2 2 0 01-2 2H5a2 2 0 01-2-2V4',
      'M8 9v6',
      'M12 9v6',
    ],
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
   * ⚠️ NOT A FIGMA EXPORT, same story as `plus`/`trash`/`close`/`search` above
   * — the AI Strategy Dashboard's Planner needs a calendar glyph (Final
   * Deadline stat, the planner table's Deadline column) and the file has no
   * export of one. Straight lines only, following this file's own convention
   * for hand-built icons: a body rect, a header divider, and two ring tabs.
   */
  calendar: {
    w: 20,
    h: 20,
    frame: 24,
    strokeWidth: 2,
    d: ['M1 4H19V19H1V4Z', 'M1 8H19', 'M6 1V6', 'M14 1V6'],
  },
  /**
   * ⚠️ NOT A FIGMA EXPORT. Adapted from Feather Icons' `edit-2` (MIT
   * licensed), the standard "square + pencil" glyph — used for the Planner's
   * Next Priority stat and the Personal Statement category card.
   */
  edit02: {
    w: 24,
    h: 24,
    frame: 24,
    strokeWidth: 2,
    d: [
      'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7',
      'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
    ],
  },
  /**
   * ⚠️ NOT A FIGMA EXPORT. Adapted from Feather Icons' `users` (MIT
   * licensed) — the Planner's Activities category card.
   */
  usersTwo: {
    w: 24,
    h: 22,
    frame: 24,
    strokeWidth: 2,
    d: [
      'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2',
      'M9 11a4 4 0 100-8 4 4 0 000 8',
      'M23 21v-2a4 4 0 00-3-3.87',
      'M16 3.13a4 4 0 010 7.75',
    ],
  },
  /**
   * ⚠️ NOT A FIGMA EXPORT. No Feather equivalent either, so this is fully
   * hand-built, matching the straight-line-only simplicity of `calendar`
   * above: a flattened diamond mortarboard, a band underneath, and a tassel
   * — for the Planner's Academics category card.
   */
  graduationCap: {
    w: 24,
    h: 20,
    frame: 24,
    strokeWidth: 2,
    d: ['M12 3L22 8L12 13L2 8Z', 'M7 9.5V16H17V9.5', 'M12 13V17.5', 'M12 17.5L14 19'],
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
  /**
   * Figma 522:8641 — the save-to-shortlist heart added to the university detail
   * header (522:8643) after that page was first built.
   *
   * Exported at 32px with no inset, like gift01 above, so `frame` is 32. The
   * export also carries a `<rect rx="16" fill="#FFF1F2">` behind the path — the
   * rose-50 pill the heart sits in. That is a background, not artwork, so it is
   * dropped here and drawn with `bg-brand-subtle rounded-gb-full` on the button
   * instead; baking it into the icon would ship a colour a token cannot reach.
   */
  heart: {
    w: 32,
    h: 32,
    frame: 32,
    strokeWidth: 2,
    d: 'M15.9932 9.21872C13.9938 6.8813 10.6597 6.25255 8.15469 8.39292C5.64964 10.5333 5.29697 14.1119 7.2642 16.6433C8.89982 18.748 13.8498 23.187 15.4721 24.6237C15.6536 24.7845 15.7444 24.8648 15.8502 24.8964C15.9426 24.924 16.0437 24.924 16.1361 24.8964C16.2419 24.8648 16.3327 24.7845 16.5142 24.6237C18.1365 23.187 23.0865 18.748 24.7221 16.6433C26.6893 14.1119 26.3797 10.5108 23.8316 8.39292C21.2835 6.27506 17.9925 6.8813 15.9932 9.21872Z',
  },
  /**
   * Generic close ("X") glyph — NOT FROM A FIGMA EXPORT, unlike every other
   * entry here. There is no kit export for one, and a dialog's close button
   * is a functional necessity, not a design decision that needs the frame.
   * Native 24px box in a 24px frame, same stroke treatment as the rest so it
   * does not read as a one-off inline SVG next to them.
   */
  close: {
    w: 24,
    h: 24,
    frame: 24,
    strokeWidth: 2,
    d: ['M18 6L6 18', 'M6 6L18 18'],
  },
  /**
   * Magnifier ("search-lg") — NOT FROM A FIGMA EXPORT, same story as `close`
   * and `trash`. Used on the guide's call-to-action when the step's link goes
   * to a directory the student searches rather than a page they fill in.
   *
   * Coordinates are the standard 24px glyph translated to the origin (x−2,
   * y−2), which is the convention the exported entries above follow: the
   * viewBox is the stroked bounds of the artwork, not the icon frame.
   */
  search: {
    w: 20,
    h: 20,
    frame: 24,
    strokeWidth: 2,
    d: [
      'M19 19L14.65 14.65',
      'M17 9C17 13.4183 13.4183 17 9 17C4.58172 17 1 13.4183 1 9C1 4.58172 4.58172 1 9 1C13.4183 1 17 4.58172 17 9Z',
    ],
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

/**
 * SearchMark — the magnifier on every search field.
 *
 * ⚠️ NOT TRACED FROM A FRAME, and not part of `ICONS` for that reason. It is
 * the glyph `/universities` has shipped since its rebuild, lifted here verbatim
 * when `MultiSelect` needed the same one (Figma 375:11536 draws a magnifier in
 * the filter field but the asset was never exported). Two hand-drawn copies of
 * one icon is the thing this file exists to prevent, so it lives here and both
 * callers import it.
 *
 * Stroke-based, so it cannot be a `KitIconArt` entry — those are filled paths.
 * If the real Untitled UI `search-lg` is ever exported, replace this body and
 * both callers pick it up.
 */
export function SearchMark({ frame = 20 }: { frame?: number }) {
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
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/**
 * Figma 375:21653 — the verified seal beside a mentor's name.
 *
 * Not a `KitIconArt` entry: those render one stroke colour through
 * `currentColor`, and this is two filled paths in two colours — a scalloped
 * seal with a white tick punched over it. The seal takes `currentColor` so the
 * caller sets it with `text-fg-verified`; only the tick is hard-white, which is
 * what the design draws regardless of the seal's colour.
 *
 * `title` renders an accessible name, because "verified" is information and not
 * decoration — a mentor whose documents Glowbal has checked is a claim a
 * screen-reader user needs to hear. Callers that already say "verified" in
 * adjacent text should pass `title={null}` so it is not announced twice.
 */
export function VerifiedMark({
  frame = 16,
  title = 'Verified advisor',
  className,
}: {
  frame?: number;
  title?: string | null;
  className?: string | undefined;
}) {
  return (
    <svg
      width={frame}
      height={frame}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...(title ? { role: 'img' } : { 'aria-hidden': true, focusable: false })}
      {...(className ? { className } : {})}
    >
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M9.91068 1.42318C10.1917 1.70456 10.573 1.86283 10.9707 1.86318H12.3647C12.7625 1.86318 13.144 2.02121 13.4253 2.30252C13.7066 2.58382 13.8647 2.96535 13.8647 3.36318V4.75618C13.8647 5.15418 14.0227 5.53618 14.3047 5.81718L15.2887 6.80218C15.4281 6.94148 15.5386 7.10688 15.6141 7.28893C15.6895 7.47098 15.7284 7.66612 15.7284 7.86318C15.7284 8.06024 15.6895 8.25538 15.6141 8.43743C15.5386 8.61948 15.4281 8.78488 15.2887 8.92418L14.3037 9.90918C14.0223 10.1902 13.864 10.5715 13.8637 10.9692V12.3632C13.8637 12.761 13.7056 13.1425 13.4243 13.4238C13.143 13.7051 12.7615 13.8632 12.3637 13.8632H10.9707C10.573 13.8635 10.1917 14.0218 9.91068 14.3032L8.92468 15.2882C8.64343 15.5691 8.26218 15.7269 7.86468 15.7269C7.46718 15.7269 7.08593 15.5691 6.80468 15.2882L5.81868 14.3022C5.53765 14.0208 5.15637 13.8625 4.75868 13.8622H3.36468C2.96703 13.8622 2.58565 13.7043 2.30437 13.4232C2.0231 13.1421 1.86495 12.7608 1.86468 12.3632V10.9702C1.86433 10.5725 1.70606 10.1912 1.42468 9.91018L0.43968 8.92318C0.30029 8.78388 0.189715 8.61848 0.114273 8.43643C0.0388305 8.25438 0 8.05924 0 7.86218C0 7.66512 0.0388305 7.46998 0.114273 7.28793C0.189715 7.10588 0.30029 6.94048 0.43968 6.80118L1.42468 5.81618C1.70582 5.53539 1.86407 5.15452 1.86468 4.75718V3.36318C1.86468 2.96535 2.02272 2.58382 2.30402 2.30252C2.58532 2.02121 2.96686 1.86318 3.36468 1.86318H4.75768C5.15537 1.86283 5.53665 1.70456 5.81768 1.42318L6.80468 0.43918C7.08597 0.157973 7.46743 0 7.86518 0C8.26293 0 8.64439 0.157973 8.92568 0.43918L9.91168 1.42518L9.91068 1.42318Z"
      />
      <path
        className="fill-white"
        fillRule="evenodd"
        clipRule="evenodd"
        /* The tick, exported at 7x7 and offset to the seal's centre. */
        transform="translate(4.43 4.36)"
        d="M6.88326 1.1534C6.99014 0.985519 7.02596 0.782055 6.98282 0.587767C6.93969 0.393479 6.82114 0.224284 6.65326 0.117401C6.48538 0.0105191 6.28191 -0.0252947 6.08763 0.0178387C5.89334 0.060972 5.72414 0.179519 5.61726 0.347401L2.68026 4.9624L1.33626 3.2824C1.21201 3.12698 1.0311 3.02729 0.833346 3.00526C0.635589 2.98322 0.437178 3.04065 0.281761 3.1649C0.126344 3.28916 0.0266528 3.47006 0.00461728 3.66782C-0.0174183 3.86557 0.0400075 4.06398 0.164261 4.2194L2.16426 6.7194C2.2388 6.81269 2.33453 6.88683 2.4435 6.93566C2.55246 6.98449 2.67152 7.0066 2.79075 7.00014C2.90998 6.99369 3.02595 6.95886 3.12901 6.89855C3.23207 6.83824 3.31923 6.75419 3.38326 6.6534L6.88326 1.1534V1.1534Z"
      />
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
