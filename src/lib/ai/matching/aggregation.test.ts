import { describe, expect, it } from 'vitest';
import {
  calculateEvidenceCoverage,
  deriveStrengths,
  deriveGaps,
  derivePositioningOpportunities,
  buildDependencyIndex,
  evaluateHardRequirements,
} from './aggregation';
import type { FitSignal, HardRequirementMatch, MatchingCriterion } from './domain';
import type { EvidenceBank } from '@/shared/evidence/domain';
import type { AcademicProfile } from '@/lib/ai/applicant-state/domain';

// --- Fixtures ---

const createCriterion = (
  id: string,
  importance: MatchingCriterion['importance'] = 'high',
  category: MatchingCriterion['category'] = 'selection_criterion',
  requirementType: MatchingCriterion['requirementType'] = 'soft',
): MatchingCriterion => ({
  id,
  category,
  requirementType,
  importance,
  label: `Label for ${id}`,
  description: `Description for ${id}`,
  sourceText: null,
  sourceRefs: [],
  metadata: {
    missingInformation: null,
    inferredIntent: null,
  },
  dependencies: [],
});

const createSignal = (
  criterionId: string,
  alignment: FitSignal['alignment'] = 'strong',
  evidenceQuality: FitSignal['evidenceQuality'] = 'strong',
  direct: string[] = ['ev-1'],
): FitSignal => ({
  criterionId,
  category: 'selection_criterion',
  criterionLabel: `Label for ${criterionId}`,
  criterionSourceRefs: [],
  applicantEvidenceIds: [],
  directEvidenceIds: direct,
  supportingEvidenceIds: [],
  alignment,
  evidenceQuality,
  reasoning: 'Reasoning...',
  missingEvidence: [],
  confidence: 0.9,
  opportunity: null,
  inputHash: 'hash',
});

describe('calculateEvidenceCoverage', () => {
  it('calculates weighted coverage correctly (0-100) and excludes scholarship', () => {
    const c1 = createCriterion('c1', 'critical'); // weight 4
    const c2 = createCriterion('c2', 'high'); // weight 3
    const c3 = createCriterion('c3', 'low', 'scholarship'); // excluded

    // c1 is moderate (0.65), c2 is strong (1)
    // score = (0.65 * 4) + (1 * 3) = 2.6 + 3 = 5.6
    // total weight = 4 + 3 = 7
    // expected = Math.round((5.6 / 7) * 100) = 80

    const s1 = createSignal('c1', 'moderate');
    const s2 = createSignal('c2', 'strong');

    const result = calculateEvidenceCoverage([c1, c2, c3], [s1, s2]);
    expect(result).toBe(80);
  });

  it('returns 0 if all missing', () => {
    const c1 = createCriterion('c1', 'high');
    const result = calculateEvidenceCoverage([c1], [createSignal('c1', 'missing')]);
    expect(result).toBe(0);
  });

  it('returns 100 if all strong', () => {
    const c1 = createCriterion('c1', 'high');
    const result = calculateEvidenceCoverage([c1], [createSignal('c1', 'strong')]);
    expect(result).toBe(100);
  });
});

describe('deriveStrengths', () => {
  it('includes strong alignment, med+ importance, good quality', () => {
    const c1 = createCriterion('c1', 'high');
    const c2 = createCriterion('c2', 'low'); // skipped (low imp)
    const c3 = createCriterion('c3', 'medium'); // medium strength

    const s1 = createSignal('c1', 'strong', 'strong');
    const s2 = createSignal('c2', 'strong', 'strong');
    const s3 = createSignal('c3', 'strong', 'moderate');

    const strengths = deriveStrengths([c1, c2, c3], [s1, s2, s3]);
    expect(strengths).toHaveLength(2);
    expect(strengths[0].id).toBe('strength-c1');
    expect(strengths[0].strength).toBe('high');
    expect(strengths[1].id).toBe('strength-c3');
    expect(strengths[1].strength).toBe('medium');
  });

  it('excludes weak/none evidenceQuality', () => {
    const c1 = createCriterion('c1', 'high');
    const s1 = createSignal('c1', 'strong', 'weak');
    const strengths = deriveStrengths([c1], [s1]);
    expect(strengths).toHaveLength(0);
  });
});

describe('deriveGaps', () => {
  it('identifies hard requirement failures as critical gaps', () => {
    const c1 = createCriterion('c1', 'critical', 'academic', 'hard');
    const hr: HardRequirementMatch = {
      criterionId: 'c1',
      status: 'does_not_meet',
      applicantValue: null,
      requiredValue: null,
      evidenceIds: [],
      explanation: 'Failed',
    };
    const gaps = deriveGaps([c1], [hr], []);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].type).toBe('hard_requirement');
    expect(gaps[0].severity).toBe('critical');
    expect(gaps[0].fixability).toBe('low');
  });

  it('identifies missing evidence for high/critical importance', () => {
    const c1 = createCriterion('c1', 'high');
    const s1 = createSignal('c1', 'missing', 'none', []);
    const gaps = deriveGaps([c1], [], [s1]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].type).toBe('missing_evidence');
    expect(gaps[0].severity).toBe('high');
    expect(gaps[0].fixability).toBe('high');
  });

  it('identifies capability gap when weak but has direct evidence', () => {
    const c1 = createCriterion('c1', 'medium');
    const s1 = createSignal('c1', 'weak', 'strong', ['ev-1']); // strong quality but weak alignment -> capability
    const gaps = deriveGaps([c1], [], [s1]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].type).toBe('capability_gap');
    expect(gaps[0].fixability).toBe('medium');
  });
  
  it('never infers capability gap from silence', () => {
    const c1 = createCriterion('c1', 'medium'); // medium importance missing does not become missing_evidence either
    const s1 = createSignal('c1', 'missing', 'none', []);
    const gaps = deriveGaps([c1], [], [s1]);
    expect(gaps).toHaveLength(0);
  });

  it('identifies weak evidence when poor quality with evidence', () => {
    const c1 = createCriterion('c1', 'medium');
    const s1 = createSignal('c1', 'moderate', 'weak', ['ev-1']);
    const gaps = deriveGaps([c1], [], [s1]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].type).toBe('weak_evidence');
    expect(gaps[0].fixability).toBe('high');
  });

  it('sorts by priority descending', () => {
    const c1 = createCriterion('c1', 'high'); // missing -> priority: 3 * 1 * 1 * 0.8 = 2.4 ~ 2
    const c2 = createCriterion('c2', 'critical', 'academic', 'hard'); // does_not_meet -> priority: 4 * 1 * 2 * 1.2 = 9.6 ~ 10
    const hr: HardRequirementMatch = {
      criterionId: 'c2',
      status: 'does_not_meet',
      applicantValue: null,
      requiredValue: null,
      evidenceIds: [],
      explanation: 'Failed',
    };
    const s1 = createSignal('c1', 'missing', 'none', []);
    
    const gaps = deriveGaps([c1, c2], [hr], [s1]);
    expect(gaps).toHaveLength(2);
    expect(gaps[0].id).toBe('gap-hard-c2');
    expect(gaps[1].id).toBe('gap-c1');
  });
});

describe('derivePositioningOpportunities', () => {
  it('includes only signals with opportunity text, evidence, not missing', () => {
    const c1 = createCriterion('c1', 'high');
    const s1 = createSignal('c1', 'moderate', 'strong', ['ev-1']);
    s1.opportunity = 'Could frame this better';
    s1.confidence = 0.8;
    
    const c2 = createCriterion('c2', 'high');
    const s2 = createSignal('c2', 'moderate', 'strong', ['ev-2']); // no opportunity text
    
    const c3 = createCriterion('c3', 'high');
    const s3 = createSignal('c3', 'missing', 'none', []);
    s3.opportunity = 'Should do this';

    const opps = derivePositioningOpportunities([c1, c2, c3], [s1, s2, s3]);
    expect(opps).toHaveLength(1);
    expect(opps[0].id).toBe('positioning-c1');
  });
});

describe('buildDependencyIndex', () => {
  it('maps evidence to criteria ids', () => {
    const s1 = createSignal('c1', 'strong', 'strong', ['ev-1', 'ev-2']);
    const s2 = createSignal('c2', 'strong', 'strong', ['ev-2', 'ev-3']);
    
    const index = buildDependencyIndex([s1, s2]);
    expect(index['ev-1']).toEqual(['c1']);
    expect(index['ev-2']).toEqual(['c1', 'c2']);
    expect(index['ev-3']).toEqual(['c2']);
  });
});

describe('evaluateHardRequirements', () => {
  it('detects IELTS threshold and evaluates insufficient when no records', () => {
    const c1 = createCriterion('c1', 'critical', 'academic', 'hard');
    c1.description = 'Requires IELTS 6.5 minimum';
    
    const bank: EvidenceBank = {
      sources: {},
      claims: [],
    };
    
    const hr = evaluateHardRequirements({
      criteria: [c1],
      academicProfile: { records: [] },
      evidenceBank: bank,
    });
    
    expect(hr).toHaveLength(1);
    expect(hr[0].criterionId).toBe('c1');
    expect(hr[0].status).toBe('insufficient_information');
    expect(hr[0].requiredValue).toBe(6.5);
  });
});
