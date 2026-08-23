import { describe, expect, it } from 'vitest';
import type { StrategyRecommendation } from './strategy-recommendation';
import {
  DIRECTION_DIMENSIONS,
  biggestChallenge,
  chosenDiffersFromTopScore,
  chosenOption,
  developmentStrategies,
  keyStrength,
  rankedDirections,
  strategicOverview,
  strategicPriorities,
} from './strategy-report-presentation';

function option(name: string, scores: Partial<Record<string, number>> = {}) {
  return {
    name,
    identityFit: 5,
    evidenceStrength: 5,
    consistency: 5,
    differentiation: 5,
    futureAlignment: 5,
    scalability: 5,
    overall: 5,
    ...scores,
  };
}

function strategy(overrides: Partial<StrategyRecommendation> = {}): StrategyRecommendation {
  return {
    directionOptions: [option('EdTech'), option('Policy', { overall: 4 })],
    chosenDirection: 'EdTech',
    chosenDirectionWhy: 'why',
    narrative: 'narrative',
    positioningBefore: 'A capable generalist',
    positioningAfter: 'A focused EdTech builder',
    positioningRationale: 'rationale',
    portfolioEvaluations: [
      {
        name: 'Run a coding club',
        source: 'ai_proposed',
        strategicContribution: 'Shows technical follow-through',
        recommendation: 'highly_recommended',
      },
      {
        name: 'Maths olympiad',
        source: 'existing_activity',
        strategicContribution: 'Already evidences rigour',
        recommendation: 'low_priority',
      },
    ],
    differentiationInsight: 'insight',
    differentiationProposal: 'proposal',
    roadmap: {
      chosenStrategy: 'Depth over breadth',
      why: 'because',
      prioritize: ['One', 'Two', 'Three', 'Four'],
      avoid: ['Adding more clubs'],
      expectedPositioning: 'A credible builder',
      longTermNarrative: 'long term',
    },
    ...overrides,
  } as StrategyRecommendation;
}

describe('keyStrength and biggestChallenge', () => {
  it('picks the highest and lowest scored dimension of the chosen direction', () => {
    const chosen = option('EdTech', { differentiation: 9, evidenceStrength: 2 });
    expect(keyStrength(chosen).key).toBe('differentiation');
    expect(biggestChallenge(chosen).key).toBe('evidenceStrength');
  });

  it('resolves ties deterministically so the report does not reword itself', () => {
    const flat = option('EdTech');
    const first = DIRECTION_DIMENSIONS[0];
    expect(keyStrength(flat).key).toBe(first);
    expect(biggestChallenge(flat).key).toBe(first);
    // Same input, same output, every time.
    expect(keyStrength(flat)).toEqual(keyStrength(flat));
  });

  it('carries a human label alongside the score', () => {
    const chosen = option('EdTech', { futureAlignment: 10 });
    expect(keyStrength(chosen)).toMatchObject({ key: 'futureAlignment', score: 10 });
    expect(keyStrength(chosen).label).toBe('Future alignment');
  });
});

describe('rankedDirections', () => {
  it('orders by overall score and marks the chosen one', () => {
    const ranked = rankedDirections(strategy());
    expect(ranked.map((entry) => entry.name)).toEqual(['EdTech', 'Policy']);
    expect(ranked[0]?.isChosen).toBe(true);
    expect(ranked[0]?.rank).toBe(1);
  });

  it('reports how far each option sits behind the leader', () => {
    const ranked = rankedDirections(strategy());
    expect(ranked[0]?.margin).toBe(0);
    expect(ranked[1]?.margin).toBe(1);
  });

  it('flags when the recommendation is not the top-scoring option', () => {
    expect(chosenDiffersFromTopScore(strategy())).toBe(false);
    expect(
      chosenDiffersFromTopScore(strategy({ chosenDirection: 'Policy' })),
    ).toBe(true);
  });
});

describe('chosenOption', () => {
  it('returns null rather than guessing when the chosen name matches nothing', () => {
    expect(chosenOption(strategy({ chosenDirection: 'Nothing' }))).toBeNull();
  });
});

describe('strategicPriorities', () => {
  it('builds the priority table from portfolio evaluations, highest level first', () => {
    const rows = strategicPriorities(strategy());
    expect(rows[0]?.priority).toBe('Run a coding club');
    expect(rows[0]?.level).toBe('high');
    expect(rows[1]?.level).toBe('low');
  });

  it('distinguishes something already held from something to start', () => {
    const rows = strategicPriorities(strategy());
    expect(rows[0]?.currentSituation).toBe('Not started yet');
    expect(rows[1]?.currentSituation).toBe('Already in your portfolio');
  });

  it('carries the real rationale rather than a generated one', () => {
    expect(strategicPriorities(strategy())[0]?.whyItMatters).toBe(
      'Shows technical follow-through',
    );
  });
});

describe('strategicOverview', () => {
  it('caps top priorities at three even when the roadmap lists more', () => {
    const overview = strategicOverview(strategy());
    expect(overview.topPriorities).toEqual(['One', 'Two', 'Three']);
  });

  it('draws current position and expected outcome from stored positioning', () => {
    const overview = strategicOverview(strategy());
    expect(overview.currentPosition).toBe('A capable generalist');
    expect(overview.strategicPositioning).toBe('A focused EdTech builder');
    expect(overview.expectedOutcome).toBe('A credible builder');
  });

  it('degrades to null strength and challenge when the chosen direction is unresolvable', () => {
    const overview = strategicOverview(strategy({ chosenDirection: 'Nothing' }));
    expect(overview.keyStrength).toBeNull();
    expect(overview.biggestChallenge).toBeNull();
    // The rest of the overview still renders.
    expect(overview.currentPosition).toBe('A capable generalist');
  });

  it('keeps what to avoid, which is as much a decision as what to do', () => {
    expect(strategicOverview(strategy()).avoid).toEqual(['Adding more clubs']);
  });
});

describe('developmentStrategies', () => {
  it('names academic and experience as not yet generated rather than padding them', () => {
    const strategies = developmentStrategies(strategy());
    expect(strategies.differentiation).toEqual({ insight: 'insight', proposal: 'proposal' });
    expect(strategies.missing).toEqual(['academic', 'experience']);
  });
});
