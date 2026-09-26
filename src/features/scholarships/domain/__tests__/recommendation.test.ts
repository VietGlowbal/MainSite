import { describe, expect, it } from 'vitest';
import type {
  BenefitAmount,
  BenefitComponent,
  BenefitConfidence,
} from '../benefit-types';
import {
  DEFAULT_RECOMMENDATION_POLICY,
  type RecommendationPolicy,
} from '../recommendation-policy';
import {
  recommendScholarships,
  type RecommendationEligibility,
  type RecommendationFit,
  type ScholarshipRecommendationCandidate,
} from '../recommendation';
import type { ScholarshipValueResult, ValueStatus } from '../valuation';

const evidence = {
  sourceType: 'catalogue-field' as const,
  sourceField: 'amount' as const,
  excerpt: 'Test award evidence',
  sourceUrl: 'https://example.test/award',
};

function amount(value: number, currency = 'USD'): BenefitAmount {
  return {
    min: value,
    max: value,
    currency,
    currencyStatus: 'known',
  };
}

function benefit(
  overrides: Partial<BenefitComponent> = {},
): BenefitComponent {
  return {
    type: 'other',
    coverage: 'included',
    valueKind: 'fixed',
    amount: amount(100),
    percentage: null,
    period: 'one-time',
    duration: null,
    scenarioKey: null,
    mutuallyExclusive: false,
    evidence: [evidence],
    confidence: 'high',
    ...overrides,
  };
}

function value(
  total: number,
  status: ValueStatus = 'EXACT',
  confidence: BenefitConfidence | null = 'high',
  currency = 'USD',
): ScholarshipValueResult {
  return {
    status,
    valueStatus: status,
    complete: true,
    duration: null,
    scenarioKey: null,
    totalValue: {
      min: total,
      max: total,
      currency,
      currencyStatus: 'known',
    },
    comparableTotalValue: {
      amount: total,
      upperBound: total,
      currency,
      bound: 'lower',
      fxVersion: 'test-fx-v1',
    },
    components: [
      {
        type: 'other',
        scenarioKey: null,
        source: 'explicit',
        status,
        included: true,
        sourceValue: amount(total, currency),
        totalValue: amount(total, currency),
        multiplier: 1,
        sourceType: 'catalogue-field',
        sourceVersion: 'test-v1',
        confidence,
        evidence: [evidence],
        reason: null,
      },
    ],
    warnings: [],
  };
}

function eligibility(
  scholarshipId: number,
  status: RecommendationEligibility['status'] = 'ELIGIBLE',
): RecommendationEligibility {
  return {
    scholarshipId,
    status,
    reasonCodes: [],
    warnings: [],
    missingSignals: [],
  };
}

function fit(
  scholarshipId: number,
  score: number | null,
  reasonCodes: RecommendationFit['reasonCodes'] = [],
  fitStatus: RecommendationFit['fitStatus'] = 'SCORED',
): RecommendationFit {
  return {
    scholarshipId,
    fitStatus,
    score,
    confidence: score === null ? 0 : 1,
    reasonCodes,
    warnings: [],
    missingSignals: [],
  };
}

function candidate(
  id: number,
  options: {
    name?: string;
    deadline?: string | null;
    benefits?: readonly BenefitComponent[];
    eligibility?: RecommendationEligibility | null;
    fit?: RecommendationFit | null;
    value?: ScholarshipValueResult | null;
  } = {},
): ScholarshipRecommendationCandidate<number> {
  return {
    id,
    name: options.name ?? `Scholarship ${id}`,
    deadline: options.deadline ?? null,
    benefits: options.benefits ?? [],
    eligibility: options.eligibility === undefined ? eligibility(id) : options.eligibility,
    fit: options.fit === undefined ? fit(id, 80) : options.fit,
    value: options.value === undefined ? value(100) : options.value,
    item: id,
  };
}

function policy(overrides: Partial<RecommendationPolicy> = {}): RecommendationPolicy {
  return {
    ...DEFAULT_RECOMMENDATION_POLICY,
    ...overrides,
    weights: {
      ...DEFAULT_RECOMMENDATION_POLICY.weights,
      ...(overrides.weights ?? {}),
    },
    valueQuality: {
      ...DEFAULT_RECOMMENDATION_POLICY.valueQuality,
      ...(overrides.valueQuality ?? {}),
    },
    confidenceQuality: {
      ...DEFAULT_RECOMMENDATION_POLICY.confidenceQuality,
      ...(overrides.confidenceQuality ?? {}),
    },
  };
}

function resultFor(
  results: ReturnType<typeof recommendScholarships>,
  id: number,
) {
  return results.recommendations.find((entry) => entry.candidate.id === id)!.result;
}

describe('GlowBal recommendation', () => {
  it('never recommends an ineligible candidate', () => {
    const result = resultFor(
      recommendScholarships([
        candidate(1, { eligibility: eligibility(1, 'INELIGIBLE'), fit: fit(1, null, [], 'INELIGIBLE') }),
        candidate(2),
      ]),
      1,
    );

    expect(result.recommended).toBe(false);
    expect(result.recommendationScore).toBeNull();
    expect(result.rank).toBeNull();
    expect(result.reasonCodes).toContain('hard-ineligible');
    expect(result.warnings.map((warning) => warning.code)).toContain('hard-ineligible');
  });

  it('keeps unknown eligibility visible but explicitly outside canonical recommendations', () => {
    const result = resultFor(
      recommendScholarships([
        candidate(1, { eligibility: eligibility(1, 'UNKNOWN'), fit: fit(1, null, [], 'UNKNOWN') }),
        candidate(2),
      ]),
      1,
    );

    expect(result.recommended).toBe(false);
    expect(result.rank).toBeNull();
    expect(result.reasonCodes).toContain('incomplete-eligibility');
    expect(result.warnings.map((warning) => warning.code)).toContain('eligibility-unknown');
  });

  it('is deterministic for repeated inputs', () => {
    const candidates = [
      candidate(2, { name: 'Beta', fit: fit(2, 70, ['preferred-country-match']) }),
      candidate(1, { name: 'Alpha', fit: fit(1, 70, ['subject-match']) }),
    ];

    expect(recommendScholarships(candidates, policy({ version: 'recommendation-test-v1' })))
      .toEqual(recommendScholarships(candidates, policy({ version: 'recommendation-test-v1' })));
  });

  it('returns policy version and changes in injected weights change the score predictably', () => {
    const candidates = [
      candidate(1, { fit: fit(1, 100), value: value(10) }),
      candidate(2, { fit: fit(2, 20), value: value(100) }),
    ];
    const fitPolicy = policy({
      version: 'recommendation-fit-heavy-v1',
      weights: { fit: 0.9, value: 0.05, evidence: 0.05 },
    });
    const valuePolicy = policy({
      version: 'recommendation-value-heavy-v1',
      weights: { fit: 0.1, value: 0.85, evidence: 0.05 },
    });
    const fitHeavy = recommendScholarships(candidates, fitPolicy);
    const valueHeavy = recommendScholarships(candidates, valuePolicy);

    expect(fitHeavy.policyVersion).toBe('recommendation-fit-heavy-v1');
    expect(valueHeavy.policyVersion).toBe('recommendation-value-heavy-v1');
    expect(resultFor(fitHeavy, 1).recommendationScore)
      .toBeGreaterThan(resultFor(fitHeavy, 2).recommendationScore!);
    expect(resultFor(valueHeavy, 2).recommendationScore)
      .toBeGreaterThan(resultFor(valueHeavy, 1).recommendationScore!);
  });

  it('distinguishes exact, mixed, and estimated value quality', () => {
    const results = recommendScholarships([
      candidate(1, { value: value(100, 'EXACT', 'high') }),
      candidate(2, { value: value(100, 'MIXED', 'medium') }),
      candidate(3, { value: value(100, 'ESTIMATED', 'low') }),
    ]);

    expect(resultFor(results, 1).recommendationScore)
      .toBeGreaterThan(resultFor(results, 2).recommendationScore!);
    expect(resultFor(results, 2).recommendationScore)
      .toBeGreaterThan(resultFor(results, 3).recommendationScore!);
    expect(resultFor(results, 1).reasonCodes).toContain('exact-award-value');
    expect(resultFor(results, 2).reasonCodes).toContain('mixed-award-value');
    expect(resultFor(results, 3).reasonCodes).toContain('estimated-award-value');
    expect(resultFor(results, 3).warnings.map((warning) => warning.code)).toContain('estimated-value');
  });

  it('does not emit an exact-value reason for an incomplete valuation', () => {
    const incomplete = {
      ...value(100, 'EXACT'),
      complete: false,
      totalValue: null,
      comparableTotalValue: null,
    };
    const result = resultFor(
      recommendScholarships([candidate(1, { value: incomplete })]),
      1,
    );

    expect(result.reasonCodes).not.toContain('exact-award-value');
    expect(result.reasonCodes).toContain('no-comparable-value');
  });

  it('does not treat missing value as zero and can recommend strong fit without a value', () => {
    const result = resultFor(
      recommendScholarships([
        candidate(1, { fit: fit(1, 95), value: null }),
        candidate(2, { fit: fit(2, 20), value: value(100) }),
      ]),
      1,
    );

    expect(result.recommended).toBe(true);
    expect(result.recommendationScore).toBeGreaterThan(0);
    expect(result.reasonCodes).toContain('no-comparable-value');
    expect(result.reasonData.valueScore).toBeNull();
  });

  it('keeps fit primary while allowing strong value to contribute', () => {
    const results = recommendScholarships([
      candidate(1, { fit: fit(1, 100), value: value(10) }),
      candidate(2, { fit: fit(2, 10), value: value(1_000) }),
    ]);

    expect(resultFor(results, 1).recommendationScore)
      .toBeGreaterThan(resultFor(results, 2).recommendationScore!);
    expect(resultFor(results, 2).recommendationScore).toBeGreaterThan(0);
    expect(resultFor(results, 2).reasonCodes).toContain('strong-financial-value');
  });

  it('emits deterministic reasons for matched fit signals and full tuition', () => {
    const result = resultFor(
      recommendScholarships([
        candidate(1, {
          fit: fit(1, 90, [
            'preferred-country-match',
            'selected-university-match',
            'selected-programme-match',
            'subject-match',
            'study-level-match',
          ]),
          benefits: [benefit({ type: 'tuition', coverage: 'full', valueKind: 'coverage', amount: null })],
        }),
      ]),
      1,
    );

    expect(result.reasonCodes).toEqual([
      'target-country-match',
      'target-university-match',
      'programme-match',
      'subject-match',
      'study-level-match',
      'personal-fit-match',
      'exact-award-value',
      'full-tuition',
      'strong-financial-value',
    ]);
    expect(result.reasonData.fitReasonCodes).toEqual([
      'preferred-country-match',
      'selected-university-match',
      'selected-programme-match',
      'subject-match',
      'study-level-match',
    ]);
  });

  it('selects top-K from the complete candidate set, not an input page', () => {
    const results = recommendScholarships(
      [
        candidate(1, { fit: fit(1, 90) }),
        candidate(2, { fit: fit(2, 80) }),
        candidate(3, { fit: fit(3, 70) }),
      ],
      policy({ topK: 2 }),
    );

    expect(results.recommendations.filter((entry) => entry.result.recommended).map((entry) => entry.result.rank))
      .toEqual([1, 2]);
    expect(resultFor(results, 3).recommended).toBe(false);
    expect(resultFor(results, 3).rank).toBeNull();
    expect(resultFor(results, 3).warnings.map((warning) => warning.code)).toContain('not-top-k');
  });

  it('uses deterministic name and id tie-breaks', () => {
    const results = recommendScholarships([
      candidate(2, { name: 'Same', fit: fit(2, 80) }),
      candidate(1, { name: 'Same', fit: fit(1, 80) }),
    ], policy({ topK: 2 }));

    const ranked = [...results.recommendations].sort(
      (left, right) => (left.result.rank ?? Infinity) - (right.result.rank ?? Infinity),
    );
    expect(ranked.map((entry) => entry.candidate.id)).toEqual([1, 2]);
    expect(ranked.map((entry) => entry.result.rank)).toEqual([1, 2]);
  });

  it('uses the explicit canonical target and does not compare raw GBP numerically', () => {
    const results = recommendScholarships([
      candidate(1, { value: value(100, 'EXACT', 'high', 'USD') }),
      candidate(2, { value: value(100, 'EXACT', 'high', 'GBP') }),
    ]);

    expect(resultFor(results, 1).reasonData.comparableValueScore).toBe(1);
    expect(resultFor(results, 2).reasonData.comparableValueScore).toBeNull();
    expect(resultFor(results, 2).reasonCodes).toContain('no-comparable-value');
  });

  it('uses an explicit already-converted target currency without defaulting unknown currencies', () => {
    const results = recommendScholarships([
      candidate(1, { value: value(100, 'EXACT', 'high', 'USD') }),
      candidate(2, { value: value(100, 'EXACT', 'high', 'GBP') }),
    ], policy({ comparisonCurrency: 'USD' }));

    expect(resultFor(results, 1).reasonData.comparableValueScore).toBe(1);
    expect(resultFor(results, 2).reasonData.comparableValueScore).toBeNull();
    expect(resultFor(results, 2).reasonCodes).toContain('no-comparable-value');
  });

  it('does not use AI match scores or Home editorial scores', () => {
    const base = candidate(1, { fit: fit(1, 60), value: value(50) });
    const withNonCanonicalScores = {
      ...base,
      aiMatchScore: 0,
      homeHighlightScore: 999,
    } as ScholarshipRecommendationCandidate<number> & {
      aiMatchScore: number;
      homeHighlightScore: number;
    };

    const first = resultFor(recommendScholarships([base]), 1);
    const second = resultFor(recommendScholarships([withNonCanonicalScores]), 1);
    expect(second).toEqual(first);
  });
});
