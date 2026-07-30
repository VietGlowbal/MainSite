'use client';

import { useId } from 'react';

/**
 * RangeHistogram — a two-handle range with a distribution drawn behind it.
 *
 * Reflection's budget question. The bars are not decoration: they show where
 * other students' budgets actually sit, so a student picking a band can see
 * whether they are in the ordinary range or at an edge.
 *
 * TWO NATIVE SLIDERS, NOT A CUSTOM DRAG. Both handles are real
 * `<input type="range">` elements stacked over the bars. That gets keyboard
 * support, screen-reader announcements, touch targets and RTL for free — all of
 * which a div-and-pointermove implementation has to rebuild, usually badly. The
 * cost is that the two inputs overlap, so pointer events are disabled on the
 * track and re-enabled on the thumbs alone.
 *
 * The handles cannot cross. Each clamps against the other rather than swapping,
 * because swapping mid-drag moves the handle out from under the finger.
 */

export function RangeHistogram({
  min,
  max,
  step,
  low,
  high,
  onChange,
  /**
   * Relative frequencies, left to right. Any length; scaled to the tallest.
   * Real data or nothing — a made-up curve here would be a claim about other
   * students that we cannot support.
   */
  distribution,
  label,
  formatValue,
  className,
}: {
  min: number;
  max: number;
  step: number;
  low: number;
  high: number;
  onChange: (next: { low: number; high: number }) => void;
  distribution: readonly number[];
  label: string;
  /** Renders the caption, e.g. "270.000.000 - 500.000.000 VND". */
  formatValue: (low: number, high: number) => string;
  className?: string | undefined;
}) {
  const id = useId();
  const peak = Math.max(1, ...distribution);
  const span = Math.max(1, max - min);

  const percent = (value: number) => ((value - min) / span) * 100;

  return (
    <div className={`flex flex-col gap-gb-lg ${className ?? ''}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-gb-md">
        <span id={`${id}-label`} className="text-gb-sm font-semibold text-fg-secondary">
          {label}
        </span>
        <span className="rounded-gb-sm bg-surface-muted px-gb-md py-gb-xxs text-gb-sm tabular-nums text-fg-tertiary">
          {formatValue(low, high)}
        </span>
      </div>

      <div className="relative">
        {/* The distribution. Purely illustrative, so it is hidden from
            assistive tech — the two sliders below carry the actual values. */}
        <div aria-hidden="true" className="flex h-gb-7xl items-end gap-[2px]">
          {distribution.map((value, index) => {
            // A bar is "in range" when its centre falls inside the selection.
            const centre = min + ((index + 0.5) / distribution.length) * span;
            const selected = centre >= low && centre <= high;
            return (
              <span
                key={index}
                className={`flex-1 rounded-gb-xs ${selected ? 'bg-brand' : 'bg-line-strong'}`}
                style={{ height: `${Math.max(4, (value / peak) * 100)}%` }}
              />
            );
          })}
        </div>

        {/* Track */}
        <div className="relative mt-gb-lg h-gb-md">
          <span className="absolute inset-x-0 top-1/2 h-[4px] -translate-y-1/2 rounded-gb-full bg-line" />
          <span
            className="absolute top-1/2 h-[4px] -translate-y-1/2 rounded-gb-full bg-brand"
            style={{ left: `${percent(low)}%`, right: `${100 - percent(high)}%` }}
          />

          {/* Both inputs cover the full track. `pointer-events-none` on the
              input with `auto` on the thumb is what stops the upper one
              swallowing every click meant for the lower. */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={low}
            /* aria-label only. Adding aria-labelledby as well would win over
               it, and both handles would announce as plain "Total budget" —
               the exact ambiguity these labels exist to remove. */
            aria-label={`${label}, lower bound`}
            onChange={(event) => {
              const next = Math.min(Number(event.target.value), high);
              onChange({ low: next, high });
            }}
            className="gb-range absolute inset-x-0 top-1/2 h-gb-4xl -translate-y-1/2 w-full appearance-none bg-transparent"
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={high}
            aria-label={`${label}, upper bound`}
            onChange={(event) => {
              const next = Math.max(Number(event.target.value), low);
              onChange({ low, high: next });
            }}
            className="gb-range absolute inset-x-0 top-1/2 h-gb-4xl -translate-y-1/2 w-full appearance-none bg-transparent"
          />
        </div>
      </div>
    </div>
  );
}
