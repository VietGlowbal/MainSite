/**
 * Metric — Untitled UI `_Metric item` (Figma 104:7158 and its three siblings).
 *
 * A big number over a short label. The kit nests three flex columns inside each
 * other (gaps 16 / 12 / 4), but every level except the middle one has a single
 * child, so the only gap that has any effect is the 12px between number and
 * label. Flattened to one column rather than reproducing dead wrappers.
 *
 * 283.5px is the kit component's own width, not a token: four of them plus the
 * hairline dividers is what fills the 1216px content box of a 1280 container.
 * It only applies once the row goes horizontal — stacked, each one takes the
 * width it is given.
 *
 * ⚠️ `value` has to stay short. The column is sized for the kit's "400+" and
 * "10k"; at 60px it holds roughly ten glyphs. A value that wraps takes its
 * label down a line with it and that one column falls out of step with the rest
 * of the row — which is exactly what "150 triệu USD" did in Vietnamese. Put the
 * unit in `label` instead. `label` may wrap freely; the row is top-aligned, so
 * a two-line label only makes its own item taller.
 */
export function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex w-full flex-col items-center gap-gb-lg lg:w-[283.5px]">
      <p className="w-full text-center font-display text-gb-display-xl font-semibold tracking-gb-display-tight text-brand">
        {value}
      </p>
      <p className="w-full text-center text-gb-lg font-semibold text-fg">{label}</p>
    </div>
  );
}
