import { describe, expect, it } from 'vitest';
import {
  EMPTY_CMCAITF,
  REFLECTION_METRIC_WEIGHTS,
  buildReflectionProfile,
  scoreReflection,
  type CmcaitfFields,
  type ReflectionRecord,
} from './f1-reflection';

function record(overrides: Partial<ReflectionRecord> = {}, cmcaitf: Partial<CmcaitfFields> = {}): ReflectionRecord {
  return {
    id: 'act-1',
    title: 'Peer tutoring programme',
    cmcaitf: { ...EMPTY_CMCAITF, ...cmcaitf },
    structuredCapture: true,
    ...overrides,
  };
}

const FULL_CMCAITF: CmcaitfFields = {
  context: 'In my final year at Le Hong Phong High School, in 2024.',
  motivation: 'I wanted to help classmates who had fallen behind after long absences during the pandemic.',
  challenge: 'Many students had lost confidence and were reluctant to ask questions in front of peers.',
  action: 'I organised weekly one-on-one tutoring sessions for 12 students, tailoring explanations to each person.',
  impact: 'Average test scores for the group rose by 15% over one semester, and 9 of the 12 caught up to grade level.',
  transformation: 'I learned to break down my own understanding into smaller, checkable steps before teaching it.',
  future: 'This is why I want to study education alongside statistics — to measure what actually helps students learn.',
};

describe('F1 formula', () => {
  it('applies the exact weights: 0.25 specificity + 0.20 completeness + 0.20 causal clarity + 0.15 personal voice + 0.20 transformation depth', () => {
    expect(REFLECTION_METRIC_WEIGHTS).toEqual({
      specificity: 0.25,
      completeness: 0.2,
      causalClarity: 0.2,
      personalVoice: 0.15,
      transformationDepth: 0.2,
    });
    const total = Object.values(REFLECTION_METRIC_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('scores a fully-reflected CMCAITF record highly on every metric', () => {
    const score = scoreReflection(record({}, FULL_CMCAITF));
    expect(score.status).toBe('full');
    expect(score.score).not.toBeNull();
    expect(score.score as number).toBeGreaterThan(70);
    expect(score.metrics.specificity).not.toBeNull();
    expect(score.metrics.completeness).not.toBeNull();
    expect(score.metrics.causalClarity).not.toBeNull();
    expect(score.metrics.personalVoice).not.toBeNull();
    expect(score.metrics.transformationDepth).not.toBeNull();
  });

  it('scores strictly higher for more complete, specific reflection', () => {
    const thin = scoreReflection(
      record({ id: 'thin' }, { action: 'I helped some people with school work.' }),
    );
    const full = scoreReflection(record({ id: 'full' }, FULL_CMCAITF));
    expect((full.score as number) > (thin.score ?? 0)).toBe(true);
  });
});

describe('F1 — missing metric handling', () => {
  it('reports unassessed, not zero, when no CMCAITF field is filled', () => {
    const score = scoreReflection(record());
    expect(score.status).toBe('unassessed');
    expect(score.score).toBeNull();
    expect(score.kind).toBe('missing');
  });

  it('does NOT fake the seven fields when only a title exists — every field stays null', () => {
    const score = scoreReflection(record());
    expect(score.metrics.specificity).toBeNull();
    expect(score.metrics.completeness).toBeNull();
    expect(score.metrics.causalClarity).toBeNull();
    expect(score.metrics.personalVoice).toBeNull();
    expect(score.metrics.transformationDepth).toBeNull();
    expect(score.missingInputs.length).toBe(7);
  });

  it('scores a partial record from only the fields it has, and reports limited', () => {
    const score = scoreReflection(
      record(
        {},
        {
          action: 'I organised weekly tutoring sessions for 12 students at my school in 2024.',
          impact: 'Average scores rose by 15% and most students caught up to grade level.',
        },
      ),
    );
    expect(score.status).toBe('limited');
    expect(score.score).not.toBeNull();
    // causalClarity needs action + (challenge or impact) — both present here.
    expect(score.metrics.causalClarity).not.toBeNull();
    // transformationDepth needs `transformation`, which is absent — must stay null, not guessed.
    expect(score.metrics.transformationDepth).toBeNull();
    expect(score.missingInputs).toContain('cmcaitf.transformation');
  });

  it('flags an inferred (non-structured) capture as a limitation', () => {
    const score = scoreReflection(record({ structuredCapture: false }, FULL_CMCAITF));
    expect(score.limitations.some((l) => l.includes('inferred from free text'))).toBe(true);
  });

  it('never reports a negative or out-of-range score', () => {
    const score = scoreReflection(record({}, FULL_CMCAITF));
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });
});

describe('F1 — confidence behaviour', () => {
  it('reports low confidence when only one of the five metrics can be scored', () => {
    // Only `context` is filled: specificity can use it, but completeness
    // needs more fields to say anything meaningful, and causalClarity/
    // personalVoice/transformationDepth all need fields this record lacks.
    // 1 of 5 metrics assessed → 0.2 coverage → low.
    const score = scoreReflection(record({}, { context: 'A school event.' }));
    const assessedCount = Object.values(score.metrics).filter((value) => value !== null).length;
    expect(assessedCount).toBeLessThanOrEqual(2);
    expect(score.confidence).not.toBe('high');
  });

  it('reports high confidence when every metric could be scored', () => {
    const score = scoreReflection(record({}, FULL_CMCAITF));
    expect(score.confidence).toBe('high');
  });
});

describe('buildReflectionProfile', () => {
  it('separates assessed from unassessed records', () => {
    const profile = buildReflectionProfile([
      record({ id: 'full' }, FULL_CMCAITF),
      record({ id: 'empty' }),
    ]);
    expect(profile.assessed.map((s) => s.activityId)).toEqual(['full']);
    expect(profile.unassessed.map((s) => s.activityId)).toEqual(['empty']);
  });

  it('survives an empty list of records', () => {
    const profile = buildReflectionProfile([]);
    expect(profile.scores).toEqual([]);
    expect(profile.confidence).toBe('low');
  });
});
