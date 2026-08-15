/**
 * MetricBar — one labelled horizontal track, the unit `HorizontalBarChart`
 * repeats. Exported on its own too, for the rare spot that needs a single
 * bar (a KPI tile) rather than a whole chart.
 *
 * `value === null` never draws a zero-length bar — a null score and a
 * genuine zero are different facts (implementation spec §13, §19: never
 * print a fabricated number), so the track stays visibly empty with an
 * "N/A" caption instead of collapsing to what would look like the worst
 * possible score.
 */
export type MetricBarTone = 'brand' | 'neutral';

const TONE_FILL: Record<MetricBarTone, string> = {
  brand: 'bg-brand',
  neutral: 'bg-[var(--color-gb-neutral-600)]',
};

export function MetricBar({
  label,
  value,
  caption,
  tone = 'brand',
  className,
}: {
  label: string;
  /** 0-100, or null when the underlying framework has nothing to report. */
  value: number | null;
  caption?: string | undefined;
  tone?: MetricBarTone;
  className?: string | undefined;
}) {
  const pct = value === null ? null : Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className={`flex flex-col gap-gb-xs ${className ?? ''}`}>
      <div className="flex items-baseline justify-between gap-gb-md">
        <span className="text-gb-sm font-medium text-fg-secondary">{label}</span>
        <span className="text-gb-sm tabular-nums text-fg-tertiary">{pct === null ? 'N/A' : `${pct}%`}</span>
      </div>
      <div
        role="img"
        aria-label={`${label}: ${pct === null ? 'not available yet' : `${pct}%`}`}
        className={`h-gb-md w-full overflow-hidden rounded-gb-full ${
          pct === null ? 'border border-dashed border-line' : 'bg-surface-muted'
        }`}
      >
        {pct !== null ? (
          <div className={`h-full rounded-gb-full ${TONE_FILL[tone]}`} style={{ width: `${pct}%` }} />
        ) : null}
      </div>
      {caption ? <span className="text-gb-xs text-fg-tertiary">{caption}</span> : null}
    </div>
  );
}
