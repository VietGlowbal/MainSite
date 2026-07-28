import { Fragment } from 'react';
import { ICONS, KitIcon, Metric, Section } from '@/shared/ui';

/**
 * Metrics — Figma 375:9879 (1440x508, white) on the "Khanh Linh - Chi" canvas.
 *
 * THE DESIGNER HAS NOW FILLED THIS IN. The previous version of this frame still
 * carried Untitled UI's demo content ("400+ Projects completed", "Global
 * downloads" twice over), so the numbers here used to be the hero's catalogue
 * counts restated. They are not any more: the frame supplies five real figures,
 * and they measure ADOPTION, not catalogue size. Nothing here is derived from
 * the hero now, and the two sections no longer say the same thing twice.
 *
 * ⚠️ EVERY ONE OF THESE IS A PUBLIC CLAIM ABOUT THE COMPANY, and this section
 * ships on "/". "$2000 — Đầu tư từ quỹ Venture X" names an outside investor;
 * the other four state usage the product has not launched to earn. They are the
 * designer's own numbers, taken from the frame rather than invented here, but
 * they have not been separately confirmed as true. Raised with the owner on
 * 28/07. If any is wrong, it is one line in this array.
 *
 * Copy stays English and is translated by the dictionary, same as the hero.
 *
 * Units sit in the label rather than next to the number for a measured reason:
 * a long value wraps inside the 240px column and drops that label a line below
 * its neighbours. Short value, unit in the label — see the note on `Metric`.
 */
const METRICS = [
  { value: '7,800+', label: 'Scholarship searches run' },
  { value: '370', label: 'Regular users' },
  { value: '$2,000', label: 'Invested by Venture X' },
  { value: '150', label: 'Pilot users' },
  { value: '270', label: 'Pieces of feedback shaping the product' },
] as const;

export function HomeMetrics() {
  return (
    /* 64px of vertical padding, not the 96 the hero uses — hence padded={false}.
       The design splits this into two 1280 containers 64px apart; one container
       with the same gap between its two blocks is the same layout. */
    <Section
      padded={false}
      className="py-gb-7xl"
      containerClassName="flex flex-col items-center gap-gb-7xl"
    >
      <div className="flex w-full max-w-gb-width-xl flex-col items-center gap-gb-2xl">
        <div className="flex flex-col items-center gap-gb-3xl">
          {/* 56px is the kit component's own size, not a step on the spacing
              scale — the 28px icon sits on a 14px inset all round. */}
          <span className="flex size-[56px] items-center justify-center rounded-gb-full bg-brand-surface text-brand">
            <KitIcon art={ICONS.zapFast} frame={28} />
          </span>
          <h2 className="text-center font-display text-gb-display-md font-semibold tracking-gb-display-open text-fg">
            Standout numbers
          </h2>
        </div>
        {/* A quotation in the frame, quotation marks included. Written as a JS
            string, not JSX text: the straight quotes have to survive into the
            DOM character-for-character or DomTranslator will not match the
            dictionary key, and as bare JSX text they would need entities. */}
        <p className="text-center text-gb-xl text-fg-tertiary">
          {'"GlowBal has shown how much it invests in product quality, and how well it answers what the market actually needs"'}
        </p>
      </div>

      {/* Dividers are 1px hairlines between items, so they only exist while the
          row is horizontal. Stacked, the 48px gap does the separating.

          The row turns horizontal at xl, not lg: five 240px columns plus four
          hairlines is 1204px, which only clears the container's padding once the
          viewport reaches 1280. At lg it would overflow. `Metric` carries the
          matching breakpoint for its own width — change the two together.

          `xl:items-start` matters and is not cosmetic. The frame (375:9888) is
          items-start, and with five columns two of the labels wrap to two lines
          while three do not. Centred, the odd ones out get pushed down and the
          labels stop sharing a baseline — which the Vietnamese metric-row test
          in tests/e2e/home-preview.spec.ts fails on, by design. Stacked, the
          items still centre. */}
      <div className="flex w-full flex-col items-center gap-gb-6xl xl:flex-row xl:items-start xl:justify-center xl:gap-0">
        {METRICS.map((metric, i) => (
          <Fragment key={metric.label}>
            {i > 0 && <div aria-hidden="true" className="hidden w-px self-stretch bg-line xl:block" />}
            <Metric value={metric.value} label={metric.label} />
          </Fragment>
        ))}
      </div>
    </Section>
  );
}
