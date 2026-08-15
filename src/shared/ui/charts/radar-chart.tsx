export type RadarChartDatum = {
  key: string;
  label: string;
  /** 0-100, or null when the underlying framework has nothing to report. */
  value: number | null;
};

const SIZE = 240;
const CENTER = SIZE / 2;
const MAX_RADIUS = CENTER - 46; // leaves room for axis labels outside the plot
const RINGS = [0.25, 0.5, 0.75, 1];

function angleFor(index: number, count: number): number {
  return (index / count) * Math.PI * 2 - Math.PI / 2;
}

function pointFor(index: number, count: number, radiusFraction: number): { x: number; y: number } {
  const angle = angleFor(index, count);
  return {
    x: CENTER + Math.cos(angle) * MAX_RADIUS * radiusFraction,
    y: CENTER + Math.sin(angle) * MAX_RADIUS * radiusFraction,
  };
}

function pointsAttr(points: readonly { x: number; y: number }[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

/**
 * The "Competency & evidence profile" / "Motivation and direction profile"
 * radar charts (implementation spec §6, §13) — an SVG polygon over the
 * report's own analytics, never a chart-specific computation. Decorative
 * (`aria-hidden`); the legend list beneath it is the one accessible copy of
 * every value, visible to everyone rather than screen-reader-only, so a
 * sighted reader gets exact numbers too, not just a shape.
 *
 * `value: null` never plots as zero — the polygon vertex for that axis sits
 * at the centre (nothing to show) rather than at the "lowest possible
 * score" position, and its legend row reads "N/A" instead of "0%".
 */
export function RadarChart({
  data,
  ariaLabel,
  className,
}: {
  data: readonly RadarChartDatum[];
  ariaLabel: string;
  className?: string | undefined;
}) {
  const count = data.length;
  const hasShape = count >= 3;

  return (
    <div className={`flex flex-col items-center gap-gb-lg ${className ?? ''}`}>
      {hasShape ? (
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          {RINGS.map((fraction) => (
            <polygon
              key={fraction}
              points={pointsAttr(data.map((_, index) => pointFor(index, count, fraction)))}
              fill="none"
              stroke="var(--color-gb-neutral-200)"
              strokeWidth={1}
            />
          ))}
          {data.map((datum, index) => {
            const p = pointFor(index, count, 1);
            return (
              <line
                key={datum.key}
                x1={CENTER}
                y1={CENTER}
                x2={p.x}
                y2={p.y}
                stroke="var(--color-gb-neutral-200)"
                strokeWidth={1}
              />
            );
          })}
          <polygon
            points={pointsAttr(
              data.map((datum, index) =>
                pointFor(index, count, datum.value === null ? 0 : Math.max(0, Math.min(100, datum.value)) / 100),
              ),
            )}
            fill="var(--color-gb-brand-600)"
            fillOpacity={0.15}
            stroke="var(--color-gb-brand-600)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {data.map((datum, index) => {
            if (datum.value === null) return null;
            const p = pointFor(index, count, Math.max(0, Math.min(100, datum.value)) / 100);
            return <circle key={datum.key} cx={p.x} cy={p.y} r={3} fill="var(--color-gb-brand-600)" />;
          })}
          {data.map((datum, index) => {
            const p = pointFor(index, count, 1.22);
            const anchor = Math.abs(p.x - CENTER) < 8 ? 'middle' : p.x > CENTER ? 'start' : 'end';
            return (
              <text
                key={datum.key}
                x={p.x}
                y={p.y}
                textAnchor={anchor}
                dominantBaseline="central"
                className="fill-[var(--gb-text-tertiary)] text-[10px]"
              >
                {datum.label}
              </text>
            );
          })}
        </svg>
      ) : null}
      <ul aria-label={ariaLabel} className="grid w-full grid-cols-2 gap-x-gb-lg gap-y-gb-xs sm:grid-cols-3">
        {data.map((datum) => (
          <li key={datum.key} className="flex items-baseline justify-between gap-gb-sm text-gb-sm">
            <span className="text-fg-secondary">{datum.label}</span>
            <span className="tabular-nums text-fg-tertiary">{datum.value === null ? 'N/A' : `${Math.round(datum.value)}%`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
