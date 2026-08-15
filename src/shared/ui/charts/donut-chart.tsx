export type DonutChartSegment = {
  key: string;
  label: string;
  /** A raw count, not a percentage — the chart computes the share itself. */
  value: number;
  /** CSS color value (a design token), e.g. `var(--color-gb-tier-safe)`. Falls back to a palette by index when omitted. */
  color?: string | undefined;
};

const DEFAULT_PALETTE = [
  'var(--color-gb-brand-600)',
  'var(--color-gb-blue-600)',
  'var(--color-gb-neutral-400)',
  'var(--color-gb-yellow-400)',
];

const SIZE = 160;
const THICKNESS = 20;
const RADIUS = (SIZE - THICKNESS) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = SIZE / 2;

/**
 * The evidence-verification / evidence-strength donuts on Proof of Me
 * (implementation spec §17) — segments are raw counts the chart shares out
 * itself, never a pre-computed percentage, so a caller can't accidentally
 * pass shares that don't sum to 100. An all-zero `segments` renders an
 * empty ring with a plain "no evidence yet" caption rather than a
 * misleading full or blank circle.
 */
export function DonutChart({
  segments,
  ariaLabel,
  centerLabel,
  className,
}: {
  segments: readonly DonutChartSegment[];
  ariaLabel: string;
  /** Short text shown in the donut's centre, e.g. a total count. */
  centerLabel?: string | undefined;
  className?: string | undefined;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  let cumulative = 0;
  const arcs =
    total > 0
      ? segments
          .filter((segment) => segment.value > 0)
          .map((segment, index) => {
            const dash = (segment.value / total) * CIRCUMFERENCE;
            const arc = {
              ...segment,
              dash,
              dashOffset: -cumulative,
              color: segment.color ?? DEFAULT_PALETTE[index % DEFAULT_PALETTE.length],
            };
            cumulative += dash;
            return arc;
          })
      : [];

  return (
    <div className={`flex flex-col items-center gap-gb-md ${className ?? ''}`}>
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="var(--color-gb-neutral-200)" strokeWidth={THICKNESS} />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={arc.color}
              strokeWidth={THICKNESS}
              strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
              strokeDashoffset={arc.dashOffset}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            />
          ))}
        </svg>
        {centerLabel ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-gb-lg font-semibold text-fg-primary">{centerLabel}</span>
          </div>
        ) : null}
      </div>
      {total > 0 ? (
        <ul aria-label={ariaLabel} className="flex flex-wrap justify-center gap-x-gb-lg gap-y-gb-xs">
          {segments.map((segment, index) => (
            <li key={segment.key} className="flex items-center gap-gb-xs text-gb-sm text-fg-secondary">
              <span
                aria-hidden="true"
                className="h-gb-md w-gb-md shrink-0 rounded-gb-full"
                style={{ backgroundColor: segment.color ?? DEFAULT_PALETTE[index % DEFAULT_PALETTE.length] }}
              />
              {segment.label}: {segment.value}
            </li>
          ))}
        </ul>
      ) : (
        <p aria-label={ariaLabel} className="text-gb-sm text-fg-tertiary">
          No evidence recorded yet.
        </p>
      )}
    </div>
  );
}
