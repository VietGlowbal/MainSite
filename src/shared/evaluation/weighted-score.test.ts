import { describe, expect, it } from 'vitest';
import { weightedScore } from './weighted-score';

describe('weightedScore', () => {
  it('computes a plain weighted average when every metric is present', () => {
    const result = weightedScore([
      { key: 'a', weight: 0.5, value: 80 },
      { key: 'b', weight: 0.5, value: 60 },
    ]);
    expect(result.score).toBe(70);
    expect(result.renormalized).toBe(false);
    expect(result.missingKeys).toEqual([]);
  });

  it('renormalizes the remaining weights when a metric is missing', () => {
    // a: 0.25, b: 0.25, c: 0.5 — c missing means a and b split 1.0 evenly.
    const result = weightedScore([
      { key: 'a', weight: 0.25, value: 100 },
      { key: 'b', weight: 0.25, value: 50 },
      { key: 'c', weight: 0.5, value: null },
    ]);
    expect(result.score).toBe(75);
    expect(result.renormalized).toBe(true);
    expect(result.missingKeys).toEqual(['c']);
    expect(result.presentKeys).toEqual(['a', 'b']);
  });

  it('returns null, not zero, when every metric is missing', () => {
    // Core principle 6: a missing metric becomes N/A, never a fabricated 0.
    const result = weightedScore([
      { key: 'a', weight: 0.5, value: null },
      { key: 'b', weight: 0.5, value: null },
    ]);
    expect(result.score).toBeNull();
    expect(result.renormalized).toBe(false);
    expect(result.missingKeys).toEqual(['a', 'b']);
    expect(result.presentKeys).toEqual([]);
  });

  it('survives an empty metric list', () => {
    const result = weightedScore([]);
    expect(result.score).toBeNull();
  });

  it('handles a single present metric with the rest missing', () => {
    const result = weightedScore([
      { key: 'a', weight: 0.4, value: 90 },
      { key: 'b', weight: 0.6, value: null },
    ]);
    // a's weight is renormalized to the full 1.0 since it's the only one present.
    expect(result.score).toBe(90);
    expect(result.renormalized).toBe(true);
  });
});
