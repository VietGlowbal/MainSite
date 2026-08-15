import { describe, expect, it } from 'vitest';
import {
  strategyRecommendationFromRow,
  strategyRecommendationSchema,
} from './strategy-recommendation';

function directionOption(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: 'Business Analytics for Education',
    identityFit: 9.7,
    evidenceStrength: 9.2,
    consistency: 9.0,
    differentiation: 9.4,
    futureAlignment: 10,
    scalability: 9.1,
    overall: 9.6,
    ...overrides,
  };
}

function portfolioOpportunity(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: 'Education NGO Data Project',
    source: 'ai_proposed',
    strategicContribution: 'Directly strengthens Business Analytics for Education.',
    recommendation: 'highly_recommended',
    ...overrides,
  };
}

function validStrategy(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    directionOptions: [directionOption(), directionOption({ name: 'Education Entrepreneurship' })],
    chosenDirection: 'Business Analytics for Education',
    chosenDirectionWhy: 'This direction integrates nearly every recurring pattern in your portfolio.',
    narrative: 'Throughout my experiences, I became increasingly interested in one question...',
    positioningBefore: 'Student interested in business, leadership, education, and technology.',
    positioningAfter:
      'A Business Analytics applicant who combines research, data, and product thinking to improve educational access.',
    positioningRationale: 'The second positioning is more focused.',
    portfolioEvaluations: [
      portfolioOpportunity(),
      portfolioOpportunity({ name: 'Marketing Competition', recommendation: 'recommended' }),
    ],
    differentiationInsight: 'Many applicants have coding projects, hackathons, consulting competitions.',
    differentiationProposal:
      'Build a public education analytics platform that helps students compare university pathways.',
    roadmap: {
      chosenStrategy: 'Become a Business Analytics applicant specializing in educational decision-making.',
      why: 'It is the strongest intersection of your identity, evidence, recurring themes, and intended academic direction.',
      prioritize: ['Education analytics research', 'User-centered product development'],
      avoid: ['Generic leadership programmes', 'Unrelated finance internships'],
      expectedPositioning: 'An applicant who combines business analytics, research, and product thinking.',
      longTermNarrative: 'From identifying information gaps to building scalable, data-driven systems.',
    },
    ...overrides,
  };
}

describe('strategyRecommendationSchema', () => {
  it('accepts a valid F7.1-F7.6 payload', () => {
    const result = strategyRecommendationSchema.safeParse(validStrategy());
    expect(result.success).toBe(true);
  });

  it('rejects fewer than 2 direction options — there is nothing to compare', () => {
    const result = strategyRecommendationSchema.safeParse(
      validStrategy({ directionOptions: [directionOption()] }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a direction score outside 0-10', () => {
    const result = strategyRecommendationSchema.safeParse(
      validStrategy({ directionOptions: [directionOption({ overall: 15 }), directionOption()] }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a chosen direction that is not one of the candidate options', () => {
    const result = strategyRecommendationSchema.safeParse(
      validStrategy({ chosenDirection: 'A direction that was not evaluated' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an unrecognised portfolio source or recommendation', () => {
    expect(
      strategyRecommendationSchema.safeParse(
        validStrategy({ portfolioEvaluations: [portfolioOpportunity({ source: 'made_up' })] }),
      ).success,
    ).toBe(false);
    expect(
      strategyRecommendationSchema.safeParse(
        validStrategy({
          portfolioEvaluations: [portfolioOpportunity({ recommendation: 'maybe' })],
        }),
      ).success,
    ).toBe(false);
  });

  it('rejects a roadmap missing prioritize/avoid lists', () => {
    const strategy = validStrategy();
    const roadmap = { ...(strategy.roadmap as Record<string, unknown>) };
    delete roadmap.prioritize;
    const result = strategyRecommendationSchema.safeParse({ ...strategy, roadmap });
    expect(result.success).toBe(false);
  });
});

describe('strategyRecommendationFromRow', () => {
  function row(overrides: Partial<Record<string, unknown>> = {}) {
    const strategy = validStrategy();
    return {
      id: 'rec-1',
      application_id: 'app-1',
      source_analysis_id: 'analysis-1',
      source_match_analysis_id: 'match-1',
      pdf_storage_path: null,
      created_at: '2026-08-08T00:00:00Z',
      direction_options: strategy.directionOptions,
      chosen_direction: strategy.chosenDirection,
      chosen_direction_why: strategy.chosenDirectionWhy,
      narrative: strategy.narrative,
      positioning_before: strategy.positioningBefore,
      positioning_after: strategy.positioningAfter,
      positioning_rationale: strategy.positioningRationale,
      portfolio_evaluations: strategy.portfolioEvaluations,
      differentiation_insight: strategy.differentiationInsight,
      differentiation_proposal: strategy.differentiationProposal,
      roadmap: strategy.roadmap,
      ...overrides,
    };
  }

  it('reads a well-formed row into a StrategyRecommendationRecord', () => {
    const record = strategyRecommendationFromRow(row());
    expect(record).not.toBeNull();
    expect(record?.id).toBe('rec-1');
    expect(record?.applicationId).toBe('app-1');
    expect(record?.chosenDirection).toBe('Business Analytics for Education');
    expect(record?.directionOptions).toHaveLength(2);
  });

  it('defaults nullable reference columns to null', () => {
    const record = strategyRecommendationFromRow(
      row({ source_analysis_id: null, source_match_analysis_id: null, pdf_storage_path: null }),
    );
    expect(record?.sourceAnalysisId).toBeNull();
    expect(record?.sourceMatchAnalysisId).toBeNull();
    expect(record?.pdfStoragePath).toBeNull();
  });

  it('returns null for a malformed row rather than throwing', () => {
    expect(strategyRecommendationFromRow(row({ direction_options: 'not an array' }))).toBeNull();
    expect(strategyRecommendationFromRow(row({ roadmap: null }))).toBeNull();
  });

});
