import { describe, expect, it } from 'vitest';
import type { PillarBreakdown, PillarKey } from '@/lib/match-insights';
import { buildCompetencyProfile } from './competency';
import { buildProgrammeFit, type ProgrammeFacts, type UniversityFacts } from './programme-fit';

function pillar(overrides: Partial<PillarBreakdown> = {}): PillarBreakdown {
  return {
    current: 60,
    max: 80,
    assessed: true,
    summary: 'Solid.',
    evidenceQuotes: [],
    strengths: [],
    gaps: [],
    improvements: [],
    ...overrides,
  };
}

function pillars(overrides: Partial<Record<PillarKey, PillarBreakdown>> = {}) {
  return {
    academic: pillar(),
    activities: pillar(),
    essays: pillar(),
    impact: pillar(),
    personal: pillar(),
    ...overrides,
  } as Record<PillarKey, PillarBreakdown>;
}

const PROGRAMME: ProgrammeFacts = {
  courseName: 'MSc Health Administration',
  universityName: 'MIT',
  degreeLevel: "Master's",
  subject: 'Health Administration',
  studyMode: 'Full-time',
  intake: 'September 2027',
  deadline: '15 January 2027',
  tuitionFee: '$58,000',
  entryRequirementsSummary: 'A strong undergraduate record in a related field.',
  englishRequirementsSummary: 'IELTS 7.0',
  courseUrl: 'https://example.edu/mha',
};

function university(overrides: Partial<UniversityFacts> = {}): UniversityFacts {
  return {
    name: 'Massachusetts Institute of Technology',
    localName: null,
    country: 'United States',
    type: 'Private',
    qsRank: 1,
    theRank: 2,
    imageUrl: null,
    logoUrl: null,
    strengths: 'Engineering, computing',
    specificInsight: 'Strong network in public health policy.',
    teachingStyle: null,
    bestFor: 'Students who want a research-heavy programme.',
    gpaRange: '3.9+ GPA',
    englishRequirement: 'TOEFL 100+ / IELTS 7.0+',
    standardisedTest: 'SAT/ACT not required for 2024 entry',
    admissionDifficulty: 'Extremely competitive',
    acceptRate: '4%',
    tuitionUsd: '$58,000',
    livingCostUsd: '$22,000',
    housing: 'On-campus guaranteed for year one',
    scholarship: 'Need-based aid available to international students',
    ...overrides,
  };
}

function build(
  overrides: {
    pillars?: Record<PillarKey, PillarBreakdown>;
    university?: UniversityFacts | null;
  } = {},
) {
  const p = overrides.pillars ?? pillars();
  return buildProgrammeFit({
    competencies: buildCompetencyProfile(p, 'high'),
    university: overrides.university === undefined ? university() : overrides.university,
    programme: PROGRAMME,
    overallFitPercent: 72,
    goalFitPercent: 88,
    confidence: 'high',
  });
}

describe('buildProgrammeFit', () => {
  it('carries the two ring figures from real scores', () => {
    const fit = build({ pillars: pillars({ personal: pillar({ current: 92 }) }) });
    expect(fit.overallFitPercent).toBe(72);
    expect(fit.personaAlignmentPercent).toBe(92);
  });

  it('reports zero persona alignment when the pillar was never assessed', () => {
    // Not a low score — an unanswered question. The UI branches on the summary
    // being null rather than showing a 0% ring.
    const fit = build({ pillars: pillars({ personal: pillar({ assessed: false, current: 0 }) }) });
    expect(fit.personaAlignmentPercent).toBe(0);
    expect(fit.personaAlignmentSummary).toBeNull();
  });

  it('builds the requirements list without any met/unmet claim', () => {
    const fit = build();
    expect(fit.requirements).toEqual([
      { label: 'GPA', value: '3.9+ GPA' },
      { label: 'English', value: 'TOEFL 100+ / IELTS 7.0+' },
      { label: 'Standardised tests', value: 'SAT/ACT not required for 2024 entry' },
      { label: 'Acceptance rate', value: '4%' },
      { label: 'Difficulty', value: 'Extremely competitive' },
    ]);
    // No row carries a boolean — see the header on why ticks are unsafe here.
    for (const row of fit.requirements) {
      expect(Object.keys(row).sort()).toEqual(['label', 'value']);
    }
  });

  it('falls back to the course English requirement when the university has none', () => {
    const fit = build({ university: university({ englishRequirement: null }) });
    expect(fit.requirements).toContainEqual({ label: 'English', value: 'IELTS 7.0' });
  });

  it('drops blank and whitespace-only fields rather than rendering dashes', () => {
    const fit = build({
      university: university({ gpaRange: '   ', acceptRate: null, housing: '' }),
    });
    expect(fit.requirements.map((r) => r.label)).not.toContain('GPA');
    expect(fit.requirements.map((r) => r.label)).not.toContain('Acceptance rate');
    expect(fit.costs.map((r) => r.label)).not.toContain('Housing');
  });

  it('survives a course with no matched university row', () => {
    // university_id does not always resolve; the page must still render.
    const fit = build({ university: null });
    expect(fit.university).toBeNull();
    expect(fit.whyRecommended).toEqual([]);
    expect(fit.costs).toEqual([{ label: 'Tuition', value: '$58,000' }]);
    expect(fit.programmeOverview.length).toBeGreaterThan(0);
  });

  it('de-duplicates gaps named by more than one competency', () => {
    const fit = build({
      pillars: pillars({
        academic: pillar({ gaps: ['No maths olympiad'] }),
        impact: pillar({ gaps: ['No maths olympiad', 'No measured outcome'] }),
      }),
    });
    expect(fit.profileGaps).toEqual(['No maths olympiad', 'No measured outcome']);
  });

  it('keeps the scholarship note separate from the cost rows', () => {
    const fit = build();
    expect(fit.scholarshipNote).toBe('Need-based aid available to international students');
    expect(fit.costs.map((r) => r.label)).not.toContain('Scholarship');
  });
});

describe('buildCompetencyProfile', () => {
  it('separates unassessed competencies from low-scoring ones', () => {
    const profile = buildCompetencyProfile(
      pillars({ essays: pillar({ assessed: false, current: 0 }) }),
      'medium',
    );
    expect(profile.unassessed.map((c) => c.key)).toEqual(['essays']);
    expect(profile.assessed.map((c) => c.key)).not.toContain('essays');
  });

  it('never reports a ceiling below the score', () => {
    const profile = buildCompetencyProfile(pillars({ academic: pillar({ current: 70, max: 40 }) }), 'high');
    const academic = profile.competencies.find((c) => c.key === 'academic');
    expect(academic?.ceiling).toBe(70);
  });

  it('picks the biggest score-to-ceiling gap as the opportunity', () => {
    const profile = buildCompetencyProfile(
      pillars({
        academic: pillar({ current: 80, max: 85 }),
        impact: pillar({ current: 30, max: 90 }),
      }),
      'high',
    );
    expect(profile.biggestOpportunity?.key).toBe('impact');
  });

  it('returns no opportunity when nothing has been assessed', () => {
    const none = pillars();
    for (const key of Object.keys(none) as PillarKey[]) none[key] = pillar({ assessed: false });
    expect(buildCompetencyProfile(none, 'low').biggestOpportunity).toBeNull();
  });
});
