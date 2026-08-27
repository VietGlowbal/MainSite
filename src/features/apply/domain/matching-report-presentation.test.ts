import { describe, expect, it } from 'vitest';
import type { ProgrammeFit } from './ai-reports';
import {
  MATCH_SCORE_DISCLAIMER,
  alignmentLevel,
  eligibilityRows,
  fitRows,
  matchSummary,
  overallMatchPercent,
  readinessPercent,
  tieredGaps,
  F5_WEIGHTS_BY_KEY,
  DIMENSION_ORDER,
} from './matching-report-presentation';

function dim(score: number | null, extra: Partial<ProgrammeFit['dimensions']['academicCompetitiveness']> = {}) {
  return {
    status: (score === null ? 'not_available' : 'assessed') as 'assessed' | 'not_available',
    score,
    summary: 'summary',
    strengths: [],
    gaps: [],
    evidence: [],
    ...extra,
  };
}

function makeFit(overrides: Partial<ProgrammeFit> = {}): ProgrammeFit {
  return {
    classification: 'match',
    confidence: 80,
    limitations: [],
    eligibility: {
      requiredSubjects: 'met',
      minimumQualification: 'met',
      languageRequirement: 'met',
      citizenshipRequirement: 'unknown',
      deadline: 'met',
    },
    dimensions: {
      academicCompetitiveness: dim(3),
      personaAlignment: dim(3),
      financialFeasibility: dim(3),
      careerDirection: dim(3),
      applicationReadiness: dim(3),
    },
    ...overrides,
  } as ProgrammeFit;
}

describe('weights', () => {
  it('sum to 1 and match the shared engine', () => {
    const total = DIMENSION_ORDER.reduce((sum, key) => sum + F5_WEIGHTS_BY_KEY[key], 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe('overallMatchPercent', () => {
  it('renders a mid rubric score as the middle of the range', () => {
    expect(overallMatchPercent(makeFit())).toBe(50);
  });

  it('reaches percentages that whole-number scores could not', () => {
    const fit = makeFit({
      dimensions: {
        academicCompetitiveness: dim(4.2),
        personaAlignment: dim(4.6),
        financialFeasibility: dim(3.1),
        careerDirection: dim(4.4),
        applicationReadiness: dim(3.8),
      },
    } as Partial<ProgrammeFit>);
    const percent = overallMatchPercent(fit);
    expect(percent).not.toBeNull();
    expect(percent! % 20).not.toBe(0);
  });

  it('renormalizes around an unassessed dimension instead of scoring it zero', () => {
    const withoutMoney = makeFit({
      dimensions: {
        academicCompetitiveness: dim(3),
        personaAlignment: dim(3),
        financialFeasibility: dim(null),
        careerDirection: dim(3),
        applicationReadiness: dim(3),
      },
    } as Partial<ProgrammeFit>);
    expect(overallMatchPercent(withoutMoney)).toBe(50);
  });

  it('is null, not zero, when nothing was assessed', () => {
    const nothing = makeFit({
      dimensions: {
        academicCompetitiveness: dim(null),
        personaAlignment: dim(null),
        financialFeasibility: dim(null),
        careerDirection: dim(null),
        applicationReadiness: dim(null),
      },
    } as Partial<ProgrammeFit>);
    expect(overallMatchPercent(nothing)).toBeNull();
  });
});

describe('alignmentLevel', () => {
  it.each([
    [90, 'High'],
    [70, 'High'],
    [55, 'Moderate'],
    [40, 'Moderate'],
    [10, 'Emerging'],
  ] as const)('%s%% is %s', (percent, expected) => {
    expect(alignmentLevel(percent)).toBe(expected);
  });

  it('does not claim a level when nothing was scored', () => {
    expect(alignmentLevel(null)).toBe('Not assessed');
  });
});

describe('fitRows', () => {
  it('returns one row per dimension, academic first', () => {
    const rows = fitRows(makeFit());
    expect(rows).toHaveLength(5);
    expect(rows[0]?.key).toBe('academicCompetitiveness');
  });

  it('marks an unassessed dimension rather than showing it as 0%', () => {
    const fit = makeFit({
      dimensions: {
        academicCompetitiveness: dim(3),
        personaAlignment: dim(3),
        financialFeasibility: dim(null),
        careerDirection: dim(3),
        applicationReadiness: dim(3),
      },
    } as Partial<ProgrammeFit>);
    const money = fitRows(fit).find((row) => row.key === 'financialFeasibility');
    expect(money?.assessed).toBe(false);
    expect(money?.percent).toBeNull();
  });

  it('renders the rubric floor as 0%, which is a real score', () => {
    const fit = makeFit({
      dimensions: {
        academicCompetitiveness: dim(1),
        personaAlignment: dim(3),
        financialFeasibility: dim(3),
        careerDirection: dim(3),
        applicationReadiness: dim(3),
      },
    } as Partial<ProgrammeFit>);
    const academic = fitRows(fit).find((row) => row.key === 'academicCompetitiveness');
    expect(academic?.assessed).toBe(true);
    expect(academic?.percent).toBe(0);
  });
});

describe('eligibilityRows', () => {
  it('treats only an explicit not_met as blocking', () => {
    const fit = makeFit({
      eligibility: {
        requiredSubjects: 'not_met',
        minimumQualification: 'met',
        languageRequirement: 'unknown',
        citizenshipRequirement: 'unknown',
        deadline: 'met',
      },
    });
    const rows = eligibilityRows(fit);
    expect(rows.filter((row) => row.blocking).map((row) => row.key)).toEqual(['requiredSubjects']);
  });

  it('says unknown was not checked rather than implying failure', () => {
    const unknown = eligibilityRows(makeFit()).find((row) => row.status === 'unknown');
    expect(unknown?.statusLabel).toContain('could not check');
    expect(unknown?.blocking).toBe(false);
  });
});

describe('tieredGaps', () => {
  it('marks a gap on a heavily weighted weak dimension as critical', () => {
    const fit = makeFit({
      dimensions: {
        academicCompetitiveness: dim(2, { gaps: ['Maths grade is below the typical intake'] }),
        personaAlignment: dim(4, { gaps: ['Little evidence of teamwork'] }),
        financialFeasibility: dim(3),
        careerDirection: dim(3),
        applicationReadiness: dim(3),
      },
    } as Partial<ProgrammeFit>);
    const gaps = tieredGaps(fit);
    expect(gaps[0]?.tier).toBe('critical');
    expect(gaps[0]?.text).toContain('Maths grade');
    expect(gaps.find((gap) => gap.text.includes('teamwork'))?.tier).toBe('competitive');
  });

  it('caps each tier so the section stays readable', () => {
    const many = ['a', 'b', 'c', 'd', 'e'];
    const fit = makeFit({
      dimensions: {
        academicCompetitiveness: dim(1, { gaps: many }),
        personaAlignment: dim(3),
        financialFeasibility: dim(3),
        careerDirection: dim(3),
        applicationReadiness: dim(3),
      },
    } as Partial<ProgrammeFit>);
    expect(tieredGaps(fit).filter((gap) => gap.tier === 'critical')).toHaveLength(3);
  });
});

describe('matchSummary', () => {
  it('surfaces blocking requirements for an ineligible applicant', () => {
    const fit = makeFit({
      classification: 'currently_ineligible',
      eligibility: {
        requiredSubjects: 'met',
        minimumQualification: 'met',
        languageRequirement: 'not_met',
        citizenshipRequirement: 'met',
        deadline: 'met',
      },
    });
    const summary = matchSummary(fit);
    expect(summary.tone).toBe('blocked');
    expect(summary.blockingRequirements).toHaveLength(1);
    expect(summary.meaning).toContain('not about how strong you are');
  });

  it('gives strong_match its own label rather than folding it into match', () => {
    expect(matchSummary(makeFit({ classification: 'strong_match' })).label).toBe('Strong match');
    expect(matchSummary(makeFit({ classification: 'match' })).label).toBe('Match');
  });

  it('reports readiness separately from the overall match score', () => {
    const fit = makeFit({
      dimensions: {
        academicCompetitiveness: dim(3),
        personaAlignment: dim(3),
        financialFeasibility: dim(3),
        careerDirection: dim(3),
        applicationReadiness: dim(5),
      },
    } as Partial<ProgrammeFit>);
    expect(readinessPercent(fit)).toBe(100);
    expect(matchSummary(fit).matchPercent).not.toBe(100);
  });

  it('refuses to guess a band when the programme publishes no range', () => {
    const summary = matchSummary(makeFit({ classification: 'insufficient_data' }));
    expect(summary.meaning).toContain('will not guess');
  });
});

describe('wording guarantees', () => {
  it('never describes the match score as a chance of admission', () => {
    const banned = /\b(chance|odds|likelihood|probability|likely to be admitted)\b/i;
    expect(MATCH_SCORE_DISCLAIMER).not.toMatch(banned);
    expect(MATCH_SCORE_DISCLAIMER).toContain('not a prediction');
    for (const classification of ['safety', 'strong_match', 'match', 'reach'] as const) {
      expect(matchSummary(makeFit({ classification })).meaning).not.toMatch(banned);
    }
  });
});

import type { MatchingReportV2 } from '@/lib/ai/matching/domain';
import { getV2Sections } from './matching-report-presentation';

describe('V2 Presentation Adapter', () => {
  it('maps V2 sections correctly, separating missing evidence from regular gaps', () => {
    const mockReport: MatchingReportV2 = {
      contractVersion: 'matching-report-v2',
      generatedAt: '2026-08-27T00:00:00Z',
      overall: {
        summary: 'summary',
        summaryCriterionIds: [],
        summaryEvidenceIds: [],
        strongestAlignment: [],
        mostImportantGaps: [],
        evidenceCoverage: 80,
        fitScore: 85,
        fitLabel: 'strong_current_alignment',
      },
      criteria: [],
      academicRequirements: [
        { criterionId: 'hard1', status: 'does_not_meet', applicantValue: null, requiredValue: null, evidenceIds: [], explanation: 'bad' }
      ],
      programmeAlignment: [],
      strengths: [
        { id: 'str1', title: 'Strength 1', description: 'desc', criterionIds: [], evidenceIds: [], strength: 'high', whyItMatters: 'why', positioningUse: null }
      ],
      gaps: [
        { id: 'gap1', type: 'capability_gap', title: 'Real Gap', description: 'desc', criterionIds: [], currentEvidenceIds: [], severity: 'critical', fixability: 'low', evidenceNeeded: [], whyItMatters: 'why', priority: 1 },
        { id: 'gap2', type: 'missing_evidence', title: 'Need Proof', description: 'desc', criterionIds: [], currentEvidenceIds: [], severity: 'medium', fixability: 'high', evidenceNeeded: ['test score'], whyItMatters: 'why', priority: 2 },
        { id: 'gap3', type: 'weak_evidence', title: 'Weak Proof', description: 'desc', criterionIds: [], currentEvidenceIds: [], severity: 'medium', fixability: 'high', evidenceNeeded: ['better project'], whyItMatters: 'why', priority: 3 }
      ],
      positioningOpportunities: [],
      scholarshipAlignment: { criteria: [], strengths: [], gaps: [] },
      programmeFit: makeFit(),
      dependencyIndex: {},
      metadata: {} as any
    };

    const sections = getV2Sections(mockReport);
    
    expect(sections.snapshot.fitScore).toBe(85);
    expect(sections.criticalRequirements.length).toBe(1);
    expect(sections.strengths.length).toBe(1);
    
    // Gaps should exclude missing/weak evidence
    expect(sections.gaps.length).toBe(1);
    expect(sections.gaps[0]?.type).toBe('capability_gap');
    
    // Evidence needed should include missing and weak evidence
    expect(sections.evidenceNeeded.length).toBe(2);
    expect(sections.evidenceNeeded.map(g => g.type)).toEqual(['missing_evidence', 'weak_evidence']);
    
    expect(sections.scholarship).toBeDefined();
  });
});
