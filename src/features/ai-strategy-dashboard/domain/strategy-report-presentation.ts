import type {
  DirectionOption,
  PortfolioOpportunity,
  StrategyRecommendation,
} from './strategy-recommendation';

/**
 * Strategy Report — presentation derivations.
 *
 * The stored record is shaped by the F7 engine: six scored dimensions per
 * candidate direction, a portfolio list, positioning strings, a roadmap. The
 * report layout in docs/strategy-reports-spec.md is shaped by what a student
 * needs to read: where am I, what am I aiming at, what are my top three
 * priorities, what will change if I do them.
 *
 * This module is the translation between the two. Everything here is derived
 * from the stored record — no new claims are invented client-side, which is the
 * same rule the Personal Canvas UI follows.
 *
 * ─── WHY THE DIMENSION SCORES EARN THEIR KEEP HERE ───────────────────────────
 *
 * The old report rendered all six scores as a row of numbers per direction and
 * left the reading to the student. The scores are more useful as an argument:
 * the highest is the reason this direction was chosen, the lowest is the thing
 * most likely to undermine it. `keyStrength` and `biggestChallenge` do exactly
 * that, which is what the layout's Current Position block asks for.
 */

export const DIRECTION_DIMENSIONS = [
  'identityFit',
  'evidenceStrength',
  'consistency',
  'differentiation',
  'futureAlignment',
  'scalability',
] as const;

export type DirectionDimension = (typeof DIRECTION_DIMENSIONS)[number];

export const DIRECTION_DIMENSION_LABELS: Record<DirectionDimension, string> = {
  identityFit: 'Identity fit',
  evidenceStrength: 'Evidence strength',
  consistency: 'Consistency',
  differentiation: 'Differentiation',
  futureAlignment: 'Future alignment',
  scalability: 'Scalability',
};

export type DimensionReading = {
  key: DirectionDimension;
  label: string;
  score: number;
};

function readings(option: DirectionOption): DimensionReading[] {
  return DIRECTION_DIMENSIONS.map((key) => ({
    key,
    label: DIRECTION_DIMENSION_LABELS[key],
    score: option[key],
  }));
}

/**
 * Ties resolve to the first dimension in canonical order rather than to
 * whichever happens to sort first, so the same record always produces the same
 * sentence. A report that reworded itself between two identical loads would
 * look broken.
 */
export function keyStrength(option: DirectionOption): DimensionReading {
  return readings(option).reduce((best, current) =>
    current.score > best.score ? current : best,
  );
}

export function biggestChallenge(option: DirectionOption): DimensionReading {
  return readings(option).reduce((worst, current) =>
    current.score < worst.score ? current : worst,
  );
}

export function chosenOption(strategy: StrategyRecommendation): DirectionOption | null {
  return (
    strategy.directionOptions.find((option) => option.name === strategy.chosenDirection) ?? null
  );
}

export type RankedDirection = DirectionOption & {
  rank: number;
  isChosen: boolean;
  /** Points behind the top-ranked option. 0 for the leader. */
  margin: number;
};

/**
 * Directions ranked by overall score, with the gap to the leader.
 *
 * The margin matters: two directions half a point apart is a genuine choice the
 * student could revisit, while a four-point gap is not. Showing rank without it
 * makes every comparison look equally decisive.
 */
export function rankedDirections(strategy: StrategyRecommendation): RankedDirection[] {
  const sorted = [...strategy.directionOptions].sort((a, b) => b.overall - a.overall);
  const leader = sorted[0]?.overall ?? 0;
  return sorted.map((option, index) => ({
    ...option,
    rank: index + 1,
    isChosen: option.name === strategy.chosenDirection,
    margin: Number((leader - option.overall).toFixed(2)),
  }));
}

/**
 * True when the engine did not pick the top-scoring direction.
 *
 * Worth surfacing rather than hiding: the student should be told when the
 * recommendation departs from the raw ranking, because the reason will be in
 * `chosenDirectionWhy` and that is exactly when they need to read it.
 */
export function chosenDiffersFromTopScore(strategy: StrategyRecommendation): boolean {
  const ranked = rankedDirections(strategy);
  const top = ranked[0];
  if (!top) return false;
  return !top.isChosen;
}

export type PriorityLevel = 'high' | 'medium' | 'low';

export const PRIORITY_LEVEL_LABELS: Record<PriorityLevel, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const RECOMMENDATION_TO_LEVEL: Record<PortfolioOpportunity['recommendation'], PriorityLevel> = {
  highly_recommended: 'high',
  recommended: 'medium',
  low_priority: 'low',
};

export type StrategicPriorityRow = {
  priority: string;
  /** Whether this is something the student already has, or something to start. */
  currentSituation: string;
  whyItMatters: string;
  level: PriorityLevel;
};

/**
 * The layout's Strategic Priority table.
 *
 * Built from `portfolioEvaluations`, which is the only part of the record that
 * already carries a per-item priority judgement. The roadmap's `prioritize`
 * list is deliberately NOT used here: it is a list of bare strings with no
 * rationale and no level, so turning it into table rows would mean inventing
 * two of the four columns.
 */
export function strategicPriorities(strategy: StrategyRecommendation): StrategicPriorityRow[] {
  const order: Record<PriorityLevel, number> = { high: 0, medium: 1, low: 2 };
  return strategy.portfolioEvaluations
    .map((opportunity) => ({
      priority: opportunity.name,
      currentSituation:
        opportunity.source === 'existing_activity'
          ? 'Already in your portfolio'
          : 'Not started yet',
      whyItMatters: opportunity.strategicContribution,
      level: RECOMMENDATION_TO_LEVEL[opportunity.recommendation],
    }))
    .sort((a, b) => order[a.level] - order[b.level]);
}

export type StrategicOverview = {
  currentPosition: string;
  keyStrength: DimensionReading | null;
  biggestChallenge: DimensionReading | null;
  strategicGoal: string;
  strategicPositioning: string;
  topPriorities: string[];
  expectedOutcome: string;
  /** Things the strategy explicitly says not to spend effort on. */
  avoid: string[];
};

/**
 * Section 1 of the layout, assembled from fields that already exist.
 *
 * `topPriorities` is capped at three because the layout asks for three and
 * because a "top priorities" list of eight is not a priority list. The full
 * roadmap is still rendered further down the report.
 */
export function strategicOverview(strategy: StrategyRecommendation): StrategicOverview {
  const option = chosenOption(strategy);
  return {
    currentPosition: strategy.positioningBefore,
    keyStrength: option ? keyStrength(option) : null,
    biggestChallenge: option ? biggestChallenge(option) : null,
    strategicGoal: strategy.chosenDirection,
    strategicPositioning: strategy.positioningAfter,
    topPriorities: strategy.roadmap.prioritize.slice(0, 3),
    expectedOutcome: strategy.roadmap.expectedPositioning,
    avoid: strategy.roadmap.avoid,
  };
}

/**
 * Which parts of the layout's Profile Development Strategy this record can
 * actually fill.
 *
 * The layout asks for Academic, Experience and Differentiation strategies.
 * Only Differentiation exists in the F7 output today. Rather than pad the other
 * two with recycled prose, the report names them as not yet generated — see
 * docs/strategy-reports-spec.md.
 */
export type DevelopmentStrategies = {
  differentiation: { insight: string; proposal: string } | null;
  missing: Array<'academic' | 'experience'>;
};

export function developmentStrategies(strategy: StrategyRecommendation): DevelopmentStrategies {
  return {
    differentiation: {
      insight: strategy.differentiationInsight,
      proposal: strategy.differentiationProposal,
    },
    missing: ['academic', 'experience'],
  };
}
