import { describe, expect, it } from 'vitest';
import { runProfileEvaluation, type ProfileEvaluationInput } from './engine';
import { EMPTY_CMCAITF } from './f1-reflection';
import type { NarrativeActivity } from './f4-narrative-identity';

const TUTOR: NarrativeActivity = {
  id: 'tutor',
  title: 'Peer tutoring programme',
  role: 'organiser',
  behaviour: 'built a structured weekly programme from scratch',
  domainTheme: 'education access',
  statedMotivation: 'I wanted to help classmates who fell behind after long absences.',
  outcome: 'Average scores rose by 15%.',
  evidenceRefs: [{ id: 'tutor', kind: 'activity', label: 'Peer tutoring' }],
};

const CODING: NarrativeActivity = {
  id: 'coding',
  title: 'School coding club',
  role: 'organiser',
  behaviour: 'built a curriculum and recruited 20 members',
  domainTheme: 'education access',
  statedMotivation: 'I wanted more students to have the chance to learn to code.',
  outcome: 'Membership grew to 45 students.',
  evidenceRefs: [{ id: 'coding', kind: 'activity', label: 'Coding club' }],
};

function input(overrides: Partial<ProfileEvaluationInput> = {}): ProfileEvaluationInput {
  return {
    subjectId: 'student-1',
    writtenFields: [
      {
        field: 'careerGoals',
        label: 'Career goals',
        value:
          'I want to work on hospital scheduling software. In 2024 I spent two months at Bach Mai Hospital rebuilding their outpatient rota.',
      },
    ],
    reflectionRecords: [
      { id: 'tutor', title: 'Peer tutoring', cmcaitf: EMPTY_CMCAITF, structuredCapture: false },
    ],
    competencyClaims: [],
    evidenceItems: [
      {
        id: 'e1',
        title: 'National maths prize',
        sourceKind: 'structured_achievement',
        quantifiedOutcome: 'Ranked 1st out of 5,000 competitors.',
        qualitativeOutcome: null,
        hasDocument: true,
        attributingOrganisation: 'Ministry of Education',
        level: 'Quốc gia',
      },
    ],
    narrativeActivities: [TUTOR, CODING],
    intendedDirection: null,
    generatedAt: '2026-08-13T00:00:00.000Z',
    ...overrides,
  };
}

describe('runProfileEvaluation', () => {
  it('runs every framework into one ProfileEvaluation', () => {
    const result = runProfileEvaluation(input());
    expect(result.subjectId).toBe('student-1');
    expect(result.vagueness.verdict).toBe('sufficient');
    expect(result.evidence.items).toHaveLength(1);
    expect(result.reflection.scores).toHaveLength(1);
    expect(result.narrativeIdentity.readiness.level).toBe('emerging');
    expect(result.programmeFit.classification).toBe('insufficient_data');
  });

  it('is pure — the same input twice gives the same result', () => {
    const args = input();
    expect(runProfileEvaluation(args)).toEqual(runProfileEvaluation(args));
  });

  it('never computes an admissions probability anywhere in the result', () => {
    const result = runProfileEvaluation(input());
    const serialized = JSON.stringify(result).toLowerCase();
    expect(serialized).not.toContain('probability');
    expect(serialized).not.toContain('chance of admission');
    expect(serialized).not.toContain('likelihood of admission');
  });

  it('takes the floor of every framework confidence, not the average', () => {
    const result = runProfileEvaluation(
      input({
        writtenFields: [{ field: 'careerGoals', label: 'Career goals', value: '' }],
      }),
    );
    expect(result.vagueness.confidence).toBe('low');
    expect(result.confidence).toBe('low');
  });

  it('handles a student with nothing entered without throwing', () => {
    const result = runProfileEvaluation(
      input({
        writtenFields: [],
        reflectionRecords: [],
        competencyClaims: [],
        evidenceItems: [],
        narrativeActivities: [],
      }),
    );
    expect(result.narrativeIdentity.readiness.level).toBe('none');
    expect(result.confidence).toBe('low');
    expect(result.evidence.items).toEqual([]);
  });

  it('produces a real evidence and competency read even with zero narrative activities', () => {
    // F3 and F2 need no model and no activities to run — a student who has
    // only entered achievements still gets real, working frameworks.
    const result = runProfileEvaluation(input({ narrativeActivities: [] }));
    expect(result.evidence.items).toHaveLength(1);
    expect(result.evidence.items[0]?.tier).toBe('verified');
  });

  it('consumes every explicit reflection signal into identity metadata and direction', () => {
    const signals = [
      { key: 'q1', dimension: 'interests_motivations' as const, value: 'building useful tools', status: 'isolated' as const },
      { key: 'q2', dimension: 'values_growth' as const, value: 'peer learning', status: 'isolated' as const },
      { key: 'q3', dimension: 'problem_domains' as const, value: 'education access', status: 'isolated' as const },
      { key: 'q4', dimension: 'capability_ownership' as const, value: 'organising teams', status: 'isolated' as const },
      { key: 'q5', dimension: 'academic_direction' as const, value: 'computer science', status: 'isolated' as const },
      { key: 'q6', dimension: 'career_direction' as const, value: 'education technology', status: 'isolated' as const },
      { key: 'q7', dimension: 'environment_preference' as const, value: 'collaborative teams', status: 'isolated' as const },
    ] as const;
    const result = runProfileEvaluation(input({ reflectionAnswerSignals: signals }));

    expect(result.narrativeIdentity.identity.reflectionSignals).toMatchObject({
      interests_motivations: 'building useful tools',
      values_growth: 'peer learning',
      problem_domains: 'education access',
      capability_ownership: 'organising teams',
      academic_direction: 'computer science',
      career_direction: 'education technology',
      environment_preference: 'collaborative teams',
    });
    expect(result.narrativeIdentity.identity.valueOrientation).toBe('peer learning');
    expect(result.narrativeIdentity.positioning.intendedDirection).toBe('computer science; education technology');
  });
});
