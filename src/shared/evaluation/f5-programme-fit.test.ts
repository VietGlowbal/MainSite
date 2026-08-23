import { describe, expect, it } from 'vitest';
import {
  F5_DIMENSION_WEIGHTS,
  buildProgrammeFitPlaceholder,
  evaluateProgrammeFit,
  fitScoreToPercent,
  type F5Dimension,
  type F5DimensionKey,
  type ProgrammeFitEligibility,
} from './f5-programme-fit';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ELIGIBLE: ProgrammeFitEligibility = {
  requiredSubjects: 'met',
  minimumQualification: 'met',
  languageRequirement: 'met',
  citizenshipRequirement: 'met',
  deadline: 'met',
};

const assessed = (score: number): F5Dimension => ({
  status: 'assessed',
  score,
  summary: `Assessed at ${score}`,
  strengths: [],
  gaps: [],
  evidenceRefs: [],
});

const unassessed = (): F5Dimension => ({
  status: 'not_available',
  score: null,
  summary: '',
  strengths: [],
  gaps: [],
  evidenceRefs: [],
});

/** Order: academic, persona, career, financial, readiness. `null` → not_available, never zero-filled. */
function dims(
  academicCompetitiveness: number | null,
  personaAlignment: number | null,
  careerDirection: number | null,
  financialFeasibility: number | null,
  applicationReadiness: number | null,
): Record<F5DimensionKey, F5Dimension> {
  const build = (score: number | null) => (score === null ? unassessed() : assessed(score));
  return {
    academicCompetitiveness: build(academicCompetitiveness),
    personaAlignment: build(personaAlignment),
    careerDirection: build(careerDirection),
    financialFeasibility: build(financialFeasibility),
    applicationReadiness: build(applicationReadiness),
  };
}

describe('F5_DIMENSION_WEIGHTS', () => {
  it('sums to 1 so a fully-assessed profile needs no renormalisation', () => {
    const total = Object.values(F5_DIMENSION_WEIGHTS).reduce((a, w) => a + w, 0);
    expect(total).toBeCloseTo(1, 12);
  });

  it('matches the canonical spec weights', () => {
    expect(F5_DIMENSION_WEIGHTS).toEqual({
      academicCompetitiveness: 0.25,
      personaAlignment: 0.25,
      careerDirection: 0.2,
      financialFeasibility: 0.15,
      applicationReadiness: 0.15,
    });
  });
});

describe('fitScoreToPercent', () => {
  it('maps integer scores across the full 0-100 range', () => {
    expect(fitScoreToPercent(1)).toBe(0);
    expect(fitScoreToPercent(2)).toBe(25);
    expect(fitScoreToPercent(3)).toBe(50);
    expect(fitScoreToPercent(4)).toBe(75);
    expect(fitScoreToPercent(5)).toBe(100);
  });

  it('supports decimal scores', () => {
    expect(fitScoreToPercent(4.5)).toBe(88);
    expect(fitScoreToPercent(3.7)).toBe(68);
  });

  it('clamps inputs instead of allowing values outside 1-5', () => {
    expect(fitScoreToPercent(0)).toBe(0);
    expect(fitScoreToPercent(-2)).toBe(0);
    expect(fitScoreToPercent(9)).toBe(100);
  });
});

describe('evaluateProgrammeFit — scoring', () => {
  // 1
  it('scores all five dimensions with the canonical weights', () => {
    // 0.25·4 + 0.25·3 + 0.20·5 + 0.15·2 + 0.15·3 = 3.5
    const result = evaluateProgrammeFit({ eligibility: ELIGIBLE, dimensions: dims(4, 3, 5, 2, 3) });
    expect(result.compositeScore).toBeCloseTo(3.5, 10);
    expect(result.score).toBe(70);
    expect(result.classification).toBe('strong_match');
    expect(result.status).toBe('complete');
    expect(result.kind).toBe('observation');
    expect(result.missingInputs).toEqual([]);
  });

  // 2
  it('renormalises when one non-academic dimension is missing', () => {
    // Present weights: .25+.25+.15+.15 = .8; weighted sum 1+0.75+0.3+0.45 = 2.5 → 3.125.
    const result = evaluateProgrammeFit({ eligibility: ELIGIBLE, dimensions: dims(4, 3, null, 2, 3) });
    expect(result.compositeScore).toBeCloseTo(3.125, 10);
    expect(result.missingInputs).toEqual(['careerDirection']);
    expect(result.status).toBe('partial');
    // Classification still comes from the academic score alone.
    expect(result.classification).toBe('strong_match');
  });

  // 3
  it('renormalises when several non-academic dimensions are missing', () => {
    // Present weights: .25+.20 = .45; sum 1+1 = 2 → ≈4.4444.
    const result = evaluateProgrammeFit({ eligibility: ELIGIBLE, dimensions: dims(4, null, 5, null, null) });
    expect(result.compositeScore).toBeCloseTo(4.4444, 3);
    expect(result.missingInputs).toEqual(['personaAlignment', 'financialFeasibility', 'applicationReadiness']);
  });

  // 4
  it('reduces to the academic score alone when it is the only dimension present', () => {
    // 0.25 is a power of two, so renormalisation recovers the value exactly.
    const result = evaluateProgrammeFit({ eligibility: ELIGIBLE, dimensions: dims(4.2, null, null, null, null) });
    expect(result.compositeScore).toBe(4.2);
    expect(result.classification).toBe('strong_match');
  });

  // 6
  it('supports decimal dimension scores end to end', () => {
    const result = evaluateProgrammeFit({ eligibility: ELIGIBLE, dimensions: dims(3.7, 3.7, 3.7, 3.7, 3.7) });
    expect(result.compositeScore).toBeCloseTo(3.7, 10);
    expect(result.score).toBe(74);
    expect(fitScoreToPercent(3.7)).toBe(68);
  });

  // 12
  it('never lets filler content on a missing dimension change the weighted score', () => {
    const clean = dims(4, null, 5, 2, 3);
    const noisy = dims(4, null, 5, 2, 3);
    // A missing dimension that carries junk prose/evidence must score identically.
    noisy.personaAlignment = {
      ...unassessed(),
      summary: 'Leftover draft text that must be ignored',
      strengths: ['phantom strength'],
      gaps: ['phantom gap'],
      evidenceRefs: [{ id: 'x', kind: 'achievement', label: 'Phantom' }],
    };
    const a = evaluateProgrammeFit({ eligibility: ELIGIBLE, dimensions: clean });
    const b = evaluateProgrammeFit({ eligibility: ELIGIBLE, dimensions: noisy });
    expect(b.compositeScore).toBe(a.compositeScore);
    expect(b.classification).toBe(a.classification);
  });
});

describe('evaluateProgrammeFit — classification bands', () => {
  // 7 — every boundary of every academic band.
  const boundaries: Array<[number, string]> = [
    [5, 'safety'],
    [4.5, 'safety'],
    [4.49, 'strong_match'],
    [3.5, 'strong_match'],
    [3.49, 'match'],
    [2.5, 'match'],
    [2.49, 'reach'],
    [1, 'reach'],
  ];

  for (const [score, expected] of boundaries) {
    it(`classifies academic ${score} as ${expected}`, () => {
      const result = evaluateProgrammeFit({
        eligibility: ELIGIBLE,
        dimensions: dims(score, 3, 3, 3, 3),
      });
      expect(result.classification).toBe(expected);
    });
  }

  it('never lets the other four dimensions move the academic band', () => {
    // Academic 2.6 sits in `match`; perfect everything else must not lift it.
    const result = evaluateProgrammeFit({ eligibility: ELIGIBLE, dimensions: dims(2.6, 5, 5, 5, 5) });
    expect(result.classification).toBe('match');
    expect(result.compositeScore).toBeGreaterThan(4);
  });

  // 5 — academic missing means no band at all.
  it('returns the canonical insufficient_data classification when academic is not assessed', () => {
    const result = evaluateProgrammeFit({ eligibility: ELIGIBLE, dimensions: dims(null, 4, 4, 4, 4) });
    expect(result.classification).toBe('insufficient_data');
    expect(result.compositeScore).toBeNull();
    expect(result.score).toBeNull();
    expect(result.status).toBe('partial');
    expect(result.confidence).toBe('low');
    expect(result.kind).toBe('missing');
    expect(result.missingInputs).toEqual(['academicCompetitiveness']);
    expect(result.limitations.length).toBeGreaterThan(0);
  });

  // 8 — a failed hard gate overrides very high competitiveness.
  it('returns currently_ineligible on a hard-gate failure even with perfect scores', () => {
    const result = evaluateProgrammeFit({
      eligibility: { ...ELIGIBLE, deadline: 'not_met' },
      dimensions: dims(5, 5, 5, 5, 5),
    });
    expect(result.classification).toBe('currently_ineligible');
    expect(result.compositeScore).toBeNull();
    expect(result.score).toBeNull();
    expect(result.kind).toBe('observation');
  });

  // 9 — unknown gates are honest unknowns, not failures.
  it('classifies normally when hard gates are unknown rather than failed', () => {
    const result = evaluateProgrammeFit({
      eligibility: {
        requiredSubjects: 'unknown',
        minimumQualification: 'unknown',
        languageRequirement: 'unknown',
        citizenshipRequirement: 'unknown',
        deadline: 'unknown',
      },
      dimensions: dims(3.6, 3, 3, 3, 3),
    });
    expect(result.classification).toBe('strong_match');
  });

  // 10 — nothing at all.
  it('reports insufficient_data with every input listed when no dimension is assessed', () => {
    const result = evaluateProgrammeFit({ eligibility: ELIGIBLE, dimensions: dims(null, null, null, null, null) });
    expect(result.classification).toBe('insufficient_data');
    expect(result.compositeScore).toBeNull();
    expect(result.status).toBe('partial');
    expect(result.confidence).toBe('low');
    expect(result.missingInputs).toEqual([
      'academicCompetitiveness',
      'personaAlignment',
      'financialFeasibility',
      'careerDirection',
      'applicationReadiness',
    ]);
  });
});

// 11 — out-of-range scores are rejected at the deterministic engine itself.
describe('evaluateProgrammeFit — invalid input rejection', () => {
  it('throws when an assessed dimension score exceeds 5', () => {
    expect(() =>
      evaluateProgrammeFit({
        eligibility: ELIGIBLE,
        dimensions: { ...dims(4, 3, 3, 3, 3), academicCompetitiveness: assessed(5.5) },
      }),
    ).toThrow(/academicCompetitiveness/);
  });

  it('throws when an assessed dimension score is below 1', () => {
    expect(() =>
      evaluateProgrammeFit({
        eligibility: ELIGIBLE,
        dimensions: { ...dims(4, 3, 3, 3, 3), personaAlignment: assessed(0.4) },
      }),
    ).toThrow(/personaAlignment/);
  });

  it('throws for non-finite scores regardless of which branch would run', () => {
    expect(() =>
      evaluateProgrammeFit({
        eligibility: { ...ELIGIBLE, deadline: 'not_met' },
        dimensions: { ...dims(4, 3, 3, 3, 3), careerDirection: assessed(Number.NaN) },
      }),
    ).toThrow(/careerDirection/);
  });

  it('still rejects invalid data even when the hard gate fails first', () => {
    expect(() =>
      evaluateProgrammeFit({
        eligibility: { ...ELIGIBLE, requiredSubjects: 'not_met' },
        dimensions: { ...dims(4, 3, 3, 3, 3), financialFeasibility: assessed(7) },
      }),
    ).toThrow(/financialFeasibility/);
  });
});

describe('buildProgrammeFitPlaceholder', () => {
  it('assesses nothing and classifies insufficient_data until F5 runs for real', () => {
    const placeholder = buildProgrammeFitPlaceholder();
    expect(placeholder.status).toBe('not_implemented');
    expect(placeholder.classification).toBe('insufficient_data');
    expect(placeholder.compositeScore).toBeNull();
    expect(Object.values(placeholder.dimensions).every((d) => d.status === 'not_available' && d.score === null)).toBe(true);
  });
});
