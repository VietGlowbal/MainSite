import { describe, expect, it } from 'vitest';
import { normalizeScholarshipBenefits } from '../benefit-normalization';
import {
  calculateDisplayScholarshipValue,
  createScholarshipValueViewModel,
  formatMoneyAmount,
  recommendationReasonLabel,
} from '../value-formatting';

describe('scholarship value formatting', () => {
  it('formats fixed amounts and ranges with their preserved currency', () => {
    const fixed = normalizeScholarshipBenefits({
      coverage: '$20,000',
    });
    const range = normalizeScholarshipBenefits({
      coverage: '$10,000–$20,000',
    });

    expect(createScholarshipValueViewModel({
      benefits: fixed,
      value: calculateDisplayScholarshipValue(fixed),
    })).toMatchObject({
      originalAwardLabel: '$20,000',
      totalValueLabel: '$20,000 total value — Exact',
      totalValueKind: 'exact',
    });
    expect(createScholarshipValueViewModel({
      benefits: range,
      value: calculateDisplayScholarshipValue(range),
    }).originalAwardLabel).toBe('$10,000–$20,000');
  });

  it('keeps percentage tuition distinct from full ride', () => {
    const half = normalizeScholarshipBenefits({ coverage: '50% tuition' });
    const fullTuition = normalizeScholarshipBenefits({ coverage: '100% tuition' });
    const fullRide = normalizeScholarshipBenefits({ coverage: 'full ride' });

    expect(createScholarshipValueViewModel({ benefits: half })).toMatchObject({
      coverageLabel: '50% Tuition',
      originalAwardLabel: null,
    });
    expect(createScholarshipValueViewModel({ benefits: fullTuition })).toMatchObject({
      coverageLabel: '100% Tuition',
      originalAwardLabel: null,
    });
    expect(createScholarshipValueViewModel({ benefits: fullRide }).coverageLabel).toBe('100% Full-ride');
  });

  it('does not present vague fully-funded evidence as full ride', () => {
    const fullyFunded = normalizeScholarshipBenefits({ coverage: 'fully funded' });
    const model = createScholarshipValueViewModel({ benefits: fullyFunded });

    expect(model.coverageLabel).toBe('Fully funded — details incomplete');
    expect(model.coverageLabel).not.toContain('Full-ride');
  });

  it('formats estimated and mixed total labels without making estimates official', () => {
    const exact = normalizeScholarshipBenefits({ coverage: '$20,000' });
    const estimated = normalizeScholarshipBenefits({ coverage: 'living allowance' });
    const estimatedValue = calculateDisplayScholarshipValue(estimated);
    const mixedValue = {
      ...calculateDisplayScholarshipValue(exact),
      status: 'MIXED' as const,
      valueStatus: 'MIXED' as const,
    };

    expect(createScholarshipValueViewModel({ benefits: exact, value: mixedValue }).totalValueLabel)
      .toBe('$20,000 total value — Mixed estimate');
    expect(createScholarshipValueViewModel({ benefits: estimated, value: {
      ...estimatedValue,
      status: 'ESTIMATED',
      valueStatus: 'ESTIMATED',
      totalValue: { min: 82_300, max: 82_300, currency: 'USD', currencyStatus: 'known' },
    } }).totalValueLabel).toBe('≈ $82,300 estimated total value');
  });

  it('shows unavailable value rather than zero when evidence is insufficient', () => {
    const monthly = normalizeScholarshipBenefits({ coverage: '$5,000/month' });
    const model = createScholarshipValueViewModel({
      benefits: monthly,
      value: calculateDisplayScholarshipValue(monthly),
    });

    expect(model.totalValueLabel).toBe('Total value unavailable');
    expect(model.totalValueKind).toBe('unavailable');
    expect(model.totalValueLabel).not.toContain('$0');
  });

  it('never defaults an unknown currency to USD', () => {
    const unknown = normalizeScholarshipBenefits({ coverage: 'RMB 20,000' });
    const model = createScholarshipValueViewModel({
      benefits: unknown,
      value: calculateDisplayScholarshipValue(unknown),
    });

    expect(formatMoneyAmount(unknown.components[0]?.amount)).toContain('currency unavailable');
    expect(model.originalAwardLabel).not.toContain('$');
  });

  it('maps recommendation reason codes to human-readable reasons', () => {
    expect(recommendationReasonLabel('target-country-match')).toBe('Target country match');
    expect(recommendationReasonLabel('estimated-award-value')).toBe('Estimated award value');
  });
});
