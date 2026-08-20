import { describe, expect, it } from 'vitest';
import {
  assessProgrammeFit,
  buildProgrammeFitPlaceholder,
  fitScoreToPercent,
  F5_DIMENSION_KEYS,
  F5_WEIGHTS,
  type AcademicBand,
  type F5Dimension,
  type F5DimensionKey,
  type ProgrammeFitEligibility,
} from './f5-programme-fit';

const ALL_MET: ProgrammeFitEligibility = {
  requiredSubjects: 'met',
  minimumQualification: 'met',
  languageRequirement: 'met',
  citizenshipRequirement: 'met',
  deadline: 'met',
};

const ALL_UNKNOWN: ProgrammeFitEligibility = {
  requiredSubjects: 'unknown',
  minimumQualification: 'unknown',
  languageRequirement: 'unknown',
  citizenshipRequirement: 'unknown',
  deadline: 'unknown',
};

function dimension(score: number | null, overrides: Partial<F5Dimension> = {}): F5Dimension {
  return {
    status: score === null ? 'not_available' : 'assessed',
    score,
    summary: 'summary',
    strengths: [],
    gaps: [],
    evidenceRefs: [],
    ...overrides,
  };
}

function dimensions(scores: Partial<Record<F5DimensionKey, number | null>>) {
  const built = {} as Record<F5DimensionKey, F5Dimension>;
  for (const key of F5_DIMENSION_KEYS) {
    built[key] = dimension(key in scores ? (scores[key] ?? null) : 3);
  }
  return built;
}

function fit(
  academicBand: AcademicBand,
  scores: Partial<Record<F5DimensionKey, number | null>> = {},
  eligibility: ProgrammeFitEligibility = ALL_MET,
) {
  return assessProgrammeFit({ eligibility, academicBand, dimensions: dimensions(scores) });
}

describe('F5 weights', () => {
  it('sums to exactly 1 so an unrenormalized score cannot drift', () => {
    const total = F5_DIMENSION_KEYS.reduce((sum, key) => sum + F5_WEIGHTS[key], 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe('fitScoreToPercent', () => {
  it('maps the rubric ends to the full 0-100 range', () => {
    expect(fitScoreToPercent(1)).toBe(0);
    expect(fitScoreToPercent(5)).toBe(100);
    expect(fitScoreToPercent(3)).toBe(50);
  });

  it('reaches the fractional percentages the report layout uses', () => {
    expect(fitScoreToPercent(4)).toBe(75);
    expect(fitScoreToPercent(4.52)).toBe(88);
    expect(fitScoreToPercent(4.68)).toBe(92);
  });

  it('keeps "not assessed" distinct from zero', () => {
    expect(fitScoreToPercent(null)).toBeNull();
    expect(fitScoreToPercent(1)).toBe(0);
  });

  it('clamps out-of-range input rather than emitting an impossible percentage', () => {
    expect(fitScoreToPercent(0)).toBe(0);
    expect(fitScoreToPercent(9)).toBe(100);
  });
});

describe('F5 classification — hard gates come first', () => {
  it('returns currently_ineligible when any single gate fails, whatever the scores', () => {
    const result = fit('above_range', { academicCompetitiveness: 5 }, {
      ...ALL_MET,
      languageRequirement: 'not_met',
    });
    expect(result.classification).toBe('currently_ineligible');
    expect(result.failedGates).toEqual(['languageRequirement']);
  });

  it('reports every failed gate, not just the first', () => {
    const result = fit('lower_range', {}, {
      ...ALL_MET,
      requiredSubjects: 'not_met',
      deadline: 'not_met',
    });
    expect(result.failedGates).toEqual(['requiredSubjects', 'deadline']);
  });

  it('treats unknown as not-checked rather than as a failure', () => {
    const result = fit('lower_range', {}, ALL_UNKNOWN);
    expect(result.classification).toBe('match');
    expect(result.failedGates).toEqual([]);
  });
});

describe('F5 classification — academic band decides the label', () => {
  it.each([
    ['above_range', 'safety'],
    ['upper_range', 'strong_match'],
    ['lower_range', 'match'],
    ['below_range', 'reach'],
  ] as const)('%s maps to %s', (band, expected) => {
    expect(fit(band).classification).toBe(expected);
  });

  it('is insufficient_data when the programme publishes no usable range', () => {
    const result = fit('unknown');
    expect(result.classification).toBe('insufficient_data');
    expect(result.limitations.join(' ')).toContain('no usable admitted-grade range');
  });

  it('is insufficient_data when academic standing itself could not be assessed', () => {
    expect(fit('upper_range', { academicCompetitiveness: null }).classification).toBe(
      'insufficient_data',
    );
  });

  it('does NOT let a strong non-academic dimension lift the band', () => {
    const strongValues = fit('below_range', {
      academicCompetitiveness: 2,
      personaAlignment: 5,
      careerDirection: 5,
      financialFeasibility: 5,
      applicationReadiness: 5,
    });
    expect(strongValues.classification).toBe('reach');
  });

  it('does NOT let a weak non-academic dimension lower the band', () => {
    const weakValues = fit('above_range', {
      academicCompetitiveness: 5,
      personaAlignment: 1,
      careerDirection: 1,
      financialFeasibility: 1,
      applicationReadiness: 1,
    });
    expect(weakValues.classification).toBe('safety');
  });
});

describe('F5 scoring', () => {
  it('applies the documented weights', () => {
    const result = fit('lower_range', {
      academicCompetitiveness: 5,
      personaAlignment: 4,
      financialFeasibility: 3,
      careerDirection: 2,
      applicationReadiness: 1,
    });
    // 0.25*5 + 0.25*4 + 0.15*3 + 0.20*2 + 0.15*1 = 3.25
    expect(result.score).toBeCloseTo(3.25, 10);
    expect(result.matchPercent).toBe(56);
  });

  it('renormalizes around a missing dimension instead of scoring it zero', () => {
    const withMoney = fit('lower_range', { financialFeasibility: 1 });
    const withoutMoney = fit('lower_range', { financialFeasibility: null });
    // Everything else is 3. Dropping the dimension must land on 3, not drag
    // the average down the way a zero would.
    expect(withoutMoney.score).toBeCloseTo(3, 10);
    expect(withMoney.score).toBeLessThan(withoutMoney.score as number);
  });

  it('discloses the renormalization rather than doing it silently', () => {
    const result = fit('lower_range', { financialFeasibility: null });
    expect(result.missingInputs).toEqual(['financialFeasibility']);
    expect(result.limitations.join(' ')).toContain('financialFeasibility');
    expect(result.limitations.join(' ')).toContain('not a penalty');
  });

  it('returns a null score, not a zero, when nothing at all could be assessed', () => {
    const result = fit('unknown', {
      academicCompetitiveness: null,
      personaAlignment: null,
      financialFeasibility: null,
      careerDirection: null,
      applicationReadiness: null,
    });
    expect(result.score).toBeNull();
    expect(result.matchPercent).toBeNull();
    expect(result.kind).toBe('missing');
  });

  it('derives confidence from how much could actually be assessed', () => {
    expect(fit('lower_range').confidencePercent).toBe(100);
    expect(fit('lower_range').confidence).toBe('high');

    const thin = fit('lower_range', {
      personaAlignment: null,
      financialFeasibility: null,
      careerDirection: null,
    });
    expect(thin.confidencePercent).toBe(40);
    expect(thin.confidence).toBe('medium');
  });

  it('exposes readiness separately from the overall match score', () => {
    const result = fit('lower_range', { applicationReadiness: 5 });
    expect(result.readinessPercent).toBe(100);
    expect(result.matchPercent).not.toBe(100);
  });
});

describe('buildProgrammeFitPlaceholder', () => {
  it('is not_assessed everywhere and never emits a zero score', () => {
    const placeholder = buildProgrammeFitPlaceholder();
    expect(placeholder.classification).toBe('insufficient_data');
    expect(placeholder.matchPercent).toBeNull();
    expect(placeholder.readinessPercent).toBeNull();
    expect(placeholder.confidencePercent).toBe(0);
    for (const key of F5_DIMENSION_KEYS) {
      expect(placeholder.dimensions[key].status).toBe('not_available');
      expect(placeholder.dimensions[key].score).toBeNull();
    }
  });

  it('does not claim the applicant fails any gate', () => {
    expect(buildProgrammeFitPlaceholder().failedGates).toEqual([]);
  });
});
