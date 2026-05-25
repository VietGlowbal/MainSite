/**
 * Glowbal sliders — single-thumb and dual-thumb range inputs styled
 * with a pink filled track.
 *
 * Both components render native <input type="range"> elements for
 * accessibility (full keyboard support, screen reader labels) and paint
 * the filled portion of the track via a CSS gradient driven by two
 * custom properties (`--glowbal-slider-from` and `--glowbal-slider-to`)
 * set inline by the React wrapper.
 *
 *   <RangeSlider />        — one thumb, ceiling-style
 *   <DualRangeSlider />    — two thumbs, "between min and max" style
 */

'use client';

import { useId, useRef } from 'react';

// ── Single-thumb (kept for back-compat with anywhere that just wants
//    a "max" filter) ───────────────────────────────────────────────────────

export interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onValueChange: (value: number) => void;
  /** Reset / current-value text shown above the slider. */
  valueLabel?: string;
  /** Tick labels at the start and end of the track (e.g. "1" / "1000+"). */
  startLabel?: string;
  endLabel?: string;
  className?: string;
  /** Accessible name for screen readers. */
  ariaLabel?: string;
}

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  valueLabel,
  startLabel,
  endLabel,
  className = '',
  ariaLabel,
}: RangeSliderProps) {
  const id = useId();
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div className={className}>
      {valueLabel ? (
        <p className="mb-1 text-xs font-medium text-slate-500">{valueLabel}</p>
      ) : null}
      <div
        className="relative h-5"
        style={
          {
            // Single-thumb sliders fill from 0% up to the current value.
            '--glowbal-slider-from': '0%',
            '--glowbal-slider-to': `${pct}%`,
          } as React.CSSProperties
        }
      >
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={ariaLabel}
          onChange={(e) => onValueChange(Number(e.target.value))}
          className="glowbal-range-input absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
        />
      </div>
      {(startLabel || endLabel) && (
        <div className="mt-1 flex justify-between text-[0.65rem] font-medium text-slate-400">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      )}
    </div>
  );
}

// ── Dual-thumb ─────────────────────────────────────────────────────────────

export interface DualRangeSliderProps {
  min: number;
  max: number;
  step?: number;
  /** Tuple of `[low, high]` — both inclusive. */
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  startLabel?: string;
  endLabel?: string;
  className?: string;
  /** Accessible name prefixes for each thumb (e.g. "QS rank min"). */
  ariaLabelMin?: string;
  ariaLabelMax?: string;
}

/**
 * Dual-thumb range slider. Renders two stacked native range inputs and
 * a connector div that fills only the segment *between* the two thumbs.
 * Pointer events are routed to whichever thumb is closer to the click,
 * which avoids the classic "thumbs stuck together" usability trap.
 */
export function DualRangeSlider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  startLabel,
  endLabel,
  className = '',
  ariaLabelMin,
  ariaLabelMax,
}: DualRangeSliderProps) {
  const [lo, hi] = value;
  const minThumbRef = useRef<HTMLInputElement>(null);
  const maxThumbRef = useRef<HTMLInputElement>(null);

  const span = max - min || 1;
  const fromPct = ((lo - min) / span) * 100;
  const toPct = ((hi - min) / span) * 100;

  const setLo = (next: number) => {
    // Never let the low thumb pass the high thumb. Clamp to (hi - step) so
    // we always preserve a 1-step gap; users can still jam them together
    // visually but the values stay distinct.
    const clamped = Math.min(next, hi);
    if (clamped !== lo) onValueChange([clamped, hi]);
  };

  const setHi = (next: number) => {
    const clamped = Math.max(next, lo);
    if (clamped !== hi) onValueChange([lo, clamped]);
  };

  return (
    <div className={className}>
      <div
        className="glowbal-dual-range relative h-5"
        style={
          {
            '--glowbal-slider-from': `${fromPct}%`,
            '--glowbal-slider-to': `${toPct}%`,
          } as React.CSSProperties
        }
      >
        {/* Static track + filled connector */}
        <span
          aria-hidden
          className="glowbal-dual-range-track pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200"
        />
        <span
          aria-hidden
          className="glowbal-dual-range-fill pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
          style={{
            left: `${fromPct}%`,
            right: `${100 - toPct}%`,
          }}
        />
        {/* Two overlapping native range inputs. The min thumb is layered
            above the max thumb when they're close to the high end (and
            vice versa) so users can always grab whichever one is more
            visible — see the CSS `z-index` rules. */}
        <input
          ref={minThumbRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          aria-label={ariaLabelMin}
          onChange={(e) => setLo(Number(e.target.value))}
          className="glowbal-dual-range-input absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
          // Higher z-index when the min thumb is past the midpoint so it
          // doesn't get trapped beneath the max thumb.
          style={{ zIndex: lo > (min + max) / 2 ? 4 : 3 }}
        />
        <input
          ref={maxThumbRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          aria-label={ariaLabelMax}
          onChange={(e) => setHi(Number(e.target.value))}
          className="glowbal-dual-range-input absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
          style={{ zIndex: hi <= (min + max) / 2 ? 4 : 3 }}
        />
      </div>
      {(startLabel || endLabel) && (
        <div className="mt-1 flex justify-between text-[0.65rem] font-medium text-slate-400">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      )}
    </div>
  );
}
