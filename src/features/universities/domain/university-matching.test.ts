import { describe, expect, it } from 'vitest';
import {
  evaluateUniversityMatch,
  rankUniversityMatches,
  universityMatchTierCounts,
  type UniversityMatchingCandidate,
} from './university-matching';
import { demoUniversityMatches } from './university-matching-demo';
import type { StudentProfile } from '@/lib/types';

const profile: StudentProfile = {
  study_level: 'postgraduate',
  target_subjects: ['Technology'],
  preferred_countries: ['Canada'],
  budget_range: '$25k / year',
  campus_preferences: 'Big city',
  support_needs: 'Parents / family alignment',
};

function university(overrides: Partial<UniversityMatchingCandidate>): UniversityMatchingCandidate {
  return {
    id: 1,
    name: 'Fixture University',
    country: 'Canada',
    ...overrides,
  };
}

describe('university matching v1', () => {
  it('scores university strengths against the target subject', () => {
    const result = evaluateUniversityMatch(profile, university({
      strengths: 'Computer Science, Artificial Intelligence and Robotics',
      best_for: 'Postgraduate technology students',
      tuition_usd: '$20,000',
      living_cost_usd: '$10,000',
      international_environment: 'Big city campus',
    }));

    expect(result.breakdown?.subjects.score).toBe(25);
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it('keeps a plausible destination with weaker strength alignment in the raw score', () => {
    const result = evaluateUniversityMatch(profile, university({
      strengths: 'Business, Management and Economics',
      best_for: 'Postgraduate study',
      tuition_usd: '$15,000',
      living_cost_usd: '$10,000',
      international_environment: 'Suburban campus',
    }));

    expect(result.breakdown?.subjects.score).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(55);
    expect(result.score).toBeLessThan(75);
  });

  it('keeps destination and strength mismatch visible in watch-outs', () => {
    const result = evaluateUniversityMatch(profile, university({
      country: 'United Kingdom',
      strengths: 'Arts, Design and Media Studies',
      best_for: 'Creative undergraduate study',
      tuition_usd: '$50,000',
      living_cost_usd: '$20,000',
      international_environment: 'Historic campus town',
    }));

    expect(result.watchOuts.length).toBeGreaterThan(0);
  });

  it('ranks university recommendations deterministically by score then id', () => {
    const matches = rankUniversityMatches(profile, [
      university({ id: 3, name: 'Reach University', country: 'United Kingdom', strengths: 'Arts' }),
      university({ id: 2, name: 'Target University', strengths: 'Business', tuition_usd: '$15,000', living_cost_usd: '$10,000', best_for: 'Postgraduate study' }),
      university({ id: 1, name: 'Strong University', strengths: 'Computer Science', best_for: 'Postgraduate technology', tuition_usd: '$20,000', living_cost_usd: '$10,000', international_environment: 'Big city' }),
    ]);

    expect(matches.map((match) => match.universityId)).toEqual([1, 2, 3]);
  });

  it('assigns relative tiers as 25% Strong Chance, 50% Target and 25% Reach', () => {
    const matches = rankUniversityMatches(
      profile,
      Array.from({ length: 8 }, (_, index) => university({
        id: index + 1,
        name: `University ${index + 1}`,
      })),
    );

    expect(matches.filter((match) => match.tier === 'strong_chance')).toHaveLength(2);
    expect(matches.filter((match) => match.tier === 'target')).toHaveLength(4);
    expect(matches.filter((match) => match.tier === 'reach')).toHaveLength(2);
    expect(matches.slice(0, 2).every((match) => match.tier === 'strong_chance')).toBe(true);
    expect(matches.slice(2, 6).every((match) => match.tier === 'target')).toBe(true);
    expect(matches.slice(6).every((match) => match.tier === 'reach')).toBe(true);
  });

  it('supports a custom tier policy without changing the raw score order', () => {
    const matches = rankUniversityMatches(
      profile,
      Array.from({ length: 10 }, (_, index) => university({
        id: index + 1,
        name: `University ${index + 1}`,
      })),
      { strongChanceRatio: 0.4, targetRatio: 0.4, reachRatio: 0.2 },
    );

    expect(matches.filter((match) => match.tier === 'strong_chance')).toHaveLength(4);
    expect(matches.filter((match) => match.tier === 'target')).toHaveLength(4);
    expect(matches.filter((match) => match.tier === 'reach')).toHaveLength(2);
    expect(matches.map((match) => match.universityId)).toEqual(
      Array.from({ length: 10 }, (_, index) => index + 1),
    );
  });

  it('keeps tier allocation deterministic for small result sets', () => {
    expect(universityMatchTierCounts(1)).toEqual({ strong_chance: 0, target: 1, reach: 0 });
    expect(universityMatchTierCounts(2)).toEqual({ strong_chance: 1, target: 1, reach: 0 });
    expect(universityMatchTierCounts(3)).toEqual({ strong_chance: 1, target: 1, reach: 1 });
    expect(universityMatchTierCounts(108)).toEqual({ strong_chance: 27, target: 54, reach: 27 });
  });

  it('provides a public fixture covering all three university tiers', () => {
    expect(demoUniversityMatches().map((match) => match.tier)).toEqual([
      'strong_chance',
      'target',
      'reach',
    ]);
  });
});
