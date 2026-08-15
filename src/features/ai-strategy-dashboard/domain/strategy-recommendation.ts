import { z } from 'zod';

/**
 * F7 — Strategic Recommendation Framework ("Personalized Strategy").
 *
 * A synthesis over the Personal Report (`NarrativeProfile` —
 * coreIdentity/drivingForce/signaturePattern/emergingThemes, see
 * `applicant-analysis.ts`) and the Matching Report (`ProgrammeFit`, see
 * `@/features/apply/domain`). It answers a different question than either:
 * not "who is this applicant" or "how well do they fit this course", but
 * "given both of those, what is the strongest strategy to maximise their
 * competitiveness."
 *
 * ─── WHY THIS LIVES OUTSIDE evaluation/ ──────────────────────────────────────
 *
 * `domain/evaluation/*` (framework.ts, engine.ts, competency.ts,
 * programme-fit.ts, ...) is the Shared Evaluation Engine, F1-F6 — pure
 * derived reshapes of existing data, no model call. F7 is a real model call
 * that synthesises F1-F6's own output, one layer up — the same relationship
 * `applicant-analysis.ts` and `recommendation.ts` already have to the engine,
 * which is why this sits beside them rather than inside `evaluation/`.
 *
 * ─── WHY zod, NOT MANUAL NORMALISATION ───────────────────────────────────────
 *
 * `applicant-analysis.ts`'s AI output is normalised by hand (`toStringArray`/
 * `toProse`/`clampScore`) because its shape is flat. F7's is not: F7.1 is a
 * variable-length array of candidate directions, each independently scored
 * on six dimensions, and F7.4 is a variable-length array of opportunities
 * each carrying an enum recommendation. `match-insights.ts`'s
 * `programmeFitSchema` already establishes the pattern this codebase uses
 * for AI output that nests this way — `safeParse`, reject the whole
 * generation on a schema mismatch rather than silently coercing a
 * malformed comparison table into something that renders wrong.
 */

export const directionOptionSchema = z.object({
  name: z.string().min(1).max(80),
  identityFit: z.number().min(0).max(10),
  evidenceStrength: z.number().min(0).max(10),
  consistency: z.number().min(0).max(10),
  differentiation: z.number().min(0).max(10),
  futureAlignment: z.number().min(0).max(10),
  scalability: z.number().min(0).max(10),
  overall: z.number().min(0).max(10),
});
export type DirectionOption = z.infer<typeof directionOptionSchema>;

export const portfolioOpportunitySourceSchema = z.enum(['existing_activity', 'ai_proposed']);
export type PortfolioOpportunitySource = z.infer<typeof portfolioOpportunitySourceSchema>;

export const portfolioRecommendationSchema = z.enum([
  'highly_recommended',
  'recommended',
  'low_priority',
]);
export type PortfolioRecommendation = z.infer<typeof portfolioRecommendationSchema>;

export const portfolioOpportunitySchema = z.object({
  name: z.string().min(1).max(120),
  /** Whether this is one of the student's own saved activities/achievements, or an AI-proposed idea. */
  source: portfolioOpportunitySourceSchema,
  strategicContribution: z.string().min(1).max(400),
  recommendation: portfolioRecommendationSchema,
});
export type PortfolioOpportunity = z.infer<typeof portfolioOpportunitySchema>;

export const strategyRoadmapSchema = z.object({
  chosenStrategy: z.string().min(1).max(200),
  why: z.string().min(1).max(600),
  prioritize: z.array(z.string().min(1).max(200)).min(1).max(8),
  avoid: z.array(z.string().min(1).max(200)).min(1).max(8),
  expectedPositioning: z.string().min(1).max(300),
  longTermNarrative: z.string().min(1).max(600),
});
export type StrategyRoadmap = z.infer<typeof strategyRoadmapSchema>;

/** The full F7.1-F7.6 output, one AI response's worth. */
export const strategyRecommendationSchema = z.object({
  // F7.1
  directionOptions: z.array(directionOptionSchema).min(2).max(6),
  chosenDirection: z.string().min(1).max(80),
  chosenDirectionWhy: z.string().min(1).max(800),
  // F7.2
  narrative: z.string().min(1).max(1200),
  // F7.3
  positioningBefore: z.string().min(1).max(300),
  positioningAfter: z.string().min(1).max(300),
  positioningRationale: z.string().min(1).max(600),
  // F7.4
  portfolioEvaluations: z.array(portfolioOpportunitySchema).min(2).max(8),
  // F7.5
  differentiationInsight: z.string().min(1).max(600),
  differentiationProposal: z.string().min(1).max(600),
  // F7.6
  roadmap: strategyRoadmapSchema,
}).superRefine((strategy, context) => {
  if (!strategy.directionOptions.some(({ name }) => name === strategy.chosenDirection)) {
    context.addIssue({
      code: 'custom',
      path: ['chosenDirection'],
      message: 'chosenDirection must match one of directionOptions',
    });
  }
});
export type StrategyRecommendation = z.infer<typeof strategyRecommendationSchema>;

/** One `application_strategy_recommendations` row, as the report page needs it. */
export type StrategyRecommendationRecord = StrategyRecommendation & {
  id: string;
  applicationId: string;
  sourceAnalysisId: string | null;
  sourceMatchAnalysisId: string | null;
  pdfStoragePath: string | null;
  createdAt: string;
};

/**
 * Defensive row -> domain reader, same discipline as `narrativeFromRow` in
 * `applicant-analysis.ts`: trusts nothing about the stored JSONB columns
 * beyond `strategyRecommendationSchema` itself validating them. Returns
 * `null` on a malformed row (a hand-edited row, or one written by a future/
 * different shape) rather than throwing and taking the report page down —
 * the row was already validated once at insert time (see the API route), so
 * a parse failure here means the stored data and the current schema have
 * drifted, not that this generation was bad.
 */
export function strategyRecommendationFromRow(
  row: Record<string, unknown>,
): StrategyRecommendationRecord | null {
  const parsed = strategyRecommendationSchema.safeParse({
    directionOptions: row.direction_options,
    chosenDirection: row.chosen_direction,
    chosenDirectionWhy: row.chosen_direction_why,
    narrative: row.narrative,
    positioningBefore: row.positioning_before,
    positioningAfter: row.positioning_after,
    positioningRationale: row.positioning_rationale,
    portfolioEvaluations: row.portfolio_evaluations,
    differentiationInsight: row.differentiation_insight,
    differentiationProposal: row.differentiation_proposal,
    roadmap: row.roadmap,
  });
  if (!parsed.success) return null;

  return {
    ...parsed.data,
    id: row.id as string,
    applicationId: row.application_id as string,
    sourceAnalysisId: (row.source_analysis_id as string | null) ?? null,
    sourceMatchAnalysisId: (row.source_match_analysis_id as string | null) ?? null,
    pdfStoragePath: (row.pdf_storage_path as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}
