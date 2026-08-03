import { describe, expect, it } from 'vitest';
import {
  finalizeLorReview,
  LorStrategyInputSchema,
  LorStrategySchema,
  recommendationForScore,
} from './lor';

const modelReview = {
  summary: 'A credible letter with specific evidence and a clear recommender voice.',
  dimensions: [
    { id: 'recommender_context', score: 4, rationale: 'The relationship is clear.' },
    { id: 'specific_evidence', score: 9, rationale: 'The letter uses concrete examples.' },
    { id: 'quality_depth', score: 9, rationale: 'Qualities are interpreted, not listed.' },
    { id: 'recommender_voice', score: 9, rationale: 'The perspective is personal.' },
    { id: 'evidence_credibility', score: 9, rationale: 'Claims fit the relationship.' },
    { id: 'applicant_differentiation', score: 9, rationale: 'Peer context is present.' },
    { id: 'growth_potential', score: 9, rationale: 'Growth over time is visible.' },
    { id: 'complementarity', score: 8, rationale: 'The letter adds new insight.' },
    { id: 'recommendation_strength', score: 5, rationale: 'The endorsement is explicit.' },
  ],
  whatWorksWell: [
    {
      title: 'Clear recommender relationship',
      explanation: 'The letter establishes two years of direct observation.',
      evidenceQuote: 'I taught Olivia for two years.',
    },
  ],
  improvements: [
    {
      title: 'Add comparative context',
      explanation: 'The applicant is not compared with peers.',
      suggestion: 'If accurate, explain how the applicant stands out among peers.',
    },
  ],
  profileCoverage: [
    {
      trait: 'Intellectual curiosity',
      status: 'strongly_supported',
      explanation: 'Supported by a research example.',
    },
  ],
  suggestions: [
    {
      id: 'sug-1',
      type: 'missing',
      category: 'Applicant Differentiation',
      originalText: 'Olivia is an excellent student.',
      replacement: '[Add an accurate comparison with peers, if supported.]',
      explanation: 'Comparative context makes the endorsement more informative.',
    },
  ],
};

const sourceLetter =
  'I taught Olivia for two years. Olivia is an excellent student.';

describe('LOR quality review contract', () => {
  it('derives the raw score, normalized score, label, maxima, and checklist', () => {
    const result = finalizeLorReview(modelReview, sourceLetter);

    expect(result.rawScore).toBe(71);
    expect(result.score).toBe(84);
    expect(result.recommendation).toBe('Strong and credible');
    expect(result.dimensions).toHaveLength(9);
    expect(result.dimensions[0]).toMatchObject({
      id: 'recommender_context',
      label: 'Recommender Context',
      maxScore: 5,
    });
    expect(result.checklist).toHaveLength(9);
  });

  it('rejects a review with a duplicate or missing dimension', () => {
    const dimensions = [...modelReview.dimensions];
    dimensions[8] = dimensions[0];

    expect(() => finalizeLorReview({ ...modelReview, dimensions }, sourceLetter)).toThrow(
      /exactly once/i,
    );
  });

  it('rejects a dimension score above its rubric maximum', () => {
    const dimensions = modelReview.dimensions.map((dimension) =>
      dimension.id === 'recommender_context' ? { ...dimension, score: 6 } : dimension,
    );

    expect(() => finalizeLorReview({ ...modelReview, dimensions }, sourceLetter)).toThrow(/maximum/i);
  });

  it('removes model quotes and replacements that are not grounded in the letter', () => {
    const result = finalizeLorReview(
      {
        ...modelReview,
        whatWorksWell: [
          { ...modelReview.whatWorksWell[0], evidenceQuote: 'A fabricated exact quote.' },
        ],
        suggestions: [
          modelReview.suggestions[0],
          {
            ...modelReview.suggestions[0],
            id: 'sug-2',
            originalText: 'A fabricated passage.',
          },
          {
            ...modelReview.suggestions[0],
            id: 'sug-3',
            originalText: '',
          },
        ],
      },
      sourceLetter,
    );

    expect(result.whatWorksWell[0]).not.toHaveProperty('evidenceQuote');
    expect(result.suggestions.map(({ id }) => id)).toEqual(['sug-1', 'sug-3']);
  });

  it.each([
    [80, 'Strong and credible'],
    [79, 'Credible but needs strengthening'],
    [65, 'Credible but needs strengthening'],
    [64, 'Limited or uneven'],
    [45, 'Limited or uneven'],
    [44, 'Weak or generic'],
  ] as const)('maps %i to %s', (score, label) => {
    expect(recommendationForScore(score)).toBe(label);
  });
});

describe('LOR strategy contracts', () => {
  it('accepts the four F7.1 answers with typed evidence references', () => {
    expect(
      LorStrategyInputSchema.parse({
        applicationId: '11111111-1111-4111-8111-111111111111',
        recommenderType: 'subject_teacher',
        relationshipContext:
          'She taught me Economics in Grades 10 and 11 and supervised my research.',
        knownDuration: 'one_to_two_years',
        observedEvidence: [
          { kind: 'activity', id: '22222222-2222-4222-8222-222222222222' },
        ],
      }).observedEvidence,
    ).toHaveLength(1);
  });

  it('rejects duplicate evidence references at the request boundary', () => {
    const evidence = { kind: 'activity', id: '22222222-2222-4222-8222-222222222222' };

    expect(
      LorStrategyInputSchema.safeParse({
        applicationId: '11111111-1111-4111-8111-111111111111',
        recommenderType: 'subject_teacher',
        relationshipContext: 'She taught me Economics for two years.',
        knownDuration: 'one_to_two_years',
        observedEvidence: [evidence, evidence],
      }).success,
    ).toBe(false);
  });

  it('accepts a grounded F7.1 and F7.2 response', () => {
    const result = LorStrategySchema.parse({
      perspective: {
        summary: 'Ms. Nguyen has observed the applicant in class and research.',
        strongInsights: [
          {
            trait: 'Analytical thinking',
            explanation: 'She supervised the selected research activity.',
            evidenceRefs: ['activity:22222222-2222-4222-8222-222222222222'],
          },
        ],
        limitedInsights: [
          {
            topic: 'Community leadership',
            explanation: 'No selected evidence shows direct observation.',
          },
        ],
      },
      recommendations: [
        {
          trait: 'Analytical problem-solving',
          rationale: 'It is directly supported by the supervised research.',
          evidenceRefs: ['activity:22222222-2222-4222-8222-222222222222'],
          howToRaise: 'Ask whether she feels comfortable discussing the research process.',
          priority: 'high',
          confidence: 'high',
        },
      ],
      doNotPrioritize: [
        {
          trait: 'Community leadership',
          reason: 'The recommender did not directly observe it.',
        },
      ],
      recommendationBrief: 'Dear Ms. Nguyen, thank you for supporting my application.',
    });

    expect(result.recommendations[0]?.priority).toBe('high');
  });
});
