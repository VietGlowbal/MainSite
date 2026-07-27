import { Fragment } from 'react';
import { ICONS, KitIcon, Metric, Section } from '@/shared/ui';

/**
 * Metrics — Figma 104:7148 (1440x508, white).
 *
 * ⚠️ THE NUMBERS ARE NOT THE DESIGNER'S. The frame still carries Untitled UI's
 * demo content — "400+ Projects completed", "600% Return on investment", and
 * "Global downloads" twice over — untouched English kit filler on an otherwise
 * Vietnamese page. Shipping that verbatim would have burned a review round on
 * something the designer would only tell me to delete.
 *
 * So the three figures below are lifted from the hero's own approved copy
 * (104:7126). Nothing here is invented, and the page now says the same thing
 * twice instead of contradicting itself. The design has a FOURTH slot the
 * duplicated label was filling — supply a fourth number and it is one entry in
 * the array.
 *
 * The counts were confirmed by the owner on 24/07 as 200 universities and 3,000
 * scholarships. Change them here, in the hero, and in the Features block
 * together — those three are the only places the page states them.
 *
 * Copy stays English and is translated by the dictionary, same as the hero.
 *
 * The currency sits in the third label rather than next to the number for a
 * measured reason: "150M USD" translates to "150 triệu USD", which at 60px is
 * ~430px and wraps inside the 283.5px column, dropping that label a line below
 * its neighbours. Short value, unit in the label — see the note on `Metric`.
 */
const METRICS = [
  { value: '200+', label: 'Universities covered' },
  { value: '3,000+', label: 'Open scholarships' },
  { value: '150M', label: 'Total scholarship value (USD)' },
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
        <p className="text-center text-gb-xl text-fg-tertiary">
          A short guide to how GLOWBAL takes you from a dream university to a clear scholarship
          plan.
        </p>
      </div>

      {/* Dividers are 1px hairlines between items, so they only exist while the
          row is horizontal. Stacked, the 48px gap does the separating.
          (The design draws them between items 1-2 and 2-3 but not 3-4 — an
          omission, not a pattern, so every pair gets one here.) */}
      <div className="flex w-full flex-col items-center gap-gb-6xl lg:flex-row lg:justify-center lg:gap-0">
        {METRICS.map((metric, i) => (
          <Fragment key={metric.label}>
            {i > 0 && <div aria-hidden="true" className="hidden w-px self-stretch bg-line lg:block" />}
            <Metric value={metric.value} label={metric.label} />
          </Fragment>
        ))}
      </div>
    </Section>
  );
}
