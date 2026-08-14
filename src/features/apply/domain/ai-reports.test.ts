import { describe, expect, it } from 'vitest';
import { canonicalize, enforceFitClassification, type ProgrammeFit } from './ai-reports';

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

    expect(enforceFitClassification(fit).classification).toBe('match');
  });
});
