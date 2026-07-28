import { TID, testId } from '@/shared/lib';

/**
 * ScoreRing — the banded percentage gauge used across the apply screens.
 *
 * Promoted out of `apply/apply-list-client.tsx`, where it was `ProgressGauge`
 * (Figma 337:18813 "Activity gauge"). The designs reuse this shape on the
 * application list, the workspace header, the university match analysis and the
 * profile evaluation, so it belongs here rather than in one route.
 *
 * IT IS DRAWN, NOT PLACED. The frames export the rings as flat images baked at
 * 92% / 60% / 30%. Those cannot be reused, because the arc has to follow a real
 * value. It is an SVG arc for that reason and must stay one.
 *
 * ⚠️ THE LABEL IS REQUIRED, and that is a product decision rather than an
 * oversight. Two different quantities wear this component: `progress` (how far
 * through the application the student is) and `match` (how well they fit the
 * course). They band identically, so a bare ring showing 40% in green is
 * genuinely ambiguous — and the design frames contain exactly that ambiguity,
 * with a "Tiến độ" ring at 40% sitting next to a rule that says green means a
 * strong match. Naming the measure on every instance is what stops the two
 * being confused.
 */

/** The three bands, from Figma 337:18812. */
export type ScoreRingSize = 'sm' | 'md' | 'lg';

/**
 * What the number means. Used for the visible caption and the accessible name,
 * so a screen reader hears "Progress, 40 percent" rather than a naked figure.
 */
export type ScoreRingMeasure = 'progress' | 'match';

const MEASURE_LABEL: Record<ScoreRingMeasure, string> = {
  progress: 'Progress',
  match: 'Match',
};

type Geometry = {
  /** Outer plate, in px. */
  plate: number;
  /** SVG viewport, in px. */
  box: number;
  radius: number;
  stroke: number;
  /** Type size for the number inside the ring. */
  valueClass: string;
};

/**
 * `md` reproduces the list row exactly — 104px plate, 76px box, r32, 8px stroke
 * — so promoting this component changed nothing on the screen that already
 * shipped. `sm` and `lg` are scaled from it.
 */
const GEOMETRY: Record<ScoreRingSize, Geometry> = {
  sm: { plate: 64, box: 48, radius: 20, stroke: 5, valueClass: 'text-gb-xs' },
  md: { plate: 104, box: 76, radius: 32, stroke: 8, valueClass: 'text-gb-md' },
  lg: { plate: 136, box: 100, radius: 42, stroke: 10, valueClass: 'text-gb-xl' },
};

/**
 * Band the arc by value. Reuses the admission-tier palette rather than
 * introducing a parallel green/amber/red scale — the tier tokens already carry
 * these three hues and the list row has shipped against them.
 *
 * Deliberately NOT `tier-recommend`: that ramp is blue, and a blue segment here
 * would read as a fourth state rather than a point on a scale.
 */
export function scoreRingColor(pct: number): string {
  if (pct >= 70) return 'var(--color-gb-tier-safe)'; // Figma Colors/Green/700
  if (pct >= 40) return 'var(--color-gb-yellow-400)'; // Figma Colors/Yellow/400
  return 'var(--color-gb-brand-600)'; // Figma Colors/Rose/600
}

export function ScoreRing({
  value,
  measure,
  size = 'md',
  label,
  showLabel = true,
  className,
}: {
  /** 0–100. Values outside are clamped rather than drawn as an overflowing arc. */
  value: number;
  measure: ScoreRingMeasure;
  size?: ScoreRingSize;
  /** Overrides the caption. The measure still drives the accessible name. */
  label?: string | undefined;
  /**
   * Only set false where an adjacent heading already names the measure — the
   * university analysis puts "Overall match" beside the ring, so repeating it
   * underneath would be noise. Never set it false to save space.
   */
  showLabel?: boolean;
  className?: string | undefined;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const { plate, box, radius, stroke, valueClass } = GEOMETRY[size];
  const circumference = 2 * Math.PI * radius;
  const centre = box / 2;
  const caption = label ?? MEASURE_LABEL[measure];

  return (
    <div className={`flex shrink-0 flex-col items-center gap-gb-md ${className ?? ''}`}>
      <div
        className="flex items-center justify-center rounded-gb-full bg-surface-muted/90 backdrop-blur-sm"
        style={{ width: plate, height: plate }}
      >
        <svg
          width={box}
          height={box}
          viewBox={`0 0 ${box} ${box}`}
          role="img"
          aria-label={`${caption}: ${pct}%`}
        >
          <circle
            cx={centre}
            cy={centre}
            r={radius}
            fill="none"
            stroke="var(--color-gb-neutral-300)"
            strokeWidth={stroke}
          />
          {/* A zero-length arc still paints a dot under strokeLinecap="round",
              which reads as ~2% rather than nothing. Omit the arc entirely. */}
          {pct > 0 ? (
            <circle
              cx={centre}
              cy={centre}
              r={radius}
              fill="none"
              stroke={scoreRingColor(pct)}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
              transform={`rotate(-90 ${centre} ${centre})`}
            />
          ) : null}
          <text
            x={centre}
            y={centre}
            textAnchor="middle"
            dominantBaseline="central"
            className={`fill-[var(--gb-text-primary)] font-semibold ${valueClass}`}
          >
            {pct}%
          </text>
        </svg>
      </div>

      {showLabel ? (
        <span {...testId(TID.scoreRingLabel)} className="text-gb-sm text-fg-tertiary">
          {caption}
        </span>
      ) : null}
    </div>
  );
}
