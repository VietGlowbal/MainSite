import { describe, expect, it } from 'vitest';
import {
  CURRICULUM_GRADE_FORMATS,
  ENGLISH_TEST_FORMATS,
  STANDARDIZED_TEST_FORMATS,
  defaultScaleFor,
  gradeFormatFor,
  scalesFor,
  toCurriculumGrades,
} from './academic-grading';
import type { GradeFormat } from './academic-grading';

/**
 * The bug these formats exist to close: câu 6's GPA box and câu 7's score boxes
 * accepted any text at all, and the only check was a `parseFloat` at save time
 * whose `null` went to the database silently. So the first thing every scale
 * below is asked is whether it still takes typing that is not a grade.
 */
const NOT_A_GRADE = ['dsf', 'sdvds', 'fsf', 'sdvdsv', '', '   ', 'abc123def', '--', '?'];

function format(curriculum: string, scale?: string): GradeFormat {
  const found = gradeFormatFor(curriculum, scale);
  if (found === undefined) throw new Error(`no format for ${curriculum} / ${scale}`);
  return found;
}

describe('no scale accepts typing that is not a grade', () => {
  const every: [string, GradeFormat][] = [
    ...Object.entries(CURRICULUM_GRADE_FORMATS).flatMap(([curriculum, formats]) =>
      formats.map((f): [string, GradeFormat] => [`${curriculum} / ${f.scale}`, f]),
    ),
    ...Object.entries(ENGLISH_TEST_FORMATS).map(([test, f]): [string, GradeFormat] => [test, f]),
    ...Object.entries(STANDARDIZED_TEST_FORMATS).map(
      ([test, f]): [string, GradeFormat] => [test, f],
    ),
  ];

  for (const [name, f] of every) {
    it.each(NOT_A_GRADE)(`${name} rejects %j`, (raw) => {
      expect(f.check(raw)).not.toBeNull();
    });
  }

  it('covers every scale in the module', () => {
    // Guards against a scale being added without landing in the sweep above.
    expect(every.length).toBe(10 + 5 + 6);
  });
});

describe('Vietnamese National Curriculum', () => {
  const tenPoint = format('Vietnamese National Curriculum');

  it('preselects the 10-point scale, which is what the schools issue', () => {
    expect(defaultScaleFor('Vietnamese National Curriculum')).toBe('10-point scale');
  });

  it('accepts a 0–10 average to two decimals', () => {
    expect(tenPoint.check('8.5')).toBeNull();
    expect(tenPoint.check('10')).toBeNull();
    expect(tenPoint.check('0')).toBeNull();
    expect(tenPoint.check('8.75')).toBeNull();
  });

  it('reads a comma decimal, which a Vietnamese keyboard layout produces', () => {
    expect(tenPoint.check('8,5')).toBeNull();
    expect(tenPoint.toNumber('8,5')).toBe(8.5);
  });

  it('rejects a number off the top of the scale', () => {
    expect(tenPoint.check('11')).not.toBeNull();
    // The 100 case is the one that used to reach a NUMERIC(4,2) column.
    expect(tenPoint.check('100')).not.toBeNull();
  });

  it('rejects more precision than a transcript reports', () => {
    expect(tenPoint.check('8.5555')).not.toBeNull();
  });

  it('also offers the 4.0 scale, whose ceiling is 4', () => {
    const fourPoint = format('Vietnamese National Curriculum', '4.0 scale');
    expect(fourPoint.check('3.6')).toBeNull();
    // 8.5 is a good grade on the other scale and impossible on this one. This is
    // the confusion a single shared GPA box could not catch.
    expect(fourPoint.check('8.5')).not.toBeNull();
  });
});

describe('IB Diploma Programme', () => {
  const total = format('IB Diploma Programme (IBDP)');

  it('asks for points out of 45, not a GPA', () => {
    expect(total.scale).toBe('IB points (out of 45)');
    expect(total.check('38')).toBeNull();
    expect(total.check('45')).toBeNull();
    expect(total.check('46')).not.toBeNull();
  });

  it('rejects a fractional total — IB does not award one', () => {
    expect(total.check('38.5')).not.toBeNull();
  });
});

describe('Cambridge International', () => {
  const letters = format('Cambridge International (IGCSE / AS & A Level)');

  it('accepts letter grades, run together or separated', () => {
    expect(letters.check('A*AA')).toBeNull();
    expect(letters.check('A* A A')).toBeNull();
    expect(letters.check('A*, A, B')).toBeNull();
    expect(letters.check('a*aa')).toBeNull();
  });

  it('rejects letters that are not grades', () => {
    expect(letters.check('AZZ')).not.toBeNull();
    expect(letters.check('F')).not.toBeNull();
  });

  it('has no number to compare on, and does not invent one', () => {
    expect(letters.toNumber('A*AA')).toBeNull();
  });

  it('offers the 9–1 IGCSE scale as its second option', () => {
    const numbers = format('Cambridge International (IGCSE / AS & A Level)', 'IGCSE grades (9–1)');
    expect(numbers.check('9, 8, 8, 7')).toBeNull();
    expect(numbers.check('9 8 7')).toBeNull();
    expect(numbers.check('10')).not.toBeNull();
  });
});

describe('AP + US High School Diploma', () => {
  it('caps the unweighted scale at 4.0 and the weighted one at 5.0', () => {
    const unweighted = format('AP + US High School Diploma');
    const weighted = format('AP + US High School Diploma', '5.0 scale (weighted)');
    expect(unweighted.check('3.8')).toBeNull();
    expect(unweighted.check('4.4')).not.toBeNull();
    expect(weighted.check('4.4')).toBeNull();
    expect(weighted.check('5.4')).not.toBeNull();
  });
});

describe('Others…', () => {
  it('range-checks a percentage', () => {
    const percent = format('Others...');
    expect(percent.check('87')).toBeNull();
    expect(percent.check('100')).toBeNull();
    expect(percent.check('101')).not.toBeNull();
  });

  it('insists an unknown scale leads with its number', () => {
    const other = format('Others...', 'Other scale — describe it');
    expect(other.check('18/20')).toBeNull();
    expect(other.check('87%')).toBeNull();
    expect(other.check('87 out of 100')).toBeNull();
    // The whole point: prose is not a grade, and neither is prose with a digit
    // buried in it.
    expect(other.check('pretty good')).not.toBeNull();
    expect(other.check('abc123def')).not.toBeNull();
  });
});

describe('English proficiency scores', () => {
  it('holds IELTS to half bands inside 0–9', () => {
    const ielts = ENGLISH_TEST_FORMATS['IELTS Academic']!;
    expect(ielts.check('7.5')).toBeNull();
    expect(ielts.check('9')).toBeNull();
    // 7.3 is not a band IELTS awards.
    expect(ielts.check('7.3')).not.toBeNull();
    expect(ielts.check('9.5')).not.toBeNull();
  });

  it('holds TOEFL to a whole number inside 0–120', () => {
    const toefl = ENGLISH_TEST_FORMATS['TOEFL iBT']!;
    expect(toefl.check('102')).toBeNull();
    expect(toefl.check('121')).not.toBeNull();
    expect(toefl.check('102.5')).not.toBeNull();
  });

  it('holds Duolingo to steps of 5 inside 10–160', () => {
    const duolingo = ENGLISH_TEST_FORMATS['Duolingo English Test']!;
    expect(duolingo.check('125')).toBeNull();
    expect(duolingo.check('126')).not.toBeNull();
    expect(duolingo.check('165')).not.toBeNull();
  });

  it('returns the number the student typed, for the NUMERIC column', () => {
    expect(ENGLISH_TEST_FORMATS['IELTS Academic']!.toNumber('7.5')).toBe(7.5);
  });
});

describe('standardized test scores', () => {
  it('holds the SAT to steps of 10 inside 400–1600', () => {
    const sat = STANDARDIZED_TEST_FORMATS['SAT']!;
    expect(sat.check('1450')).toBeNull();
    expect(sat.check('1455')).not.toBeNull();
    expect(sat.check('300')).not.toBeNull();
    expect(sat.check('1610')).not.toBeNull();
  });

  it('holds the ACT to 1–36', () => {
    const act = STANDARDIZED_TEST_FORMATS['ACT']!;
    expect(act.check('34')).toBeNull();
    expect(act.check('37')).not.toBeNull();
  });

  it('takes AP as a list of 1–5 scores', () => {
    const ap = STANDARDIZED_TEST_FORMATS['AP Exams']!;
    expect(ap.check('5, 4, 5')).toBeNull();
    expect(ap.check('5')).toBeNull();
    expect(ap.check('6')).not.toBeNull();
  });

  it('takes GCSE grades in either the 9–1 or the A*–G system', () => {
    const gcse = STANDARDIZED_TEST_FORMATS['GCSE / IGCSE']!;
    expect(gcse.check('9, 8, A*')).toBeNull();
    expect(gcse.check('A*AB')).toBeNull();
    expect(gcse.check('987')).toBeNull();
    expect(gcse.check('H')).not.toBeNull();
    // Mixing the two systems requires separators. Without that rule every
    // character of "abc123def" is a legal token and the whole string passes.
    expect(gcse.check('abc123def')).not.toBeNull();
    expect(gcse.check('A9')).not.toBeNull();
    expect(gcse.check('A 9')).toBeNull();
  });
});

describe('gradeFormatFor', () => {
  it('falls back to the first scale when the stored one is unrecognised', () => {
    // A profile written before a scale was renamed must still render a field.
    expect(format('Vietnamese National Curriculum', 'Percentage of the moon').scale).toBe(
      '10-point scale',
    );
  });

  it('is undefined for a curriculum it has never heard of', () => {
    expect(gradeFormatFor('Klingon Baccalaureate', undefined)).toBeUndefined();
    expect(scalesFor('Klingon Baccalaureate')).toEqual([]);
    expect(defaultScaleFor('Klingon Baccalaureate')).toBe('');
  });
});

describe('toCurriculumGrades', () => {
  it('reads the rows a save wrote', () => {
    expect(
      toCurriculumGrades([
        { curriculum: 'IB Diploma Programme (IBDP)', scale: 'IB points (out of 45)', grade: '38', value: 38 },
      ]),
    ).toEqual([
      { curriculum: 'IB Diploma Programme (IBDP)', scale: 'IB points (out of 45)', grade: '38', value: 38 },
    ]);
  });

  it('drops anything that is not a row, because JSONB is unknown at the boundary', () => {
    expect(toCurriculumGrades(null)).toEqual([]);
    expect(toCurriculumGrades('a string')).toEqual([]);
    expect(toCurriculumGrades([null, 42, { scale: 'no curriculum' }, { curriculum: 'no scale' }])).toEqual(
      [],
    );
  });

  it('keeps a letter grade and leaves its value null', () => {
    expect(
      toCurriculumGrades([
        { curriculum: 'Cambridge International (IGCSE / AS & A Level)', scale: 'A Level / AS letter grades', grade: 'A*AA' },
      ]),
    ).toEqual([
      {
        curriculum: 'Cambridge International (IGCSE / AS & A Level)',
        scale: 'A Level / AS letter grades',
        grade: 'A*AA',
        value: null,
      },
    ]);
  });
});
