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

const TIER_THRESHOLDS = {
  strongChanceMin: 75,
  targetMin: 55,
} as const;

const BREAKDOWN_KEYS: Array<keyof MatchBreakdown> = [
  'country',
  'subjects',
  'budget',
  'level',
  'environment',
  'support',
];

function tierForScore(score: number): UniversityMatchTierV1 {
  if (score >= TIER_THRESHOLDS.strongChanceMin) return 'strong_chance';
  if (score >= TIER_THRESHOLDS.targetMin) return 'target';
  return 'reach';
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
): RankedUniversityMatch {
  const result = computeMatchResult(profile, university);
  const reasons = breakdownReasons(result.breakdown);
  return {
    universityId: university.id,
    universityName: university.name,
    country: university.country,
    score: result.percentage,
    tier: tierForScore(result.percentage),
    breakdown: result.breakdown,
    ...reasons,
  };
}

/** Rank all university candidates deterministically by university fit score. */
export function rankUniversityMatches(
  profile: StudentProfile,
  universities: UniversityMatchingCandidate[],
): RankedUniversityMatch[] {
  return universities
    .map((university) => evaluateUniversityMatch(profile, university))
    .sort((left, right) => right.score - left.score || left.universityId - right.universityId);
}

export { TIER_THRESHOLDS as UNIVERSITY_MATCH_TIER_THRESHOLDS };
