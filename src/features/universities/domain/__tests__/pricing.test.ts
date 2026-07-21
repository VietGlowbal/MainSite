import { describe, expect, it } from 'vitest';
import { amountToUsd, computeNetTuition, parseCoveragePercent, type ScholarshipLike } from '../pricing';

function scholarship(overrides: Partial<ScholarshipLike> = {}): ScholarshipLike {
  return {
    name: 'Test Award',
    coverage: null,
    fundingType: null,
    amountMin: null,
    amountMax: null,
    amountCurrency: null,
    ...overrides,
  };
}

describe('parseCoveragePercent', () => {
  it('takes the highest percentage present', () => {
    expect(parseCoveragePercent('100% tuition', null)).toBe(100);
    expect(parseCoveragePercent('80%–90% tuition', null)).toBe(90);
    expect(parseCoveragePercent('50%, 60% or 70% tuition', null)).toBe(70);
  });

  it('ignores out-of-range percentages', () => {
    // A "150%" in prose is noise, not a coverage level.
    expect(parseCoveragePercent('150% of nothing', null)).toBeNull();
    expect(parseCoveragePercent('0% tuition', null)).toBeNull();
  });

  it('infers 100 for full-ride funding with no number', () => {
    expect(parseCoveragePercent(null, ['full-ride'])).toBe(100);
    expect(parseCoveragePercent('covers everything', ['full-ride'])).toBe(100);
  });

  it('returns null with no signal at all', () => {
    expect(parseCoveragePercent(null, null)).toBeNull();
    expect(parseCoveragePercent('partial support', ['merit'])).toBeNull();
  });
});

describe('amountToUsd', () => {
  it('passes USD through', () => {
    expect(amountToUsd(1000, 'USD')).toBe(1000);
  });

  it('defaults a missing currency to USD', () => {
    expect(amountToUsd(1000, null)).toBe(1000);
  });

  it('is case-insensitive', () => {
    expect(amountToUsd(100, 'gbp')).toBeCloseTo(127);
  });

  it('returns null for an unknown currency rather than guessing', () => {
    expect(amountToUsd(1000, 'XYZ')).toBeNull();
  });
});

describe('computeNetTuition', () => {
  it('scales tuition by a coverage percentage', () => {
    const net = computeNetTuition('40,000-60,000 USD', [
      scholarship({ name: 'Half Ride', coverage: '50% tuition' }),
    ]);
    expect(net).toEqual({ netLo: 20000, netHi: 30000, scholarshipName: 'Half Ride' });
  });

  it('subtracts a cash award when there is no percentage', () => {
    const net = computeNetTuition('50,000 USD', [
      scholarship({ name: 'Cash', amountMax: 12000, amountCurrency: 'USD' }),
    ]);
    expect(net?.netLo).toBe(38000);
    expect(net?.netHi).toBe(38000);
  });

  it('converts a non-USD award before subtracting', () => {
    const net = computeNetTuition('50,000 USD', [
      scholarship({ name: 'GBP Award', amountMax: 10000, amountCurrency: 'GBP' }),
    ]);
    expect(net?.netHi).toBeCloseTo(50000 - 12700);
  });

  it('picks the single largest reduction', () => {
    const net = computeNetTuition('40,000 USD', [
      scholarship({ name: 'Small', coverage: '10% tuition' }),
      scholarship({ name: 'Big', coverage: '75% tuition' }),
      scholarship({ name: 'Medium', coverage: '40% tuition' }),
    ]);
    expect(net?.scholarshipName).toBe('Big');
    expect(net?.netHi).toBe(10000);
  });

  it('never goes below zero', () => {
    const net = computeNetTuition('10,000 USD', [
      scholarship({ name: 'Overshoot', amountMax: 99000, amountCurrency: 'USD' }),
    ]);
    expect(net?.netLo).toBe(0);
    expect(net?.netHi).toBe(0);
  });

  it('ignores awards that do not reduce the bill', () => {
    expect(
      computeNetTuition('40,000 USD', [scholarship({ name: 'Zero', coverage: 'no tuition help' })]),
    ).toBeNull();
  });

  it('returns null when tuition is free or unparseable', () => {
    const s = [scholarship({ name: 'Any', coverage: '50% tuition' })];
    expect(computeNetTuition('Free', s)).toBeNull();
    expect(computeNetTuition('varies', s)).toBeNull();
    expect(computeNetTuition(null, s)).toBeNull();
  });

  it('returns null with no scholarships', () => {
    expect(computeNetTuition('40,000 USD', [])).toBeNull();
    expect(computeNetTuition('40,000 USD', null)).toBeNull();
  });

  it('skips a scholarship with neither percentage nor amount', () => {
    const net = computeNetTuition('40,000 USD', [
      scholarship({ name: 'Empty' }),
      scholarship({ name: 'Real', coverage: '25% tuition' }),
    ]);
    expect(net?.scholarshipName).toBe('Real');
  });

  it('skips an award in an unconvertible currency', () => {
    expect(
      computeNetTuition('40,000 USD', [
        scholarship({ name: 'Unknown FX', amountMax: 5000, amountCurrency: 'XYZ' }),
      ]),
    ).toBeNull();
  });
});
