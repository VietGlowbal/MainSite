import { computeMatchResult, type MatchBreakdown } from '@/lib/matching';
import type { StudentProfile, University } from '@/lib/types';

/** The university-level candidate shape needed by the deterministic matcher. */
export type UniversityMatchingCandidate = Pick<University,
  | 'id'
  | 'name'
  | 'country'
  | 'type'
  | 'qs_rank'
  | 'strengths'
  | 'specific_insight'
  | 'teaching_style'
  | 'international_environment'
  | 'gpa_range'
  | 'english_requirement'
  | 'standardized_test'
  | 'admission_difficulty'
  | 'accept_rate'
  | 'scholarship'
  | 'tuition_usd'
  | 'living_cost_usd'
  | 'housing'
  | 'industry_connections'
  | 'internship_coop'
  | 'employability'
  | 'best_for'
  | 'notes'
>;

export type UniversityMatchTierV1 = 'strong_chance' | 'target' | 'reach';

export type UniversityMatchTierPolicy = Readonly<{
  strongChanceRatio: number;
  targetRatio: number;
  reachRatio: number;
}>;

export type RankedUniversityMatch = {
  universityId: number;
  universityName: string;
  country: string;
  score: number;
  tier: UniversityMatchTierV1;
  breakdown: MatchBreakdown | null;
  whyMatch: string[];
  watchOuts: string[];
};

export type UniversityMatchEvaluation = Omit<RankedUniversityMatch, 'tier'>;

export const DEFAULT_UNIVERSITY_MATCH_TIER_POLICY = {
  strongChanceRatio: 0.25,
  targetRatio: 0.5,
  reachRatio: 0.25,
} as const satisfies UniversityMatchTierPolicy;

const BREAKDOWN_KEYS: Array<keyof MatchBreakdown> = [
  'country',
  'subjects',
  'budget',
  'level',
  'environment',
  'support',
];

export type UniversityMatchTierCounts = Record<UniversityMatchTierV1, number>;

/**
 * Allocate a ranked candidate list into relative tiers for this user's result set.
 * Cumulative rounding keeps the intended distribution stable for small lists too.
 */
export function universityMatchTierCounts(
  total: number,
  policy: UniversityMatchTierPolicy = DEFAULT_UNIVERSITY_MATCH_TIER_POLICY,
): UniversityMatchTierCounts {
  if (!Number.isInteger(total) || total < 0) {
    throw new RangeError('University match total must be a non-negative integer');
  }

  const ratios = [policy.strongChanceRatio, policy.targetRatio, policy.reachRatio];
  if (
    ratios.some((ratio) => !Number.isFinite(ratio) || ratio < 0) ||
    Math.abs(ratios.reduce((sum, ratio) => sum + ratio, 0) - 1) > 0.0001
  ) {
    throw new Error('University match tier ratios must be non-negative and sum to 1');
  }

  const strongChanceCount = Math.round(total * policy.strongChanceRatio);
  const targetEnd = Math.round(total * (policy.strongChanceRatio + policy.targetRatio));
  return {
    strong_chance: strongChanceCount,
    target: targetEnd - strongChanceCount,
    reach: total - targetEnd,
  };
}

function breakdownReasons(
  breakdown: MatchBreakdown | null,
): { whyMatch: string[]; watchOuts: string[] } {
  if (!breakdown) return { whyMatch: [], watchOuts: [] };

  const factors = BREAKDOWN_KEYS.map((key) => breakdown[key]);
  return {
    whyMatch: factors
      .filter((factor) => factor.score >= factor.max * 0.6)
      .map((factor) => factor.reason),
    watchOuts: factors
      .filter((factor) => factor.score < factor.max * 0.6)
      .map((factor) => factor.reason),
  };
}

/** Evaluate one university against the student's stored profile inputs. */
export function evaluateUniversityMatch(
  profile: StudentProfile,
  university: UniversityMatchingCandidate,
): UniversityMatchEvaluation {
  const result = computeMatchResult(profile, university);
  const reasons = breakdownReasons(result.breakdown);
  return {
    universityId: university.id,
    universityName: university.name,
    country: university.country,
    score: result.percentage,
    breakdown: result.breakdown,
    ...reasons,
  };
}

/** Rank all university candidates deterministically by university fit score. */
export function rankUniversityMatches(
  profile: StudentProfile,
  universities: UniversityMatchingCandidate[],
  policy: UniversityMatchTierPolicy = DEFAULT_UNIVERSITY_MATCH_TIER_POLICY,
): RankedUniversityMatch[] {
  const ranked = universities
    .map((university) => evaluateUniversityMatch(profile, university))
    .sort((left, right) => right.score - left.score || left.universityId - right.universityId);

  const counts = universityMatchTierCounts(ranked.length, policy);
  const strongChanceEnd = counts.strong_chance;
  const targetEnd = strongChanceEnd + counts.target;

  return ranked.map((match, index) => {
    const tier = index < strongChanceEnd
      ? 'strong_chance'
      : index < targetEnd
        ? 'target'
        : 'reach';
    return { ...match, tier };
  });
}
