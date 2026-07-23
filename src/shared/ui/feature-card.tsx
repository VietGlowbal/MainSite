import Link from 'next/link';
import { ICONS, KitIcon } from './icons';

/**
 * FeatureCard — Untitled UI `_Feature text` (Figma 104:7220 and its three
 * siblings): a filled rose icon tile, a title, a paragraph, and a text link.
 *
 * Two details worth not losing:
 *
 *  - The 64px gap between the icon and the text is deliberate, not a mistake in
 *    the design. It is what gives the row its airiness, and because the cards
 *    stretch to the tallest one, it is also what keeps four cards of unequal
 *    copy length looking deliberate rather than ragged.
 *  - The card has NO corner radius. Everything else in this kit is rounded, so
 *    the square corners read as an oversight until you check the node.
 *
 * The icon tile reuses `shadow-gb-xs-skeuomorphic` and the 2px white/12 border
 * from `Button` — same kit treatment, same tokens, deliberately not re-derived.
 *
 * The card carries no width of its own: the row it sits in owns the layout.
 * The design puts `flex-[1_0_0] min-w-[280px]` on each card inside a wrapping
 * flex row, which is right at 1280 and wrong just below it — four cards drop to
 * three plus one, and the orphan grows to the full container. A grid gives the
 * same four columns at 1280 and a clean 2x2 under it.
 */
export function FeatureCard({
  icon,
  title,
  body,
  href,
  actionLabel,
}: {
  /** A key of `ICONS` — the 24px glyph inside the 48px tile. */
  icon: keyof typeof ICONS;
  title: string;
  body: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-col gap-gb-7xl bg-surface-muted p-gb-3xl">
      <span className="flex size-[48px] shrink-0 items-center justify-center rounded-gb-lg border-2 border-white/12 bg-brand text-on-brand shadow-gb-xs-skeuomorphic">
        <KitIcon art={ICONS[icon]} frame={24} />
      </span>

      <div className="flex flex-col gap-gb-xl">
        <div className="flex flex-col gap-gb-xs">
          <p className="text-gb-lg font-semibold text-fg">{title}</p>
          <p className="text-gb-md text-fg-tertiary">{body}</p>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-gb-sm self-start text-gb-md font-semibold text-fg-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {actionLabel}
          <KitIcon art={ICONS.arrowRight} frame={20} />
        </Link>
      </div>
    </div>
  );
}
