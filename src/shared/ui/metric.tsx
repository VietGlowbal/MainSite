/**
 * Metric — Untitled UI `_Metric item` (Figma 375:9889 and its four siblings).
 *
 * A big number over a short label. The kit nests three flex columns inside each
 * other (gaps 16 / 12 / 4), but every level except the middle one has a single
 * child, so the only gap that has any effect is the 12px between number and
 * label. Flattened to one column rather than reproducing dead wrappers.
 *
 * ⚠️ RESIZED on the "Khanh Linh - Chi" canvas, and the two changes go together:
 * the row went from four columns to five, so the item narrowed 283.5 -> 240 and
 * the number dropped 60px -> 48px to keep fitting. Five 240s plus four hairlines
 * is 1204, which is the content width the frame draws. Reverting one without the
 * other overflows the container.
 *
 * 240px is the kit component's own width, not a token, and it only applies once
 * the row goes horizontal — stacked, each one takes the width it is given.
 *
 * The 48px step is `display-lg` in our tokens. Its 54px leading is 6px tighter
 * than the kit's, because that token was set from the Home hero, which hand-sets
 * its leading. On a single-line number the difference does not render, so this
 * reuses the token rather than adding one.
 *
 * ⚠️ `value` has to stay short. At 48px the 240px column holds roughly nine
 * glyphs. A value that wraps takes its label down a line with it and that one
 * column falls out of step with the rest of the row — which is exactly what
 * "150 triệu USD" did in Vietnamese. Put the unit in `label` instead. `label`
 * may wrap freely; the row is top-aligned, so a two-line label only makes its
 * own item taller.
 */
export function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex w-full flex-col items-center gap-gb-lg xl:w-[240px]">
      <p className="w-full text-center font-display text-gb-display-lg font-semibold tracking-gb-display-tight text-brand">
        {value}
      </p>
      <p className="w-full text-center text-gb-sm font-semibold text-fg">{label}</p>
    </div>
  );
}
