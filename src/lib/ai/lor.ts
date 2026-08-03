import { z } from 'zod';

export const LOR_DIMENSIONS = [
  { id: 'recommender_context', label: 'Recommender Context', maxScore: 5 },
  { id: 'specific_evidence', label: 'Specific Evidence', maxScore: 10 },
  { id: 'quality_depth', label: 'Quality Depth', maxScore: 10 },
  { id: 'recommender_voice', label: 'Recommender Voice', maxScore: 10 },
  { id: 'evidence_credibility', label: 'Evidence Credibility', maxScore: 10 },
  { id: 'applicant_differentiation', label: 'Applicant Differentiation', maxScore: 10 },
  { id: 'growth_potential', label: 'Growth & Potential', maxScore: 10 },
  { id: 'complementarity', label: 'Complementarity', maxScore: 10 },
  { id: 'recommendation_strength', label: 'Recommendation Strength', maxScore: 5 },
] as const;

const dimensionIdSchema = z.enum(LOR_DIMENSIONS.map(({ id }) => id) as [
  (typeof LOR_DIMENSIONS)[number]['id'],
  ...(typeof LOR_DIMENSIONS)[number]['id'][],
]);

export const LorEvidenceRefSchema = z.object({
  kind: z.enum(['activity', 'achievement']),
  id: z.string().uuid(),
});

export const LorStrategyInputSchema = z.object({
  applicationId: z.string().uuid(),
  recommenderType: z.enum([
    'subject_teacher',
    'homeroom_teacher',
    'school_counselor',
    'research_supervisor',
    'club_advisor',
    'internship_supervisor',
    'employer',
    'volunteer_supervisor',
    'coach',
    'academic_mentor',
    'other',
  ]),
  relationshipContext: z.string().trim().min(10).max(1_000),
  knownDuration: z.enum([
    'less_than_six_months',
    'six_to_twelve_months',
    'one_to_two_years',
    'more_than_two_years',
  ]),
  observedEvidence: z
    .array(LorEvidenceRefSchema)
    .max(12)
    .refine(
      (items) => new Set(items.map(({ kind, id }) => `${kind}:${id}`)).size === items.length,
      'Evidence references must be unique.',
    ),
});

const evidenceRefsSchema = z.array(z.string().trim().min(1).max(128)).max(12);

export const LorStrategySchema = z.object({
  perspective: z.object({
    summary: z.string().trim().min(1).max(1_200),
    strongInsights: z
      .array(
        z.object({
          trait: z.string().trim().min(1).max(120),
          explanation: z.string().trim().min(1).max(800),
          evidenceRefs: evidenceRefsSchema,
        }),
      )
      .max(8),
    limitedInsights: z
      .array(
        z.object({
          topic: z.string().trim().min(1).max(120),
          explanation: z.string().trim().min(1).max(800),
        }),
      )
      .max(8),
  }),
  recommendations: z
    .array(
      z.object({
        trait: z.string().trim().min(1).max(120),
        rationale: z.string().trim().min(1).max(1_000),
        evidenceRefs: evidenceRefsSchema,
        howToRaise: z.string().trim().min(1).max(1_000),
        priority: z.enum(['high', 'medium_high', 'medium', 'low']),
        confidence: z.enum(['high', 'medium', 'low']),
      }),
    )
    .min(1)
    .max(8),
  doNotPrioritize: z
    .array(
      z.object({
        trait: z.string().trim().min(1).max(120),
        reason: z.string().trim().min(1).max(800),
      }),
    )
    .max(8),
  recommendationBrief: z.string().trim().min(1).max(5_000),
});

const suggestionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  type: z.enum(['weak', 'missing', 'impact']),
  category: z.string().trim().min(1).max(120),
  originalText: z.string().max(2_000),
  // LOR feedback points to the part needing attention; the recommender writes it.
  replacement: z.string().max(2_000).optional().default(''),
  explanation: z.string().trim().min(1).max(1_000),
});

const lorReviewModelSchema = z.object({
  summary: z.string().trim().min(1).max(1_500),
  dimensions: z
    .array(
      z.object({
        id: dimensionIdSchema,
        score: z.number().int().min(0).max(10),
        rationale: z.string().trim().min(1).max(1_000),
      }),
    )
    .length(LOR_DIMENSIONS.length),
  whatWorksWell: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(160),
        explanation: z.string().trim().min(1).max(1_000),
        evidenceQuote: z.string().max(1_000).optional(),
      }),
    )
    .min(1)
    .max(6),
  improvements: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(160),
        explanation: z.string().trim().min(1).max(1_000),
        suggestion: z.string().trim().min(1).max(1_500),
      }),
    )
    .max(6),
  profileCoverage: z
    .array(
      z.object({
        trait: z.string().trim().min(1).max(160),
        status: z.enum(['strongly_supported', 'supported', 'not_covered', 'credibility_risk']),
        explanation: z.string().trim().min(1).max(800),
      }),
    )
    .min(1)
    .max(12),
  suggestions: z.array(suggestionSchema).max(6),
});

export type LorStrategyInput = z.infer<typeof LorStrategyInputSchema>;
export type LorStrategy = z.infer<typeof LorStrategySchema>;
export type LorReviewModel = z.infer<typeof lorReviewModelSchema>;

export type LorRecommendation =
  | 'Strong and credible'
  | 'Credible but needs strengthening'
  | 'Limited or uneven'
  | 'Weak or generic';

export function recommendationForScore(score: number): LorRecommendation {
  if (score >= 80) return 'Strong and credible';
  if (score >= 65) return 'Credible but needs strengthening';
  if (score >= 45) return 'Limited or uneven';
  return 'Weak or generic';
}

export function finalizeLorReview(value: unknown, sourceText: string) {
  const review = lorReviewModelSchema.parse(value);
  const byId = new Map(review.dimensions.map((dimension) => [dimension.id, dimension]));

  if (byId.size !== LOR_DIMENSIONS.length) {
    throw new Error('Every LOR quality dimension must appear exactly once.');
  }

  const dimensions = LOR_DIMENSIONS.map((rubric) => {
    const dimension = byId.get(rubric.id);
    if (!dimension) throw new Error('Every LOR quality dimension must appear exactly once.');
    if (dimension.score > rubric.maxScore) {
      throw new Error(`${rubric.label} exceeds its rubric maximum.`);
    }
    return { ...rubric, score: dimension.score, rationale: dimension.rationale };
  });
  const rawScore = dimensions.reduce((total, dimension) => total + dimension.score, 0);
  const score = Math.round((rawScore * 100) / 85);
  const whatWorksWell: typeof review.whatWorksWell = review.whatWorksWell.map(({ evidenceQuote, ...item }) =>
    evidenceQuote && sourceText.includes(evidenceQuote) ? { ...item, evidenceQuote } : item,
  );
  const suggestions = review.suggestions.filter(({ originalText, type }) =>
    originalText ? sourceText.includes(originalText) : type === 'missing',
  );

  return {
    score,
    rawScore,
    recommendation: recommendationForScore(score),
    summary: review.summary,
    dimensions,
    whatWorksWell,
    improvements: review.improvements,
    profileCoverage: review.profileCoverage,
    suggestions,
    checklist: dimensions.map((dimension, index) => ({
      id: index + 1,
      text: `${dimension.label}: ${dimension.rationale}`,
      met: dimension.score / dimension.maxScore >= 0.7,
    })),
  };
}

export type LorReview = ReturnType<typeof finalizeLorReview>;
