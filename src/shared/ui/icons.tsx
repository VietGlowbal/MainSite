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
  readonly d: string;
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
      <path d={art.d} />
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
  /** Figma 2:467 — trails the "Learn more" link on a feature card. */
  arrowRight: {
    w: 13.3333,
    h: 13.3333,
    frame: 20,
    strokeWidth: 1.66667,
    d: 'M0.833333 6.66667H12.5M6.66667 12.5L12.5 6.66667L6.66667 0.833333',
  },
} as const satisfies Record<string, KitIconArt>;
