import { describe, expect, it } from 'vitest';
import {
  ORBIT_PATH_D,
  ORBIT_SAMPLES,
  ORBIT_TOTAL_LENGTH,
  ORBIT_VIEWBOX,
  orbitArcDistance,
  orbitPointAt,
  parseCubicPath,
  sampleOrbit,
} from './orbit-path';

/** Distance between two samples, treated as a cycle. */
function gap(points: readonly { x: number; y: number }[], i: number): number {
  const a = points[i];
  const b = points[(i + 1) % points.length];
  if (a === undefined || b === undefined) throw new Error('index out of range');
  return Math.hypot(b.x - a.x, b.y - a.y);
}

describe('parseCubicPath', () => {
  it('reads the design curve as eight cubics', () => {
    expect(parseCubicPath(ORBIT_PATH_D)).toHaveLength(8);
  });

  it('chains each segment onto the previous end point', () => {
    const segments = parseCubicPath(ORBIT_PATH_D);
    for (let i = 1; i < segments.length; i += 1) {
      expect(segments[i]?.p0).toEqual(segments[i - 1]?.p1);
    }
  });

  it('ends where it began, so the orbit is a closed loop', () => {
    const segments = parseCubicPath(ORBIT_PATH_D);
    expect(segments[segments.length - 1]?.p1).toEqual(segments[0]?.p0);
  });

  it('adds a closing segment when Z has a real gap to cover', () => {
    const segments = parseCubicPath('M0 0C10 0 20 0 30 0Z');
    expect(segments).toHaveLength(2);
    expect(segments[1]?.p1).toEqual({ x: 0, y: 0 });
  });

  it('accepts several curvetos under one C command', () => {
    expect(parseCubicPath('M0 0C1 1 2 2 3 3 4 4 5 5 6 6')).toHaveLength(2);
  });

  it('rejects a command it does not model rather than guessing', () => {
    expect(() => parseCubicPath('M0 0Q5 5 10 10')).toThrow(/unsupported command/);
    expect(() => parseCubicPath('M0 0C1 1 2 2')).toThrow(/multiple of six/);
    expect(() => parseCubicPath('C1 1 2 2 3 3')).toThrow(/before moveto/);
    expect(() => parseCubicPath('')).toThrow(/no segments/);
  });
});

describe('sampleOrbit', () => {
  it('returns the requested number of points', () => {
    expect(sampleOrbit(11)).toHaveLength(11);
    expect(sampleOrbit(512)).toHaveLength(512);
  });

  it('refuses a sample count too small to describe a loop', () => {
    expect(() => sampleOrbit(2)).toThrow(/at least three/);
    expect(() => sampleOrbit(11.5)).toThrow(/at least three/);
  });

  it('spaces every point equally, including across the wrap', () => {
    // This is the assertion that matters. Sampling the Bézier parameter
    // uniformly instead measures 36% off the mean at its worst on this curve;
    // arc-length sampling comes in at 0.32%. A table built from 0..1 inclusive
    // rather than as a cycle would pass everywhere except the gap back to the
    // start, which is why the gap list below wraps.
    const points = sampleOrbit(64);
    const gaps = Array.from({ length: points.length }, (_, i) => gap(points, i));
    const mean = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
    const worst = Math.max(...gaps.map((g) => Math.abs(g - mean) / mean));
    expect(worst).toBeLessThan(0.01);
  });

  it('normalises depth to exactly 0 at the back and 1 at the front', () => {
    const depths = sampleOrbit(256).map((point) => point.depth);
    expect(Math.min(...depths)).toBeCloseTo(0, 10);
    expect(Math.max(...depths)).toBeCloseTo(1, 10);
    for (const depth of depths) {
      expect(depth).toBeGreaterThanOrEqual(0);
      expect(depth).toBeLessThanOrEqual(1);
    }
  });

  it('deepens as the curve comes down the page', () => {
    const points = sampleOrbit(256);
    const shallow = points.reduce((a, b) => (a.y < b.y ? a : b));
    const deep = points.reduce((a, b) => (a.y > b.y ? a : b));
    expect(shallow.depth).toBeLessThan(deep.depth);
  });

  it('stays inside the viewBox it is drawn in', () => {
    // The control points run past the box but the curve itself does not: it is
    // inscribed, touching all four edges. The section positions logo centres on
    // these points and so sizes its padding from that, which is only safe while
    // this holds.
    for (const point of sampleOrbit(512)) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(ORBIT_VIEWBOX.width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(ORBIT_VIEWBOX.height);
    }
  });
});

describe('orbitPointAt', () => {
  it('returns the first sample at zero', () => {
    expect(orbitPointAt(ORBIT_SAMPLES, 0)).toEqual(ORBIT_SAMPLES[0]);
  });

  it('wraps whole laps in both directions', () => {
    expect(orbitPointAt(ORBIT_SAMPLES, 1.25)).toEqual(orbitPointAt(ORBIT_SAMPLES, 0.25));
    expect(orbitPointAt(ORBIT_SAMPLES, -0.25)).toEqual(orbitPointAt(ORBIT_SAMPLES, 0.75));
    expect(orbitPointAt(ORBIT_SAMPLES, 1)).toEqual(orbitPointAt(ORBIT_SAMPLES, 0));
  });

  it('interpolates between samples instead of snapping to one', () => {
    const first = ORBIT_SAMPLES[0];
    const second = ORBIT_SAMPLES[1];
    if (first === undefined || second === undefined) throw new Error('table too small');
    const half = orbitPointAt(ORBIT_SAMPLES, 0.5 / ORBIT_SAMPLES.length);
    expect(half.x).toBeCloseTo((first.x + second.x) / 2, 6);
    expect(half.y).toBeCloseTo((first.y + second.y) / 2, 6);
  });

  it('moves continuously across the seam at the end of the loop', () => {
    // A lap ends by walking back onto sample 0. If the table were built as a
    // closed 0..1 inclusive range this step would be a stall; if it were built
    // one sample short it would be a jump.
    const step = 1 / ORBIT_SAMPLES.length;
    const before = orbitPointAt(ORBIT_SAMPLES, 1 - step * 0.5);
    const after = orbitPointAt(ORBIT_SAMPLES, step * 0.5);
    const typical = Math.hypot(
      (ORBIT_SAMPLES[1]?.x ?? 0) - (ORBIT_SAMPLES[0]?.x ?? 0),
      (ORBIT_SAMPLES[1]?.y ?? 0) - (ORBIT_SAMPLES[0]?.y ?? 0),
    );
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(typical * 1.5);
  });

  it('keeps eleven evenly-offset nodes evenly spread around the orbit', () => {
    const count = 11;
    for (const base of [0, 0.13, 0.5, 0.87]) {
      const placed = Array.from({ length: count }, (_, i) =>
        orbitPointAt(ORBIT_SAMPLES, base + i / count),
      );
      const gaps = Array.from({ length: count }, (_, i) => gap(placed, i));
      const mean = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
      // Chord length between neighbours a whole eleventh apart varies with
      // curvature even under perfect arc-length spacing, so this is a sanity
      // bound on clumping, not the tight check above.
      expect(Math.max(...gaps) / mean).toBeLessThan(1.2);
    }
  });
});

describe('ORBIT_TOTAL_LENGTH', () => {
  it('is close to the 512-sample table walked end to end', () => {
    // Chord length between consecutive equal-arc-length samples slightly
    // undershoots the true arc between them, so the table's own perimeter is a
    // lower bound on the real length, not an exact match — but for 512 samples
    // on a curve this smooth the two should agree to a fraction of a percent.
    let perimeter = 0;
    for (let i = 0; i < ORBIT_SAMPLES.length; i += 1) {
      const a = ORBIT_SAMPLES[i]!;
      const b = ORBIT_SAMPLES[(i + 1) % ORBIT_SAMPLES.length]!;
      perimeter += Math.hypot(b.x - a.x, b.y - a.y);
    }
    expect(perimeter).toBeGreaterThan(ORBIT_TOTAL_LENGTH * 0.999);
    expect(perimeter).toBeLessThanOrEqual(ORBIT_TOTAL_LENGTH);
  });

  it('is positive and roughly the scale of the viewBox perimeter', () => {
    // A loose sanity bound: an ellipse-ish loop inscribed in the ~1020x572 box
    // should have a perimeter somewhere between its bounding box's width and
    // twice its full perimeter, not, say, three units or three million.
    expect(ORBIT_TOTAL_LENGTH).toBeGreaterThan(ORBIT_VIEWBOX.width);
    expect(ORBIT_TOTAL_LENGTH).toBeLessThan(2 * (ORBIT_VIEWBOX.width + ORBIT_VIEWBOX.height) * 2);
  });
});

describe('orbitArcDistance', () => {
  it('is zero for a point and itself', () => {
    expect(orbitArcDistance(0.3, 0.3)).toBe(0);
    expect(orbitArcDistance(0, 1)).toBeCloseTo(0, 6); // 0 and 1 are the same point
  });

  it('is symmetric', () => {
    expect(orbitArcDistance(0.2, 0.9)).toBeCloseTo(orbitArcDistance(0.9, 0.2), 10);
  });

  it('takes the short way around the seam', () => {
    // 0.02 and 0.98 are 0.04 of the loop apart going through the seam at 0/1,
    // and 0.96 apart the long way. A naive |a-b| would report the long way.
    const distance = orbitArcDistance(0.02, 0.98);
    expect(distance).toBeCloseTo(0.04 * ORBIT_TOTAL_LENGTH, 1);
  });

  it('tops out at half the total length, for antipodal points', () => {
    const distance = orbitArcDistance(0.1, 0.6);
    expect(distance).toBeCloseTo(0.5 * ORBIT_TOTAL_LENGTH, 1);
  });

  it('matches the direct calculation for points that do not cross the seam', () => {
    const distance = orbitArcDistance(0.3, 0.45);
    expect(distance).toBeCloseTo(0.15 * ORBIT_TOTAL_LENGTH, 1);
  });
});
