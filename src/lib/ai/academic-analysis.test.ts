import { describe, expect, it } from 'vitest';
import { assessAcademicRequirements, type AcademicRecord, type AcademicRequirementSpec } from './academic-analysis';

const IELTS_REQ: AcademicRequirementSpec = {
  id: 'req-ielts',
  label: 'IELTS overall 6.5',
  metric: 'ielts',
  minValue: 6.5,
  maxValue: 9,
  sourceRefs: ['run-1'],
};

const GPA_REQ: AcademicRequirementSpec = {
  id: 'req-gpa',
  label: 'GPA at least 3.0/4.0',
  metric: 'gpa',
  minValue: 3.0,
  scale: 4,
  sourceRefs: ['run-2'],
};

function record(overrides: Partial<AcademicRecord>): AcademicRecord {
  return {
    id: 'rec-1',
    kind: 'english_test',
    testType: 'IELTS',
    value: 7.0,
    scale: 9,
    raw: 'IELTS 7.0',
    ...overrides,
  };
}

describe('assessAcademicRequirements', () => {
  it('resolves directly comparable values to meets', () => {
    const result = assessAcademicRequirements({
      records: [record({})],
      requirements: [IELTS_REQ],
    });
    expect(result[0]).toMatchObject({ requirementId: 'req-ielts', verdict: 'meets' });
    expect(result[0].comparedOn).toMatchObject({ recordValue: 7, requirementValue: 6.5 });
  });

  it('resolves directly comparable values (same scale) to does_not_meet', () => {
    const result = assessAcademicRequirements({
      records: [
        record({ id: 'gpa-rec', kind: 'gpa', testType: null, value: 2.5, scale: 4, raw: '2.5/4' }),
      ],
      requirements: [GPA_REQ],
    });
    expect(result[0].verdict).toBe('does_not_meet');
  });

  it('uses possibly_meets for equivalence cases across grading systems', () => {
    const result = assessAcademicRequirements({
      records: [
        record({
          id: 'pct',
          kind: 'grade_summary',
          testType: null,
          value: 85,
          scale: 100,
          raw: '85% average',
        }),
      ],
      requirements: [GPA_REQ],
    });
    expect(result[0].verdict).toBe('possibly_meets');
    expect(result[0].rationale).toMatch(/different grading|equivalen/i);
  });

  it('never fails or scores zero on missing or incomparable data — insufficient_information instead', () => {
    const missing = assessAcademicRequirements({
      records: [],
      requirements: [IELTS_REQ],
    });
    expect(missing[0].verdict).toBe('insufficient_information');

    const unparsable = assessAcademicRequirements({
      records: [record({ value: null, raw: 'completed with distinction' })],
      requirements: [IELTS_REQ],
    });
    expect(unparsable[0].verdict).toBe('insufficient_information');

    const halfScale = assessAcademicRequirements({
      records: [record({ kind: 'gpa', testType: null, value: 3.4, scale: null })],
      requirements: [GPA_REQ], // requires scale 4; record has no scale
    });
    expect(halfScale[0].verdict).toBe('insufficient_information');
  });

  it('emits exactly the four allowed verdict states and never an admission probability', () => {
    const results = assessAcademicRequirements({
      records: [
        record({}),
        record({ id: 'low', value: 5.5 }),
        record({ id: 'pct', kind: 'grade_summary', testType: null, value: 88, scale: 100 }),
        record({ id: 'empty', value: null, raw: null }),
      ],
      requirements: [IELTS_REQ, GPA_REQ],
    });

    const allowed = new Set(['meets', 'possibly_meets', 'does_not_meet', 'insufficient_information']);
    for (const item of results) {
      expect(allowed.has(item.verdict)).toBe(true);
    }
    const serialized = JSON.stringify(results);
    expect(serialized).not.toMatch(/probability/i);
    expect(results.some((item) => 'probability' in item)).toBe(false);
  });
});
