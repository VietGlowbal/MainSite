'use client';

import { MATCH_PILLARS, type PillarKey } from '@/lib/match-insights';

/**
 * RadarPentagon — a hand-rolled SVG radar chart for the five match pillars.
 * Overlays the user's CURRENT scores (filled) on their realistic MAX (dashed
 * outline), with an optional PROJECTED layer (from completed improvement tasks).
 */

type ScoreMap = Partial<Record<PillarKey, number>>;

const RINGS = [25, 50, 75, 100];

function polarToXY(cx: number, cy: number, radius: number, indexAngleDeg: number, value: number) {
  const r = (radius * Math.max(0, Math.min(100, value))) / 100;
  const rad = (indexAngleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function polygonPoints(cx: number, cy: number, radius: number, values: number[], angles: number[]) {
  return values
    .map((v, i) => {
      const { x, y } = polarToXY(cx, cy, radius, angles[i], v);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function RadarPentagon({
  current,
  max,
  projected,
  size = 320,
}: {
  current: ScoreMap;
  max: ScoreMap;
  projected?: ScoreMap;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.32; // leave room for labels
  // First axis points straight up, then clockwise every 72°.
  const angles = MATCH_PILLARS.map((_, i) => -90 + i * 72);

  const currentVals = MATCH_PILLARS.map((p) => current[p.key] ?? 0);
  const maxVals = MATCH_PILLARS.map((p) => max[p.key] ?? 0);
  const projectedVals = projected ? MATCH_PILLARS.map((p) => projected[p.key] ?? 0) : null;
  const showProjected =
    projectedVals != null && projectedVals.some((v, i) => v > currentVals[i] + 0.5);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="mx-auto block max-w-full" role="img" aria-label="Match score radar chart">
      <defs>
        <linearGradient id="radar-current" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF3D9A" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#19B8D8" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* Grid rings */}
      {RINGS.map((ring) => (
        <polygon
          key={ring}
          points={polygonPoints(cx, cy, radius, MATCH_PILLARS.map(() => ring), angles)}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={1}
        />
      ))}

      {/* Axis spokes */}
      {angles.map((a, i) => {
        const { x, y } = polarToXY(cx, cy, radius, a, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth={1} />;
      })}

      {/* Max (realistic ceiling) — dashed outline */}
      <polygon
        points={polygonPoints(cx, cy, radius, maxVals, angles)}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />

      {/* Projected (from completed improvement tasks) */}
      {showProjected && projectedVals ? (
        <polygon
          points={polygonPoints(cx, cy, radius, projectedVals, angles)}
          fill="none"
          stroke="#FF3D9A"
          strokeWidth={1.75}
          strokeDasharray="2 3"
        />
      ) : null}

      {/* Current */}
      <polygon
        points={polygonPoints(cx, cy, radius, currentVals, angles)}
        fill="url(#radar-current)"
        stroke="#FF3D9A"
        strokeWidth={2}
      />
      {MATCH_PILLARS.map((p, i) => {
        const { x, y } = polarToXY(cx, cy, radius, angles[i], currentVals[i]);
        return <circle key={p.key} cx={x} cy={y} r={3} fill="#FF3D9A" />;
      })}

      {/* Axis labels */}
      {MATCH_PILLARS.map((p, i) => {
        const { x, y } = polarToXY(cx, cy, radius * 1.18, angles[i], 100);
        const anchor = x < cx - 4 ? 'end' : x > cx + 4 ? 'start' : 'middle';
        return (
          <text key={p.key} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" className="fill-slate-600">
            <tspan fontSize="11" fontWeight={600}>{p.label}</tspan>
            <tspan fontSize="9" fill="#94a3b8" dx="3">{Math.round(p.weight * 100)}%</tspan>
          </text>
        );
      })}
    </svg>
  );
}
