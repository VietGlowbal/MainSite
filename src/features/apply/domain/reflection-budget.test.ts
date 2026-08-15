import { describe, expect, it } from 'vitest';
import {
  TUITION_BUDGETS_USD,
  VND_PER_USD,
  parseBudgetBand,
  usdBandFromVndRange,
  vndRangeFromUsdBand,
} from './reflection';

/**
 * The budget slider and the USD band are two controls for one quantity and
 * they update each other. These are the conversions that make that honest —
 * they are the whole reason the two controls can be synced at all, so they are
 * tested rather than trusted.
 */

const SLIDER_MAX = 2_000_000_000;

describe('vndRangeFromUsdBand', () => {
  it('converts a closed band at the stated rate', () => {
    expect(vndRangeFromUsdBand('$10,000 - $20,000', SLIDER_MAX)).toEqual({
      low: 10_000 * VND_PER_USD,
      high: 20_000 * VND_PER_USD,
    });
  });

  it('starts the lowest band at zero rather than at some floor', () => {
    expect(vndRangeFromUsdBand('Under $10,000', SLIDER_MAX).low).toBe(0);
  });

  it('stops the open-ended top band at the slider maximum, not at infinity', () => {
    // Otherwise picking "Over $50,000" puts the upper handle somewhere off the
    // end of the track, and the slider renders with no visible thumb.
    const range = vndRangeFromUsdBand('Over $50,000', SLIDER_MAX);
    expect(range.high).toBe(SLIDER_MAX);
    expect(Number.isFinite(range.high)).toBe(true);
  });

  it('never returns a range that runs past the slider maximum', () => {
    for (const band of TUITION_BUDGETS_USD) {
      const { low, high } = vndRangeFromUsdBand(band, SLIDER_MAX);
      expect(low).toBeGreaterThanOrEqual(0);
      expect(high).toBeLessThanOrEqual(SLIDER_MAX);
      expect(low).toBeLessThanOrEqual(high);
    }
  });
});

describe('usdBandFromVndRange', () => {
  it('picks the band a range sits squarely inside', () => {
    expect(usdBandFromVndRange(12_000 * VND_PER_USD, 18_000 * VND_PER_USD)).toBe(
      '$10,000 - $20,000',
    );
  });

  it('picks the band it overlaps most when one clearly wins', () => {
    // 15,000–55,000 covers 5k of the 10–20k band, 10k of 20–30k, 20k of
    // 30–50k and 5k above — 30–50k is the only honest answer.
    expect(usdBandFromVndRange(15_000 * VND_PER_USD, 55_000 * VND_PER_USD)).toBe(
      '$30,000 - $50,000',
    );
  });

  it('resolves a tie downwards', () => {
    // 0–21,000 covers exactly 10k of "Under $10,000" and 10k of
    // "$10,000 - $20,000". Ties go to the lower band so that nudging the
    // upper handle up from zero walks through the bands one at a time
    // instead of skipping the first. (A midpoint rule would answer
    // "$10,000 - $20,000" here — this is the case the two rules disagree on.)
    expect(usdBandFromVndRange(0, 21_000 * VND_PER_USD)).toBe('Under $10,000');
  });

  it('handles both handles together as a single point', () => {
    // A zero-width range overlaps nothing, so a pure overlap test would score
    // every band at zero and fall through to whichever came first.
    expect(usdBandFromVndRange(25_000 * VND_PER_USD, 25_000 * VND_PER_USD)).toBe(
      '$20,000 - $30,000',
    );
  });

  it('reads the very top of the slider as the open-ended band', () => {
    expect(usdBandFromVndRange(60_000 * VND_PER_USD, SLIDER_MAX)).toBe('Over $50,000');
  });

  it('reads an untouched slider at zero as the lowest band', () => {
    expect(usdBandFromVndRange(0, 0)).toBe('Under $10,000');
  });

  it('round-trips every band back to itself', () => {
    // The two directions are what keep the controls agreeing. If a band
    // converts to a VND range that reads back as a different band, moving one
    // control would visibly rewrite the other's answer.
    for (const band of TUITION_BUDGETS_USD) {
      const { low, high } = vndRangeFromUsdBand(band, SLIDER_MAX);
      expect(usdBandFromVndRange(low, high)).toBe(band);
    }
  });
});

describe('parseBudgetBand', () => {
  it('reads a stored band', () => {
    expect(parseBudgetBand('100-200', 0, 1000)).toEqual([100, 200]);
  });

  it('falls back to the full span for anything unusable', () => {
    expect(parseBudgetBand(undefined, 0, 1000)).toEqual([0, 1000]);
    expect(parseBudgetBand('', 0, 1000)).toEqual([0, 1000]);
    expect(parseBudgetBand('not-a-band', 0, 1000)).toEqual([0, 1000]);
    expect(parseBudgetBand('100', 0, 1000)).toEqual([0, 1000]);
  });

  it('clamps a stored band that outgrew the slider', () => {
    // The slider's maximum is a product decision and can change; a band saved
    // under the old one must not push a handle off the track.
    expect(parseBudgetBand('-500-99999', 0, 1000)).toEqual([0, 1000]);
    expect(parseBudgetBand('2000-3000', 0, 1000)).toEqual([1000, 1000]);
  });
});
