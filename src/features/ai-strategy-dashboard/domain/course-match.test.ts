import { describe, expect, it } from 'vitest';
import type { PillarBreakdown } from '@/lib/match-insights';
import { deriveCourseMatchAnalysis } from './course-match';

const inputs = { profile: true, cv: false, essay: false, activities: false };
const pillar = (current: number, assessed = true): PillarBreakdown => ({
  current, max: current, assessed, summary: 'Evidence is limited',
  gaps: ['Add supporting evidence'], evidenceQuotes: [], strengths: [], improvements: [],
});

describe('legacy course match with versioned reports', () => {
  it('does not invent zero scores or crash on the empty pillars saved by V3', () => {
    const result = deriveCourseMatchAnalysis('app', {}, 0, inputs, null, null);
    expect(result.overallMatchPercent).toBeNull();
    expect(result.goalMatchPercent).toBeNull();
    for (const score of [result.entryRequirementMatch, result.experienceMatch, result.personalQualitiesMatch]) {
      expect(score.score).toBeNull();
    }
    expect(result.missingAreas).toEqual([]);
    expect(result.admissionsRisk).toEqual([]);
  });

  it('averages only present assessed pillars and preserves an assessed zero', () => {
    const result = deriveCourseMatchAnalysis('app', {
      academic: pillar(0), activities: pillar(80), impact: pillar(20, false),
    }, 70, inputs, 50, 75);
    expect(result.entryRequirementMatch.score).toBe(0);
    expect(result.experienceMatch.score).toBe(80);
    expect(result.personalQualitiesMatch.score).toBeNull();
    expect(result.admissionsRisk).toEqual(['Evidence is limited']);
    expect(result.overallMatchPercent).toBe(50);
  });
});
