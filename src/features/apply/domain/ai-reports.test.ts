import { describe, expect, it } from 'vitest';
import { evaluateProgrammeFit, type F5Dimension as EngineDimension } from '@/shared/evaluation/f5-programme-fit';
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

    expect(enforceFitClassification(fit).classification).toBe('strong_match');
    const matchFit = {
      ...fit,
      dimensions: {
        ...fit.dimensions,
        academicCompetitiveness: { ...dimension, score: 3 },
        personaAlignment: { ...dimension, score: 3 },
        financialFeasibility: { ...dimension, score: 3 },
        careerDirection: { ...dimension, score: 3 },
        applicationReadiness: { ...dimension, score: 3 },
      },
    };
    expect(enforceFitClassification(matchFit).classification).toBe('match');
  });

  // Drift detector: `enforceFitClassification` (Zod-fit world) and
  // `evaluateProgrammeFit` (shared-engine world) are two implementations of the
  // SAME band rule. If they ever disagree, one of them changed without the
  // other — this test is the tripwire, per the Feature 2 plan's "one rule"
  // invariant.
  describe('classification drift between enforceFitClassification and the shared engine', () => {
    const zodDimension = (score: number | null) => ({
      status: score === null ? ('not_available' as const) : ('assessed' as const),
      score,
      summary: 'Có dữ liệu.',
      strengths: [],
      gaps: [],
      evidence: [],
    });

    const engineDimension = (score: number | null): EngineDimension => ({
      status: score === null ? 'not_available' : 'assessed',
      score,
      summary: 'Engine fixture',
      strengths: [],
      gaps: [],
      evidenceRefs: [],
    });

    const eligibilityCases = [
      { requiredSubjects: 'met', minimumQualification: 'met', languageRequirement: 'met', citizenshipRequirement: 'met', deadline: 'met' },
      { requiredSubjects: 'not_met', minimumQualification: 'met', languageRequirement: 'unknown', citizenshipRequirement: 'unknown', deadline: 'met' },
      { requiredSubjects: 'met', minimumQualification: 'unknown', languageRequirement: 'not_met', citizenshipRequirement: 'unknown', deadline: 'unknown' },
    ] as const;

    const academicScores = [5, 4.6, 4.5, 4.49, 3.9, 3.5, 3.49, 2.8, 2.5, 2.49, 1];

    for (const eligibility of eligibilityCases) {
      for (const score of academicScores) {
        it(`agrees on eligibility=${eligibility.requiredSubjects}/${eligibility.languageRequirement} academic=${score}`, () => {
          const fit = {
            classification: 'safety',
            confidence: 70,
            limitations: [],
            eligibility,
            dimensions: {
              academicCompetitiveness: zodDimension(score),
              personaAlignment: zodDimension(3),
              financialFeasibility: zodDimension(null),
              careerDirection: zodDimension(4),
              applicationReadiness: zodDimension(null),
            },
          } as unknown as ProgrammeFit;

          expect(enforceFitClassification(fit).classification).toBe(
            evaluateProgrammeFit({
              eligibility,
              dimensions: {
                academicCompetitiveness: engineDimension(score),
                personaAlignment: engineDimension(3),
                financialFeasibility: engineDimension(null),
                careerDirection: engineDimension(4),
                applicationReadiness: engineDimension(null),
              },
            }).classification,
          );
        });
      }
    }
  });
});
