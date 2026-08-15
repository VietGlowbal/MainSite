import { describe, expect, it } from 'vitest';
import {
  evaluateUniversityMatch,
  rankUniversityMatches,
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
  it('scores university strengths against the target subject and assigns Strong Chance', () => {
    const result = evaluateUniversityMatch(profile, university({
      strengths: 'Computer Science, Artificial Intelligence and Robotics',
      best_for: 'Postgraduate technology students',
      tuition_usd: '$20,000',
      living_cost_usd: '$10,000',
      international_environment: 'Big city campus',
    }));

    expect(result.breakdown?.subjects.score).toBe(25);
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.tier).toBe('strong_chance');
  });

  it('keeps a plausible destination with weaker strength alignment in Target', () => {
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
    expect(result.tier).toBe('target');
  });

  it('places a destination and strength mismatch in Reach', () => {
    const result = evaluateUniversityMatch(profile, university({
      country: 'United Kingdom',
      strengths: 'Arts, Design and Media Studies',
      best_for: 'Creative undergraduate study',
      tuition_usd: '$50,000',
      living_cost_usd: '$20,000',
      international_environment: 'Historic campus town',
    }));

    expect(result.tier).toBe('reach');
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

  it('provides a public fixture covering all three university tiers', () => {
    expect(demoUniversityMatches().map((match) => match.tier)).toEqual([
      'strong_chance',
      'target',
      'reach',
    ]);
  });
});
