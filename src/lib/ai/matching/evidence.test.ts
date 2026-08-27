import { describe, expect, it } from 'vitest';
import type { EvidenceBank, EvidenceClaim } from '@/shared/evidence/domain';
import type { CriterionMatchResult, MatchingCriterion, MatchingEvidence } from './domain';
import {
  retrieveEvidenceForCriterion,
  toMatchingEvidence,
  validateEvidenceReferences,
} from './evidence';

const bankFor = (claims: EvidenceClaim[]): EvidenceBank => ({
  version: 'eb-v1',
  sources: {},
  interpretations: [],
  claims,
  missingInformation: [],
});

const claimFor = (overrides: Partial<EvidenceClaim> = {}): EvidenceClaim => ({
  id: 'claim-1',
  category: 'experience',
  statement: 'Research project with a documented outcome.',
  status: 'unverified',
  sourceRefs: ['activity:1'],
  interpretationRefs: [],
  tags: { competencies: [], criteria: [] },
  ...overrides,
});

const criterionFor = (overrides: Partial<MatchingCriterion> = {}): MatchingCriterion => ({
  id: 'experience:research',
  category: 'experience',
  label: 'Research experience',
  description: 'Experience conducting research projects.',
  importance: 'medium',
  requirementType: 'soft',
  sourceRefs: ['source:programme'],
  sourceText: 'Research experience',
  expectedSignals: ['research', 'experience'],
  negativeSignals: [],
  metadata: { importanceSource: 'source', targetRequirementId: 'req-1', missingInformation: null },
  ...overrides,
});

function matchFor(overrides: Partial<CriterionMatchResult> = {}): CriterionMatchResult {
  return {
    criterionId: 'experience:research',
    alignment: 'strong',
    evidenceIds: ['claim-1'],
    directEvidenceIds: ['claim-1'],
    supportingEvidenceIds: [],
    reasoning: 'The available evidence supports the criterion.',
    missingEvidence: [],
    evidenceQuality: 'strong',
    confidence: 0.8,
    ...overrides,
  };
}

describe('matching evidence adapter', () => {
  it('preserves claim identity, provenance, tags, and status', () => {
    const claim = claimFor({
      id: 'claim-verified',
      category: 'academic',
      status: 'verified',
      sourceRefs: ['test:1'],
      interpretationRefs: ['interpretation:1'],
      tags: { competencies: ['analysis'], criteria: ['academic_requirement:math'] },
    });
    const [evidence] = toMatchingEvidence(bankFor([claim]));

    expect(evidence).toMatchObject({
      id: claim.id,
      category: claim.category,
      statement: claim.statement,
      sourceRefs: claim.sourceRefs,
      interpretationRefs: claim.interpretationRefs,
      status: claim.status,
      competencies: claim.tags.competencies,
      criteria: claim.tags.criteria,
      rankScore: 0,
    });
    expect(evidence?.sourceRefs).not.toBe(claim.sourceRefs);
  });

  it('does not mark report-only or AI-only claims as direct evidence', () => {
    const values = toMatchingEvidence(
      bankFor([
        claimFor({ id: 'report', status: 'report_only', sourceRefs: ['supplement:1'] }),
        claimFor({ id: 'raw', status: 'unverified' }),
        claimFor({
          id: 'ai-only',
          category: 'competency',
          status: 'unverified',
          sourceRefs: [],
          interpretationRefs: ['interpretation:1'],
          tags: { competencies: ['leadership'], criteria: [] },
        }),
      ]),
    );

    expect(values.find((item) => item.id === 'report')?.direct).toBe(false);
    expect(values.find((item) => item.id === 'ai-only')?.direct).toBe(false);
    expect(values.find((item) => item.id === 'raw')?.direct).toBe(false);
  });
});

describe('retrieveEvidenceForCriterion', () => {
  it('ranks an exact criterion tag before token-only matches', () => {
    const result = retrieveEvidenceForCriterion({
      criterion: criterionFor({ id: 'academic_requirement:math', category: 'academic_requirement', expectedSignals: ['math'] }),
      evidenceBank: bankFor([
        claimFor({ id: 'token', category: 'academic', statement: 'Math score is listed.' }),
        claimFor({
          id: 'exact',
          category: 'academic',
          statement: 'Academic requirement evidence.',
          tags: { competencies: [], criteria: ['academic_requirement:math'] },
        }),
      ]),
    });

    expect(result.map((item) => item.id).slice(0, 2)).toEqual(['exact', 'token']);
  });

  it('ranks an exact competency tag before a generic achievement', () => {
    const result = retrieveEvidenceForCriterion({
      criterion: criterionFor({
        id: 'competency:leadership',
        category: 'competency',
        label: 'Leadership',
        description: 'Lead collaborative work.',
        expectedSignals: ['leadership'],
      }),
      evidenceBank: bankFor([
        claimFor({ id: 'generic', category: 'experience', statement: 'A generic achievement.' }),
        claimFor({
          id: 'tagged',
          category: 'competency',
          statement: 'Leadership demonstrated in a team.',
          tags: { competencies: ['leadership'], criteria: [] },
        }),
      ]),
    });

    expect(result[0]?.id).toBe('tagged');
  });

  it('keeps unrelated activities out of academic criteria', () => {
    const result = retrieveEvidenceForCriterion({
      criterion: criterionFor({
        category: 'academic_requirement',
        id: 'academic_requirement:math',
        label: 'Mathematics grade',
        description: 'Required mathematics grade.',
        expectedSignals: ['mathematics', 'grade'],
      }),
      evidenceBank: bankFor([
        claimFor({ id: 'activity', category: 'experience', statement: 'Math tutoring activity.' }),
        claimFor({ id: 'grade', category: 'academic', statement: 'Mathematics grade B.' }),
      ]),
    });

    expect(result.map((item) => item.id)).toEqual(['grade']);
  });

  it('applies verification/status bonuses after relevance and sorts ties by ID', () => {
    const result = retrieveEvidenceForCriterion({
      criterion: criterionFor({ expectedSignals: ['research'] }),
      evidenceBank: bankFor([
        claimFor({ id: 'z-conflicting', status: 'conflicting', tags: { competencies: [], criteria: ['experience:research'] } }),
        claimFor({ id: 'a-verified', status: 'verified', tags: { competencies: [], criteria: ['experience:research'] } }),
        claimFor({ id: 'm-report', status: 'report_only', tags: { competencies: [], criteria: ['experience:research'] } }),
      ]),
    });

    expect(result.map((item) => item.id)).toEqual(['a-verified', 'z-conflicting', 'm-report']);
    expect(result[0]?.rankScore).toBeGreaterThan(result[1]?.rankScore ?? 0);
  });

  it('uses same-category token fallback and clamps topK to 1..10 (default 6)', () => {
    const claims = Array.from({ length: 12 }, (_, index) =>
      claimFor({ id: `claim-${String(index).padStart(2, '0')}`, statement: `Research item ${index}` }),
    );
    claims.push(claimFor({ id: 'wrong-category', category: 'academic', statement: 'Research item' }));
    const args = { criterion: criterionFor({ expectedSignals: ['research'] }), evidenceBank: bankFor(claims) };

    expect(retrieveEvidenceForCriterion(args)).toHaveLength(6);
    expect(retrieveEvidenceForCriterion({ ...args, topK: 0 })).toHaveLength(1);
    expect(retrieveEvidenceForCriterion({ ...args, topK: 99 })).toHaveLength(10);
    expect(retrieveEvidenceForCriterion({ ...args, topK: Number.NaN })).toHaveLength(6);
    expect(retrieveEvidenceForCriterion(args).every((item) => item.category === 'experience')).toBe(true);
  });
});

describe('validateEvidenceReferences', () => {
  const supplied: MatchingEvidence[] = [
    {
      id: 'direct', category: 'experience', statement: 'Verified source.', sourceRefs: ['source:1'],
      interpretationRefs: [], status: 'verified', competencies: [], criteria: [], direct: true, rankScore: 1,
    },
    {
      id: 'ai', category: 'competency', statement: 'AI-derived competency.', sourceRefs: [],
      interpretationRefs: ['interpretation:1'], status: 'unverified', competencies: ['leadership'], criteria: [], direct: false, rankScore: 1,
    },
  ];

  it('rejects evidence IDs not present in the supplied batch', () => {
    expect(() => validateEvidenceReferences(matchFor({ evidenceIds: ['unknown'] }), supplied)).toThrow(
      'Unknown evidence ID: unknown',
    );
  });

  it('dedupes IDs, enforces direct/supporting subsets, and downgrades without direct evidence', () => {
    const result = validateEvidenceReferences(
      matchFor({
        evidenceIds: ['ai', 'ai'],
        directEvidenceIds: ['ai', 'ai'],
        supportingEvidenceIds: ['ai', 'direct'],
      }),
      supplied,
    );

    expect(result.evidenceIds).toEqual(['ai']);
    expect(result.directEvidenceIds).toEqual([]);
    expect(result.supportingEvidenceIds).toEqual(['ai']);
    expect(result.alignment).toBe('moderate');
  });

  it('downgrades moderate matches with no evidence and clears direct/supporting IDs for missing', () => {
    expect(
      validateEvidenceReferences(
        matchFor({ alignment: 'moderate', evidenceIds: [], directEvidenceIds: [], supportingEvidenceIds: [] }),
        supplied,
      ).alignment,
    ).toBe('weak');
    expect(
      validateEvidenceReferences(
        matchFor({ alignment: 'missing', evidenceIds: ['ai'], directEvidenceIds: ['ai'], supportingEvidenceIds: ['ai'] }),
        supplied,
      ),
    ).toMatchObject({ evidenceIds: ['ai'], directEvidenceIds: [], supportingEvidenceIds: [] });
  });
});
