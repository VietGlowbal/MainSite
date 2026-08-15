import { describe, expect, it } from 'vitest';
import {
  COMPETENCY_TYPE_WEIGHT,
  buildCompetencyProfile,
  scoreCompetencyClaim,
  type CompetencyClaim,
} from './f2-competency';

function claim(overrides: Partial<CompetencyClaim> = {}): CompetencyClaim {
  return {
    id: 'c1',
    type: 'soft',
    label: 'Leadership',
    situation: null,
    evidenceRefs: [],
    ...overrides,
  };
}

describe('F2 — a bare trait label is rejected as an unsupported inference', () => {
  it('scores a bare skill label ("leadership") low, with no situation', () => {
    const score = scoreCompetencyClaim(claim({ label: 'Leadership', situation: null }));
    expect(score.status).toBe('ungrounded');
    expect(score.groundedness).toBeLessThan(45);
    expect(score.limitations[0]).toContain('bare trait label');
  });

  it('scores a concrete, evidenced situation strictly higher than the bare label', () => {
    const weak = scoreCompetencyClaim(claim({ label: 'Leadership', situation: null }));
    const strong = scoreCompetencyClaim(
      claim({
        label: 'Leadership',
        situation:
          'Coordinated a 12-person volunteer team to run a 3-day food drive that served 400 families in District 7.',
        evidenceRefs: [{ id: 'activity:1', kind: 'activity', label: 'Food drive' }],
      }),
    );
    expect(strong.groundedness).toBeGreaterThan(weak.groundedness);
    expect(strong.status).toBe('grounded');
  });
});

describe('F2 — evidence-backed claim vs unsupported claim', () => {
  it('never elevates a claim to fully grounded without a linked evidence record', () => {
    const noEvidence = scoreCompetencyClaim(
      claim({
        situation:
          'Coordinated a 12-person volunteer team to run a 3-day food drive that served 400 families.',
        evidenceRefs: [],
      }),
    );
    expect(noEvidence.status).not.toBe('ungrounded');
    expect(noEvidence.evidenceRefs).toEqual([]);
    expect(noEvidence.limitations[0]).toContain('no linked evidence record');
  });

  it('marks confidence high only when evidenceRefs actually back the claim', () => {
    const backed = scoreCompetencyClaim(
      claim({
        situation: 'Coordinated a 12-person volunteer team that ran a 3-day food drive.',
        evidenceRefs: [{ id: 'activity:1', kind: 'activity', label: 'Food drive' }],
      }),
    );
    const unbacked = scoreCompetencyClaim(
      claim({ situation: 'Coordinated a 12-person volunteer team that ran a 3-day food drive.' }),
    );
    expect(backed.confidence).toBe('high');
    expect(unbacked.confidence).not.toBe('high');
  });
});

describe('F2 formula', () => {
  it('applies the exact weights: 0.30 hard + 0.35 soft + 0.35 meta', () => {
    expect(COMPETENCY_TYPE_WEIGHT).toEqual({ hard: 0.3, soft: 0.35, meta: 0.35 });
    const total = Object.values(COMPETENCY_TYPE_WEIGHT).reduce((sum, w) => sum + w, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('combines all three categories into the weighted profile score', () => {
    const strongSituation =
      'Coordinated a 12-person volunteer team that ran a 3-day food drive serving 400 families.';
    const profile = buildCompetencyProfile([
      claim({ id: 'h1', type: 'hard', situation: strongSituation, evidenceRefs: [{ id: 'a', kind: 'activity', label: 'x' }] }),
      claim({ id: 's1', type: 'soft', situation: strongSituation, evidenceRefs: [{ id: 'a', kind: 'activity', label: 'x' }] }),
      claim({ id: 'm1', type: 'meta', situation: strongSituation, evidenceRefs: [{ id: 'a', kind: 'activity', label: 'x' }] }),
    ]);
    expect(profile.score).not.toBeNull();
    expect(profile.categories.hard.score).not.toBeNull();
    expect(profile.categories.soft.score).not.toBeNull();
    expect(profile.categories.meta.score).not.toBeNull();
  });
});

describe('F2 — missing metric handling', () => {
  it('reports a category as unassessed (null), not zero, when it has no claims', () => {
    const profile = buildCompetencyProfile([claim({ type: 'soft' })]);
    expect(profile.categories.hard.score).toBeNull();
    expect(profile.categories.meta.score).toBeNull();
    expect(profile.categories.hard.claims).toEqual([]);
  });

  it('renormalizes across the categories that do have claims', () => {
    const profile = buildCompetencyProfile([
      claim({ id: 's1', type: 'soft', situation: 'A specific, concrete situation with real detail described here.' }),
    ]);
    expect(profile.missingInputs).toEqual(expect.arrayContaining(['hard', 'meta']));
    expect(profile.score).not.toBeNull();
  });

  it('returns an unassessed profile when there are no claims at all', () => {
    const profile = buildCompetencyProfile([]);
    expect(profile.score).toBeNull();
    expect(profile.status).toBe('unassessed');
    expect(profile.kind).toBe('missing');
  });
});
