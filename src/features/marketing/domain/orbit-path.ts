/**
 * The tilted ellipse the partner logos orbit, plus the arc-length machinery that
 * turns it into evenly-spaced points.
 *
 * ─── WHY THIS IS NOT `getPointAtLength` ─────────────────────────────────────
 *
 * The prototype this came from asked the live `<path>` element for a point every
 * frame, once per node: `pathElement.getPointAtLength(progress * totalLength)`.
 * At eleven nodes and 60fps that is 660 geometry queries a second against the
 * DOM, on the homepage, to walk a curve that never changes. It also cannot run
 * until the SVG has been laid out, so the first paint has every logo stacked in
 * one corner, and it re-read `getTotalLength()` on resize for nothing — path
 * length is in the path's own user units and is not affected by how big the SVG
 * is drawn.
 *
 * So the curve is flattened here instead, once, into a table of points spaced
 * equally along the arc. The component interpolates between neighbours. Being
 * pure, it also means the eleven starting positions are computed during render —
 * server-side — so the composition is correct in the HTML before any JavaScript
 * runs, and a visitor who prefers reduced motion never needs any.
 *
 * ⚠️ EQUAL ARC LENGTH IS THE WHOLE POINT, and sampling the Bézier parameter `t`
 * uniformly instead would not give it. `t` runs faster through the gentle parts
 * of a curve than the tight ones, so nodes spaced evenly in `t` visibly bunch up
 * at the ends of the ellipse and stretch apart along the sides. That is why this
 * flattens densely first, accumulates real chord lengths, and then walks that
 * table at a constant distance step.
 */

/** The user-coordinate space the path is drawn in — the SVG's viewBox. */
export const ORBIT_VIEWBOX = { width: 1020, height: 572 } as const;

/**
 * The orbit, verbatim from the design: eight cubics closing back on the start.
 *
 * Kept as the SVG `d` string rather than transcribed into numbers so that the
 * `<path>` the section renders and the table this module builds are the same
 * curve by construction, and so a new curve can be dropped in from a design tool
 * without hand-editing coordinates.
 */
export const ORBIT_PATH_D =
  'M438.952 40.8213C578.331 0.420355 712.457 -8.66301 816.626 9.29004C920.833 27.2496 994.888 72.2245 1014.46 139.774C1034.04 207.324 995.505 284.934 917.051 355.841C838.624 426.722 720.427 490.778 581.048 531.179C441.669 571.58 307.543 580.663 203.374 562.71C99.1674 544.75 25.1119 499.775 5.53711 432.226C-14.0376 364.676 24.4945 287.066 102.949 216.159C181.376 145.278 299.573 81.2224 438.952 40.8213Z';

export type OrbitPoint = {
  /** Position in the path's own user units — see ORBIT_VIEWBOX. */
  readonly x: number;
  readonly y: number;
  /**
   * 0 at the far side of the orbit, 1 at the near side.
   *
   * Measured across the curve's own vertical extent rather than by dividing y by
   * the viewBox height as the prototype did. For this curve the two agree to
   * within a thousandth — it happens to be inscribed in its box, y running 0.50
   * to 571.50 of 572 — so this is not a bug fix. It is what makes the scale and
   * opacity the component derives from it hold their stated range if a different
   * curve is ever dropped into ORBIT_PATH_D: a curve whose control points pull it
   * past the box, which is common, would otherwise produce a depth below 0 and a
   * negative scale term at the back of the orbit.
   */
  readonly depth: number;
};

type Vec = { readonly x: number; readonly y: number };
type Cubic = { readonly p0: Vec; readonly c1: Vec; readonly c2: Vec; readonly p1: Vec };

/**
 * The `d` string as a list of cubic segments.
 *
 * Deliberately narrow: this understands one absolute moveto, a run of absolute
 * curvetos and an optional closepath, which is exactly what the design exports
 * and all this module ever needs. Anything else throws rather than silently
 * producing a curve that is not the one on screen.
 */
export function parseCubicPath(d: string): readonly Cubic[] {
  const commands = d.match(/[a-z][^a-z]*/gi) ?? [];
  const segments: Cubic[] = [];
  let start: Vec | null = null;
  let cursor: Vec | null = null;

  for (const command of commands) {
    const verb = command[0];
    const args = (command.slice(1).match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);

    if (verb === 'M') {
      const [x, y] = args;
      if (args.length !== 2 || x === undefined || y === undefined) {
        throw new Error(`orbit path: expected "M x y", got "${command}"`);
      }
      start = { x, y };
      cursor = start;
      continue;
    }

    if (verb === 'C') {
      if (cursor === null) throw new Error('orbit path: curveto before moveto');
      if (args.length === 0 || args.length % 6 !== 0) {
        throw new Error(`orbit path: curveto needs a multiple of six numbers, got ${args.length}`);
      }
      for (let i = 0; i < args.length; i += 6) {
        // Non-null: the length check above guarantees all six are present, but
        // noUncheckedIndexedAccess cannot see that through the arithmetic.
        const nums = args.slice(i, i + 6) as [number, number, number, number, number, number];
        const segment: Cubic = {
          p0: cursor,
          c1: { x: nums[0], y: nums[1] },
          c2: { x: nums[2], y: nums[3] },
          p1: { x: nums[4], y: nums[5] },
        };
        segments.push(segment);
        cursor = segment.p1;
      }
      continue;
    }

    if (verb === 'Z' || verb === 'z') {
      // The design's curve already ends on its start point, so the closepath is
      // a no-op here. Adding a segment for it only if there is a real gap keeps
      // this honest for a curve that does not.
      if (start !== null && cursor !== null && (cursor.x !== start.x || cursor.y !== start.y)) {
        segments.push({ p0: cursor, c1: cursor, c2: start, p1: start });
        cursor = start;
      }
      continue;
    }

    throw new Error(`orbit path: unsupported command "${verb}"`);
  }

  if (segments.length === 0) throw new Error('orbit path: no segments');
  return segments;
}

function cubicAt(segment: Cubic, t: number): Vec {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * segment.p0.x + b * segment.c1.x + c * segment.c2.x + d * segment.p1.x,
    y: a * segment.p0.y + b * segment.c1.y + c * segment.c2.y + d * segment.p1.y,
  };
}

/**
 * Straight-line steps per cubic when flattening.
 *
 * 128 keeps the longest chord on this curve under 3.4 user units. Chord length
 * understates arc length by O(h³) per step, so at that size the measured total
 * is accurate to far better than the ~5-unit spacing the table is built at.
 */
const FLATTEN_STEPS = 128;

type Flattened = { readonly points: readonly Vec[]; readonly lengths: readonly number[]; readonly total: number };

/**
 * The curve reduced to a polyline with a running arc length at each vertex.
 *
 * Shared by `sampleOrbit` (which walks this table to place evenly-spaced
 * points) and `ORBIT_TOTAL_LENGTH` (which just wants the last entry) — both
 * need the identical flattening, and computing it twice would risk the two
 * disagreeing by the flattening's own small error if `FLATTEN_STEPS` ever
 * changes in only one place.
 */
function flattenPath(): Flattened {
  const segments = parseCubicPath(ORBIT_PATH_D);

  const points: Vec[] = [segments[0]?.p0 ?? { x: 0, y: 0 }];
  const lengths: number[] = [0];
  let total = 0;
  for (const segment of segments) {
    for (let step = 1; step <= FLATTEN_STEPS; step += 1) {
      const point = cubicAt(segment, step / FLATTEN_STEPS);
      const previous = points[points.length - 1];
      if (previous === undefined) continue;
      total += Math.hypot(point.x - previous.x, point.y - previous.y);
      points.push(point);
      lengths.push(total);
    }
  }

  return { points, lengths, total };
}

/**
 * `count` points around the orbit, spaced equally by arc length.
 *
 * The first point is the curve's start and the last stops one step short of
 * returning to it, so the table is a cycle: index `count` would be index 0
 * again. Getting that wrong is how you end up with one visibly wrong gap in an
 * otherwise even ring.
 */
export function sampleOrbit(count: number): readonly OrbitPoint[] {
  if (!Number.isInteger(count) || count < 3) {
    throw new Error(`orbit path: need at least three samples, got ${count}`);
  }

  const { points, lengths, total } = flattenPath();

  /* Walk the table at a constant distance step. */
  const spacing = total / count;
  const sampled: Vec[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i += 1) {
    const target = i * spacing;
    while (cursor < lengths.length - 2 && (lengths[cursor + 1] ?? 0) < target) cursor += 1;
    const from = points[cursor];
    const to = points[cursor + 1];
    const lengthFrom = lengths[cursor] ?? 0;
    const lengthTo = lengths[cursor + 1] ?? lengthFrom;
    if (from === undefined || to === undefined) throw new Error('orbit path: flatten underran');
    const span = lengthTo - lengthFrom;
    const t = span > 0 ? (target - lengthFrom) / span : 0;
    sampled.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  }

  /* Depth from the curve's own vertical extent, not the viewBox's. */
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of sampled) {
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  const spread = maxY - minY || 1;

  return sampled.map((point) => ({
    x: point.x,
    y: point.y,
    depth: (point.y - minY) / spread,
  }));
}

/**
 * The table the homepage reads. 512 samples put neighbours ~5 user units apart,
 * and the lookup below interpolates between them, so the motion is smooth
 * without the table being large enough to notice in the bundle.
 */
export const ORBIT_SAMPLES: readonly OrbitPoint[] = sampleOrbit(512);

/**
 * The orbit's real arc length, in the same user units as ORBIT_PATH_D — the
 * equivalent of an SVG `<path>` element's own `getTotalLength()`.
 *
 * What this is FOR: converting a wave-propagation speed given in "user units
 * per millisecond" into how far along the ring a wave has travelled, so a
 * hover shockwave can be timed against the real geometry of the curve rather
 * than against sample-table indices (which would run at a different rate
 * wherever the curve is tighter or gentler).
 */
export const ORBIT_TOTAL_LENGTH: number = flattenPath().total;

/**
 * Arc-length distance between two points on the ring, taking whichever
 * direction around the loop is shorter.
 *
 * `progress` is periodic, so a naive `|a - b| * ORBIT_TOTAL_LENGTH` overstates
 * the distance for any pair on opposite sides of the 0/1 seam — two points a
 * hair apart across the seam would otherwise measure as nearly the whole
 * orbit apart. Wrapping the fractional difference into [-0.5, 0.5] first fixes
 * that, matching how a wave radiating from a source and reaching a node "the
 * short way around" would actually travel.
 */
export function orbitArcDistance(a: number, b: number): number {
  let diff = Math.abs(a - b) % 1;
  if (diff > 0.5) diff = 1 - diff;
  return diff * ORBIT_TOTAL_LENGTH;
}

/**
 * The point `progress` of the way around the orbit, wrapping at both ends.
 *
 * Interpolated between the two nearest samples: stepping to the nearest sample
 * instead would move the logos in ~5-unit jumps, which at this speed reads as a
 * stutter rather than as a glide.
 */
export function orbitPointAt(
  table: readonly OrbitPoint[],
  progress: number,
): OrbitPoint {
  const count = table.length;
  const wrapped = ((progress % 1) + 1) % 1;
  const exact = wrapped * count;
  const index = Math.floor(exact);
  const t = exact - index;
  const from = table[index % count];
  const to = table[(index + 1) % count];
  if (from === undefined || to === undefined) throw new Error('orbit path: empty table');
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    depth: from.depth + (to.depth - from.depth) * t,
  };
}
