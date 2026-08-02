import { describe, expect, it } from 'vitest';
import type { PillarBreakdown, PillarKey } from '@/lib/match-insights';
import { lowestConfidence, runEvaluation, type EvaluationInput } from './engine';
import { EMPTY_NARRATIVE, type NarrativeProfile } from './reflection';
import type { ProgrammeFacts } from './programme-fit';

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

const PILLARS = {
  academic: pillar(),
  activities: pillar(),
  essays: pillar(),
  impact: pillar(),
  personal: pillar(),
} as Record<PillarKey, PillarBreakdown>;

const PROGRAMME: ProgrammeFacts = {
  courseName: 'MSc Health Administration',
  universityName: 'MIT',
  degreeLevel: "Master's",
  subject: null,
  studyMode: null,
  intake: null,
  deadline: null,
  tuitionFee: null,
  entryRequirementsSummary: null,
  englishRequirementsSummary: null,
  courseUrl: null,
};

const FULL_NARRATIVE: NarrativeProfile = {
  coreIdentity: 'A resilient, community-driven leader.',
  learningStyle: ['Learns by building'],
  academicStrengths: ['Statistics', 'Systems design'],
  drivingForce: 'Fixing systems that fail the people who need them most.',
  signaturePattern: ['Clinical exposure paired with software delivery'],
  emergingThemes: ['Access to care', 'Measurement'],
  personalPositioning: 'Lead with the hospital rota project.',
  growthAreas: ['No published research'],
  overallRating: 78,
};

function input(overrides: Partial<EvaluationInput> = {}): EvaluationInput {
  return {
    applicationId: 'app_1',
    writtenFields: [
      {
        field: 'careerGoals',
        label: 'Career goals',
        value:
          'I want to work on hospital scheduling software. In 2024 I spent two months at Bach Mai Hospital rebuilding their outpatient rota.',
      },
    ],
    evidence: [
      {
        id: 'e1',
        kind: 'achievement',
        title: 'National maths prize',
        category: 'academic_award',
        organisation: 'Ministry of Education',
        competition: null,
        level: 'Quốc gia',
        when: '2025',
        hasDocument: true,
      },
    ],
    narrative: FULL_NARRATIVE,
    pillars: PILLARS,
    overallFitPercent: 72,
    goalFitPercent: 88,
    matchConfidence: 'high',
    university: null,
    programme: PROGRAMME,
    generatedAt: '2026-08-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('lowestConfidence', () => {
  it('takes the floor, not the average', () => {
    // A report whose narrative rests on nothing is not "medium overall".
    expect(lowestConfidence(['high', 'high', 'low'])).toBe('low');
    expect(lowestConfidence(['high', 'medium'])).toBe('medium');
    expect(lowestConfidence(['high', 'high'])).toBe('high');
  });

  it('defaults to low with nothing to go on', () => {
    expect(lowestConfidence([])).toBe('low');
  });
});

describe('runEvaluation', () => {
  it('runs all six frameworks into one result', () => {
    const result = runEvaluation(input());
    expect(result.vagueness.verdict).toBe('sufficient');
    expect(result.evidence.items).toHaveLength(1);
    expect(result.competencies.competencies).toHaveLength(5);
    expect(result.programmeFit.overallFitPercent).toBe(72);
    expect(result.narrative.coreIdentity).toBe('A resilient, community-driven leader.');
  });

  it('exposes all six portrait sections when everything has content', () => {
    const result = runEvaluation(input());
    expect(result.portraitSections.map((s) => s.key)).toEqual([
      'core-identity',
      'driving-force',
      'signature-pattern',
      'emerging-themes',
      'personal-positioning',
      'proof-of-me',
    ]);
    expect(result.pendingSectionCount).toBe(0);
  });

  it('hides sections with nothing in them and counts what is pending', () => {
    const result = runEvaluation(input({ narrative: EMPTY_NARRATIVE }));
    // Only Proof of Me survives — it is derived from the achievement, not the AI.
    expect(result.portraitSections.map((s) => s.key)).toEqual(['proof-of-me']);
    expect(result.pendingSectionCount).toBe(5);
  });

  it('still produces Proof of Me with no narrative at all', () => {
    // The evidence hierarchy costs nothing and needs no model, so a student who
    // has entered achievements always has at least one real section.
    const result = runEvaluation({ ...input(), narrative: EMPTY_NARRATIVE });
    expect(result.evidence.items[0]?.tier).toBe('verified');
    expect(result.evidence.items[0]?.reach).toBe('national');
  });

  it('drops overall confidence to the weakest framework', () => {
    const result = runEvaluation(
      input({
        writtenFields: [{ field: 'careerGoals', label: 'Career goals', value: '' }],
      }),
    );
    expect(result.vagueness.confidence).toBe('low');
    expect(result.confidence).toBe('low');
  });

  it('is pure — the same input twice gives the same result', () => {
    const args = input();
    expect(runEvaluation(args)).toEqual(runEvaluation(args));
  });

  it('handles a student with nothing entered without throwing', () => {
    const result = runEvaluation(
      input({ writtenFields: [], evidence: [], narrative: EMPTY_NARRATIVE }),
    );
    expect(result.portraitSections).toEqual([]);
    expect(result.pendingSectionCount).toBe(6);
    expect(result.confidence).toBe('low');
  });
});
