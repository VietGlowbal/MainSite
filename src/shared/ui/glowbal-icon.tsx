/**
 * GlowbalIcon — the product's own two-tone icon set — and IconLabel, the only
 * two approved ways to pair one with text.
 *
 * Source: the icon plan handoff (v1.0). The art in `glowbal-icons.ts` is copied
 * from it verbatim and is generated — change it in the plan, not by hand. This
 * component is the handoff's `GlowbalIcon.tsx` adapted to this codebase:
 *
 *  - TONES COME FROM TOKENS. Every element is `ink` (the shape) or `accent` (the
 *    one detail that names the function), painted with `stroke-icon-ink` /
 *    `stroke-icon-accent`. Those resolve through `--gb-icon-*` in tokens.css,
 *    and the SURFACE decides their value, never the call site:
 *
 *        (default)               ink #16181d · accent brand rose
 *        data-surface="dark"     white       · #ff3b47 (rose is 4.2:1 there)
 *        data-surface="brand"    both follow currentColor
 *        data-surface="light"    back to the default, for a white card inside
 *                                a dark or brand band
 *
 *    `brand` is not in the plan. The application pages head every screen with
 *    a solid rose band, where a rose accent simply disappears; following the
 *    text colour also lets an icon track its nav item's rest/hover/active state.
 *
 *  - An attribute, not the plan's `.on-dark` class: one mechanism, and no new
 *    global class name for the legacy cascade to collide with.
 *
 *  - The accessible name is `aria-label`, which DomTranslator translates, rather
 *    than an svg `<title>`, which browsers also show as a hover tooltip.
 *
 *  - IconLabel renders only spans, so it is valid inside a `<button>`, and its
 *    text sits on the site type scale — see the note on the density tables.
 *
 * KitIcon is not replaced by this and cannot be extended into it: it strokes one
 * `d` in currentColor, which has no way to carry a second tone.
 */

import { GLOWBAL_ICONS, GLOWBAL_ICON_BOX, GLOWBAL_ICON_STROKE } from './glowbal-icons';
import type { GlowbalIconName, IconElement } from './glowbal-icons';

/** 16 meta line · 20 nav · 24 list row · 32 module grid · 40 feature card · 48 empty state. Nothing between. */
export type GlowbalIconSize = 16 | 20 | 24 | 32 | 40 | 48;

/**
 * two-tone  the default: the surface's ink and accent.
 * mono      the accent painted in the ink colour. Dense tables, disabled rows,
 *           anywhere red already carries a meaning on that screen.
 * current   both tones in the surrounding TEXT colour. For a compact control
 *           whose colour carries its state — a row action that rests muted and
 *           turns red on hover — and for an icon inside a filled button, where
 *           neither ink nor rose is legible. The rule `data-surface="brand"`
 *           applies to a whole band, scoped to one icon. Not in the icon plan.
 */
export type GlowbalIconTone = 'two-tone' | 'mono' | 'current';

export function GlowbalIcon({
  name,
  size = 20,
  tone = 'two-tone',
  label,
  className,
}: {
  name: GlowbalIconName;
  size?: GlowbalIconSize | undefined;
  tone?: GlowbalIconTone | undefined;
  /**
   * Only when the icon IS the control (an icon-only button). Otherwise the text
   * beside it already names it, and the svg stays hidden from assistive tech.
   */
  label?: string | undefined;
  className?: string | undefined;
}) {
  const elements: readonly IconElement[] = GLOWBAL_ICONS[name];
  const strokeFor = (el: IconElement) => {
    if (tone === 'current') return 'stroke-current';
    return el.tone === 'accent' && tone === 'two-tone' ? 'stroke-icon-accent' : 'stroke-icon-ink';
  };

  return (
    <svg
      viewBox={`0 0 ${GLOWBAL_ICON_BOX} ${GLOWBAL_ICON_BOX}`}
      width={size}
      height={size}
      fill="none"
      strokeWidth={GLOWBAL_ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      data-icon={name}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      className={className ? `shrink-0 ${className}` : 'shrink-0'}
    >
      {elements.map((el, i) => {
        // The art is static and never reordered, so position is a stable key.
        const key = `${el.t}-${i}`;
        if (el.t === 'path') return <path key={key} d={el.d} className={strokeFor(el)} />;
        if (el.t === 'circle') {
          return <circle key={key} cx={el.cx} cy={el.cy} r={el.r} className={strokeFor(el)} />;
        }
        return (
          <rect
            key={key}
            x={el.x}
            y={el.y}
            width={el.width}
            height={el.height}
            rx={2}
            className={strokeFor(el)}
          />
        );
      })}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   IconLabel.

   Two layouts, never mixed inside one container:
     left — nav items, sidebars, dropdowns, table rows, metadata lines
     top  — feature cards, module grids, dashboard tiles, empty states
   Rule of thumb: a row among rows takes the icon on the left; a cell in a grid
   takes it on top.

   TYPE IS FITTED TO THE SITE SCALE, not the plan's measured 15px / 13px / 800.
   The owner chose this on 2026-09-15. Where the plan sat between two steps it
   is rounded toward whichever side keeps its relation to its sibling:
     row label 15 → md (16)   the plan has it one step above nav (14)
     grid title 15 → sm (14)  the plan has it one step below card (16)
     meta 13 → xs (12)        the plan has it one step below nav (14)
     weight 600 → semibold, 800 → bold (the kit publishes no 800)
     card gap 14 → lg (12)    matching the grid's 12
   Icon sizes, the 44px nav hit area and the 56px card tile are unchanged.
   ────────────────────────────────────────────────────────────────────────── */

type IconLabelCommon = {
  name: GlowbalIconName;
  label: string;
  /** Second line: under the label on `left`, body copy on `top`. */
  description?: string | undefined;
  tone?: GlowbalIconTone | undefined;
  className?: string | undefined;
};

export type IconLabelProps = IconLabelCommon &
  (
    | { layout?: 'left' | undefined; density?: 'nav' | 'row' | 'meta' | undefined }
    | { layout: 'top'; density?: 'card' | 'grid' | 'empty' | undefined }
  );

type Density = { size: GlowbalIconSize; root: string; title: string; body: string };

/* Whole class strings, so Tailwind's scanner extracts them. */
const LEFT = {
  nav: { size: 20, root: 'min-h-11 gap-gb-md', title: 'text-gb-sm font-semibold', body: 'text-gb-xs' },
  row: { size: 24, root: 'gap-gb-lg', title: 'text-gb-md font-semibold', body: 'text-gb-sm' },
  // The plan dims the whole meta line, icon included, rather than recolouring
  // the text — which is also what keeps it right on a dark or brand surface.
  meta: { size: 16, root: 'gap-gb-sm opacity-65', title: 'text-gb-xs', body: 'text-gb-xs' },
} as const satisfies Record<string, Density>;

const TOP = {
  card: { size: 40, root: 'items-start gap-gb-lg', title: 'text-gb-md font-bold', body: 'text-gb-xs' },
  grid: { size: 32, root: 'items-start gap-gb-lg', title: 'text-gb-sm font-bold', body: 'text-gb-xs' },
  // Not measured in the plan ("its own block"). Centred because an empty state
  // is the only thing in its container.
  empty: { size: 48, root: 'items-center gap-gb-xl text-center', title: 'text-gb-lg font-bold', body: 'text-gb-sm' },
} as const satisfies Record<string, Density>;

export function IconLabel(props: IconLabelProps) {
  const { name, label, description, tone = 'two-tone', className } = props;
  const extra = className ? ` ${className}` : '';

  if (props.layout === 'top') {
    const density = props.density ?? 'card';
    const d = TOP[density];
    const icon = <GlowbalIcon name={name} size={d.size} tone={tone} />;
    return (
      <span className={`flex flex-col ${d.root}${extra}`}>
        {/* The card's 56px tile, with the plan's 8px optical inset. */}
        {density === 'card' ? <span className="flex size-14 items-center pl-gb-md">{icon}</span> : icon}
        <span className="flex flex-col gap-gb-sm">
          <span className={d.title}>{label}</span>
          {description ? <span className={d.body}>{description}</span> : null}
        </span>
      </span>
    );
  }

  const d = LEFT[props.density ?? 'nav'];
  return (
    <span className={`flex items-center ${d.root}${extra}`}>
      <GlowbalIcon name={name} size={d.size} tone={tone} />
      <span className="flex min-w-0 flex-col gap-gb-xxs">
        <span className={d.title}>{label}</span>
        {description ? <span className={d.body}>{description}</span> : null}
      </span>
    </span>
  );
}
