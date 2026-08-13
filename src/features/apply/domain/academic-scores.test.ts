import { describe, expect, it } from 'vitest';
import {
  ADMISSIONS_TESTS,
  ENGLISH_TESTS,
  GPA_SCALE,
  IELTS_SCALE,
  admissionsTestScale,
  englishTestScale,
  ieltsFromEnglishTest,
  validateGpa,
  validateIelts,
  validateScore,
  type EnglishTestId,
} from './academic-scores';

describe('scales are the real ones', () => {
  it('caps GPA at 4.0', () => {
    expect(GPA_SCALE.max).toBe(4);
  });

  it('caps IELTS at 9.0, not 10', () => {
    // The old form's placeholder read "7 / 10". A student copying it would
    // have stored a band IELTS does not issue.
    expect(IELTS_SCALE.max).toBe(9);
    expect(IELTS_SCALE.step).toBe(0.5);
  });

  it('uses the real SAT range rather than treating it as a GPA', () => {
    const sat = admissionsTestScale('sat');
    expect(sat.min).toBe(400);
    expect(sat.max).toBe(1600);
  });

  it('gives every admissions test a plausible range', () => {
    for (const test of ADMISSIONS_TESTS) {
      expect(test.max, test.label).toBeGreaterThan(test.min);
    }
  });

  it('gives every English test its own range', () => {
    expect(englishTestScale('toefl_ibt').max).toBe(120);
    expect(englishTestScale('pte_academic').max).toBe(90);
    expect(englishTestScale('duolingo').max).toBe(160);
    expect(englishTestScale('cambridge').max).toBe(230);
  });
});

describe('validateGpa', () => {
  it('accepts a value inside the scale', () => {
    expect(validateGpa('3.5')).toBeNull();
    expect(validateGpa('4')).toBeNull();
    expect(validateGpa('0')).toBeNull();
  });

  it('rejects anything above 4.0', () => {
    expect(validateGpa('4.1')).toMatch(/higher than 4\.0/);
    expect(validateGpa('10')).toMatch(/higher than 4\.0/);
  });

  it('rejects a negative', () => {
    expect(validateGpa('-1')).toMatch(/lower than 0/);
  });

  it('rejects text', () => {
    expect(validateGpa('very good')).toMatch(/as a number/);
  });

  it('accepts an empty field — every question is skippable', () => {
    expect(validateGpa('')).toBeNull();
    expect(validateGpa('   ')).toBeNull();
  });
});

describe('validateIelts', () => {
  it('accepts real half bands', () => {
    for (const band of ['0', '5', '6.5', '7', '7.5', '9']) {
      expect(validateIelts(band), band).toBeNull();
    }
  });

  it('rejects a band above 9.0', () => {
    // The spec names this error explicitly.
    expect(validateIelts('9.5')).toMatch(/higher than 9\.0/);
    expect(validateIelts('10')).toMatch(/higher than 9\.0/);
  });

  it('rejects a quarter band', () => {
    expect(validateIelts('6.25')).toMatch(/half bands/);
    expect(validateIelts('7.2')).toMatch(/half bands/);
  });

  it('does not reject 6.5 to a floating-point rounding slip', () => {
    // The obvious modulo implementation fails this one.
    expect(validateIelts('6.5')).toBeNull();
    expect(validateIelts('8.5')).toBeNull();
  });
});

describe('validateScore', () => {
  it('names the field in the message', () => {
    expect(validateScore('2000', admissionsTestScale('sat'), 'SAT')).toMatch(/SAT/);
  });

  it('holds a score to the test’s own floor', () => {
    // The SAT starts at 400 — a 200 is not a low score, it is a wrong one.
    expect(validateScore('200', admissionsTestScale('sat'), 'SAT')).toMatch(/lower than 400/);
  });
});

describe('ieltsFromEnglishTest', () => {
  it('converts the example from the spec', () => {
    // TOEFL iBT 95 → IELTS 7.0
    expect(ieltsFromEnglishTest('toefl_ibt', 95)?.ielts).toBe(7);
  });

  it('converts each published test somewhere sensible', () => {
    expect(ieltsFromEnglishTest('pte_academic', 65)?.ielts).toBe(7);
    expect(ieltsFromEnglishTest('duolingo', 120)?.ielts).toBe(7);
    expect(ieltsFromEnglishTest('cambridge', 185)?.ielts).toBe(7);
  });

  it('refuses to convert a score the test cannot produce', () => {
    // Out of range is a typo, not a result — guessing at it would put a
    // fabricated band on the student's profile.
    expect(ieltsFromEnglishTest('toefl_ibt', 200)).toBeNull();
    expect(ieltsFromEnglishTest('toefl_ibt', -5)).toBeNull();
    expect(ieltsFromEnglishTest('pte_academic', 5)).toBeNull();
  });

  it('refuses to convert "Other" — there is no table for it', () => {
    // That case goes to the model instead, which can say it is unsure.
    expect(ieltsFromEnglishTest('other', 50)).toBeNull();
  });

  it('never produces a band outside the IELTS scale', () => {
    const ids = ENGLISH_TESTS.filter((t) => t.value !== 'other');
    for (const test of ids) {
      for (let score = test.min; score <= test.max; score += 1) {
        const result = ieltsFromEnglishTest(test.value as EnglishTestId, score);
        if (!result) continue;
        expect(result.ielts, `${test.label} ${score}`).toBeGreaterThanOrEqual(IELTS_SCALE.min);
        expect(result.ielts, `${test.label} ${score}`).toBeLessThanOrEqual(IELTS_SCALE.max);
        expect(Math.round(result.ielts * 10) % 5, `${test.label} ${score}`).toBe(0);
      }
    }
  });

  it('never goes down as the score goes up', () => {
    // A concordance table with a row out of order would convert a better
    // score into a worse band.
    const ids = ENGLISH_TESTS.filter((t) => t.value !== 'other');
    for (const test of ids) {
      let previous = 0;
      for (let score = test.min; score <= test.max; score += 1) {
        const result = ieltsFromEnglishTest(test.value as EnglishTestId, score);
        if (!result) continue;
        expect(result.ielts, `${test.label} ${score}`).toBeGreaterThanOrEqual(previous);
        previous = result.ielts;
      }
    }
  });

  it('explains itself in one line, naming both scores', () => {
    const result = ieltsFromEnglishTest('toefl_ibt', 95);
    expect(result?.explanation).toContain('TOEFL iBT');
    expect(result?.explanation).toContain('7.0');
  });
});
