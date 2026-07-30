import { describe, expect, it } from 'vitest';
import {
  EMPTY_ACADEMIC,
  academicComplete,
  collectCurriculumGrades,
  keepScores,
  readAcademicDraft,
  readTestsDraft,
  testScoresValid,
  toCurriculumList,
} from './draft';
import { ENGLISH_TEST_FORMATS, STANDARDIZED_TEST_FORMATS } from './academic-grading';

/**
 * These coercers exist because the draft shape has changed twice and both times
 * the old shape reached state unchanged and threw. The first three suites are
 * regression tests for exactly those crashes — a draft that is not the current
 * shape must come out USABLE or `null`, never half-formed.
 */

describe('readTestsDraft — the 09d3bc9 crash', () => {
  /**
   * Commit 09d3bc9 replaced `englishScore: string` with
   * `englishScores: Record<string, string>`. This is a draft written by the build
   * before it, and it is what produced
   * `TypeError: Cannot read properties of undefined (reading 'Cambridge English')`.
   */
  const preRename = {
    english: ['Cambridge English', 'TOEFL iBT'],
    englishScore: '7.5',
    standardized: ['ACT'],
    standardizedScore: '34',
  };

  it('always returns the score maps, so no read can be undefined', () => {
    const tests = readTestsDraft(preRename);
    expect(tests).not.toBeNull();
    expect(tests?.englishScores).toEqual({});
    expect(tests?.standardizedScores).toEqual({});
  });

  it('keeps the tests the student ticked', () => {
    expect(readTestsDraft(preRename)?.english).toEqual(['Cambridge English', 'TOEFL iBT']);
    expect(readTestsDraft(preRename)?.standardized).toEqual(['ACT']);
  });

  it('drops the old shared score rather than copying it onto every test', () => {
    // 7.5 is a real IELTS band and not a Cambridge English or TOEFL score at all.
    // Spreading it across both is the invented data the rename existed to stop.
    const tests = readTestsDraft(preRename);
    expect(Object.values(tests?.englishScores ?? {})).toEqual([]);
  });

  it('survives the crashing call that used to throw', () => {
    const tests = readTestsDraft(preRename);
    expect(() =>
      testScoresValid(tests!.english, tests!.englishScores, ENGLISH_TEST_FORMATS),
    ).not.toThrow();
    expect(testScoresValid(tests!.english, tests!.englishScores, ENGLISH_TEST_FORMATS)).toBe(true);
  });

  it('reads the current shape unchanged', () => {
    expect(
      readTestsDraft({
        english: ['IELTS Academic'],
        englishScores: { 'IELTS Academic': '7.5' },
        standardized: ['SAT'],
        standardizedScores: { SAT: '1450' },
      }),
    ).toEqual({
      english: ['IELTS Academic'],
      englishScores: { 'IELTS Academic': '7.5' },
      standardized: ['SAT'],
      standardizedScores: { SAT: '1450' },
    });
  });

  it('drops a score whose test is no longer ticked', () => {
    // Otherwise unticking IELTS and re-ticking it restores a cleared number.
    expect(
      readTestsDraft({
        english: ['TOEFL iBT'],
        englishScores: { 'IELTS Academic': '7.5', 'TOEFL iBT': '102' },
        standardized: [],
        standardizedScores: {},
      })?.englishScores,
    ).toEqual({ 'TOEFL iBT': '102' });
  });

  it('is null for anything that is not a tests object, or holds no tests', () => {
    expect(readTestsDraft(null)).toBeNull();
    expect(readTestsDraft(undefined)).toBeNull();
    expect(readTestsDraft('IELTS')).toBeNull();
    expect(readTestsDraft(42)).toBeNull();
    expect(readTestsDraft({})).toBeNull();
    expect(readTestsDraft({ english: [], standardized: [] })).toBeNull();
  });

  it('filters non-strings out of the lists and the maps', () => {
    // Four components share this localStorage key; a foreign shape is possible.
    const tests = readTestsDraft({
      english: ['IELTS Academic', 42, null, { nope: true }],
      englishScores: { 'IELTS Academic': 7.5 },
      standardized: 'ACT',
      standardizedScores: null,
    });
    expect(tests?.english).toEqual(['IELTS Academic']);
    expect(tests?.englishScores).toEqual({});
    expect(tests?.standardized).toEqual([]);
    expect(tests?.standardizedScores).toEqual({});
  });
});

describe('readAcademicDraft — the câu 6 rework', () => {
  /** The pre-rework shape: one scale and one number for every curriculum. */
  const preRework = {
    curriculum: ['Vietnamese National Curriculum', 'AP + US High School Diploma'],
    gpaScale: ['10-point scale'],
    gpa: '8.9',
  };

  it('always returns both maps, so câu 6 can index them on first render', () => {
    const academic = readAcademicDraft(preRework);
    expect(academic?.scales).toBeTypeOf('object');
    expect(academic?.grades).toBeTypeOf('object');
  });

  it('attributes the single old grade to the first curriculum only', () => {
    const academic = readAcademicDraft(preRework);
    expect(academic?.grades).toEqual({ 'Vietnamese National Curriculum': '8.9' });
    expect(academic?.scales['Vietnamese National Curriculum']).toBe('10-point scale');
  });

  it('gives every other curriculum its own default scale and a blank grade', () => {
    // The old form never recorded which curriculum the number belonged to, so
    // there is nothing honest to put in the second box.
    expect(readAcademicDraft(preRework)?.scales['AP + US High School Diploma']).toBe(
      '4.0 scale (unweighted)',
    );
  });

  it('refuses to relabel a grade onto a scale its curriculum does not offer', () => {
    // A 10-point average must not resurface as an IB total out of 45.
    const academic = readAcademicDraft({
      curriculum: ['IB Diploma Programme (IBDP)'],
      gpaScale: ['10-point scale'],
      gpa: '8.9',
    });
    expect(academic?.grades).toEqual({});
    expect(academic?.scales['IB Diploma Programme (IBDP)']).toBe('IB points (out of 45)');
  });

  it('reads the current shape unchanged', () => {
    expect(
      readAcademicDraft({
        curriculum: ['IB Diploma Programme (IBDP)'],
        scales: { 'IB Diploma Programme (IBDP)': '7-point subject average' },
        grades: { 'IB Diploma Programme (IBDP)': '6.2' },
      }),
    ).toEqual({
      curriculum: ['IB Diploma Programme (IBDP)'],
      scales: { 'IB Diploma Programme (IBDP)': '7-point subject average' },
      grades: { 'IB Diploma Programme (IBDP)': '6.2' },
    });
  });

  it('drops a grade whose curriculum is no longer ticked', () => {
    expect(
      readAcademicDraft({
        curriculum: ['Others...'],
        scales: {},
        grades: { 'IB Diploma Programme (IBDP)': '38', 'Others...': '87' },
      })?.grades,
    ).toEqual({ 'Others...': '87' });
  });

  it('is null for anything that is not an academic object, or holds no curriculum', () => {
    expect(readAcademicDraft(null)).toBeNull();
    expect(readAcademicDraft('IB')).toBeNull();
    expect(readAcademicDraft({})).toBeNull();
    expect(readAcademicDraft({ curriculum: [] })).toBeNull();
  });
});

describe('toCurriculumList', () => {
  it('accepts the array the column is meant to be', () => {
    expect(toCurriculumList(['A', 'B'])).toEqual(['A', 'B']);
  });

  it('accepts the bare string a half-migrated TEXT column returns', () => {
    expect(toCurriculumList('Vietnamese National Curriculum')).toEqual([
      'Vietnamese National Curriculum',
    ]);
  });

  it('is empty for nothing, blank, and the wrong type', () => {
    expect(toCurriculumList(null)).toEqual([]);
    expect(toCurriculumList('')).toEqual([]);
    expect(toCurriculumList('   ')).toEqual([]);
    expect(toCurriculumList(42)).toEqual([]);
    expect(toCurriculumList([1, 'A', null])).toEqual(['A']);
  });
});

describe('keepScores', () => {
  it('keeps only the selected keys', () => {
    expect(keepScores(['a'], { a: '1', b: '2' })).toEqual({ a: '1' });
  });

  it('does not invent an entry for a selection with no score', () => {
    expect(keepScores(['a', 'b'], { a: '1' })).toEqual({ a: '1' });
  });

  it('keeps an empty string, which means "cleared", not "absent"', () => {
    expect(keepScores(['a'], { a: '' })).toEqual({ a: '' });
  });
});

describe('academicComplete', () => {
  it('is false with nothing ticked', () => {
    expect(academicComplete(EMPTY_ACADEMIC)).toBe(false);
  });

  it('is false while any ticked curriculum has no grade', () => {
    expect(
      academicComplete({
        curriculum: ['Vietnamese National Curriculum', 'IB Diploma Programme (IBDP)'],
        scales: {
          'Vietnamese National Curriculum': '10-point scale',
          'IB Diploma Programme (IBDP)': 'IB points (out of 45)',
        },
        grades: { 'Vietnamese National Curriculum': '8.5' },
      }),
    ).toBe(false);
  });

  it('is false while any grade is not a grade on its scale', () => {
    expect(
      academicComplete({
        curriculum: ['Vietnamese National Curriculum'],
        scales: { 'Vietnamese National Curriculum': '10-point scale' },
        grades: { 'Vietnamese National Curriculum': 'dsf' },
      }),
    ).toBe(false);
  });

  it('is true when every ticked curriculum carries a valid grade', () => {
    expect(
      academicComplete({
        curriculum: ['Vietnamese National Curriculum', 'IB Diploma Programme (IBDP)'],
        scales: {
          'Vietnamese National Curriculum': '10-point scale',
          'IB Diploma Programme (IBDP)': 'IB points (out of 45)',
        },
        grades: {
          'Vietnamese National Curriculum': '8.5',
          'IB Diploma Programme (IBDP)': '38',
        },
      }),
    ).toBe(true);
  });
});

describe('testScoresValid', () => {
  it('accepts a blank box — câu 7 scores are optional', () => {
    expect(testScoresValid(['IELTS Academic'], {}, ENGLISH_TEST_FORMATS)).toBe(true);
    expect(
      testScoresValid(['IELTS Academic'], { 'IELTS Academic': '  ' }, ENGLISH_TEST_FORMATS),
    ).toBe(true);
  });

  it('rejects a filled box that is not a score on that test', () => {
    expect(
      testScoresValid(['IELTS Academic'], { 'IELTS Academic': 'sdvds' }, ENGLISH_TEST_FORMATS),
    ).toBe(false);
    expect(testScoresValid(['SAT'], { SAT: '1455' }, STANDARDIZED_TEST_FORMATS)).toBe(false);
  });

  it('accepts a test it has no format for rather than blocking the step', () => {
    expect(testScoresValid(['None yet'], { 'None yet': 'x' }, ENGLISH_TEST_FORMATS)).toBe(true);
  });
});

describe('collectCurriculumGrades', () => {
  it('writes one row per curriculum, with the comparable number where there is one', () => {
    expect(
      collectCurriculumGrades({
        curriculum: ['Vietnamese National Curriculum', 'Cambridge International (IGCSE / AS & A Level)'],
        scales: {
          'Vietnamese National Curriculum': '10-point scale',
          'Cambridge International (IGCSE / AS & A Level)': 'A Level / AS letter grades',
        },
        grades: {
          'Vietnamese National Curriculum': '8.5',
          'Cambridge International (IGCSE / AS & A Level)': 'A*AA',
        },
      }),
    ).toEqual([
      {
        curriculum: 'Vietnamese National Curriculum',
        scale: '10-point scale',
        grade: '8.5',
        value: 8.5,
      },
      {
        curriculum: 'Cambridge International (IGCSE / AS & A Level)',
        scale: 'A Level / AS letter grades',
        grade: 'A*AA',
        value: null,
      },
    ]);
  });

  it('skips a ticked-but-blank curriculum instead of claiming a grade exists', () => {
    expect(
      collectCurriculumGrades({
        curriculum: ['Vietnamese National Curriculum'],
        scales: { 'Vietnamese National Curriculum': '10-point scale' },
        grades: { 'Vietnamese National Curriculum': '   ' },
      }),
    ).toEqual([]);
  });

  it('skips an invalid grade — the guest draft can be saved mid-answer', () => {
    expect(
      collectCurriculumGrades({
        curriculum: ['Vietnamese National Curriculum'],
        scales: { 'Vietnamese National Curriculum': '10-point scale' },
        grades: { 'Vietnamese National Curriculum': '11' },
      }),
    ).toEqual([]);
  });
});
