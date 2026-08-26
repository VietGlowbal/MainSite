import { describe, expect, it } from 'vitest';
import { assessProgrammeFit, type AcademicBand } from '@/shared/evaluation/f5-programme-fit';
import {
  academicBandClassification,
  canonicalize,
  enforceFitClassification,
  type ProgrammeFit,
} from './ai-reports';

describe('AI report contracts', () => {
  it('canonicalizes object keys without changing array order', () => {
    expect(canonicalize({ z: 1, a: [{ y: 2, x: 1 }] })).toEqual({
      a: [{ x: 1, y: 2 }],
      z: 1,
    });
  });

  it('lets failed hard filters override an optimistic model classification', () => {
    const dimension = {
      status: 'assessed' as const,
      score: 4,
      summary: 'Có dữ liệu.',
      strengths: [],
      gaps: [],
      evidence: [],
    };
    const fit: ProgrammeFit = {
      classification: 'safety',
      confidence: 70,
      limitations: [],
      eligibility: {
        requiredSubjects: 'not_met',
        minimumQualification: 'met',
        languageRequirement: 'met',
        citizenshipRequirement: 'unknown',
        deadline: 'met',
      },
      dimensions: {
        academicCompetitiveness: dimension,
        personaAlignment: dimension,
        financialFeasibility: dimension,
        careerDirection: dimension,
        applicationReadiness: dimension,
      },
    };

    expect(enforceFitClassification(fit).classification).toBe('currently_ineligible');
  });

  it('derives reach, match, or safety from the assessed academic band', () => {
    const dimension = {
      status: 'assessed' as const,
      score: 4,
      summary: 'Có dữ liệu.',
      strengths: [],
      gaps: [],
      evidence: [],
    };
    const fit: ProgrammeFit = {
      classification: 'safety',
      confidence: 70,
      limitations: [],
      eligibility: {
        requiredSubjects: 'met',
        minimumQualification: 'met',
        languageRequirement: 'met',
        citizenshipRequirement: 'unknown',
        deadline: 'met',
      },
      dimensions: {
        academicCompetitiveness: dimension,
        personaAlignment: dimension,
        financialFeasibility: dimension,
        careerDirection: dimension,
        applicationReadiness: dimension,
      },
    };

    // 4 is strong_match since that band was introduced — comfortably inside the
    // programme's range without being clearly above it.
    expect(enforceFitClassification(fit).classification).toBe('strong_match');
  });

  it.each([
    [5, 'safety'],
    [4.5, 'safety'],
    [4, 'strong_match'],
    [3.5, 'strong_match'],
    [3, 'match'],
    [2.5, 'match'],
    [2, 'reach'],
    [1, 'reach'],
  ] as const)('academic score %s classifies as %s', (score, expected) => {
    expect(academicBandClassification(score)).toBe(expected);
  });

  it('agrees with the shared engine, which owns the same rule for deterministic input', () => {
    // Two implementations exist because the model-backed path and the
    // deterministic path take different inputs. They must never disagree about
    // the same band, or a student sees one label on the report and another in
    // the Planner.
    const flat = {
      status: 'assessed' as const,
      score: 3,
      summary: '',
      strengths: [],
      gaps: [],
      evidenceRefs: [],
    };
    const bands: Array<[number, AcademicBand]> = [
      [5, 'above_range'],
      [4, 'upper_range'],
      [3, 'lower_range'],
      [1, 'below_range'],
    ];
    for (const [score, band] of bands) {
      const engine = assessProgrammeFit({
        academicBand: band,
        eligibility: {
          requiredSubjects: 'met',
          minimumQualification: 'met',
          languageRequirement: 'met',
          citizenshipRequirement: 'met',
          deadline: 'met',
        },
        dimensions: {
          academicCompetitiveness: { ...flat, score },
          personaAlignment: flat,
          financialFeasibility: flat,
          careerDirection: flat,
          applicationReadiness: flat,
        },
      });
      expect(engine.classification).toBe(academicBandClassification(score));
    }
  });
});
