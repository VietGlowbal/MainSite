/**
 * Academic grading formats — onboarding câu 6 (curriculum + grade) and câu 7
 * (test scores).
 *
 * WHY THIS EXISTS
 *
 * Câu 6 asks for the curriculum as a CHECKBOX list — a student can sit
 * Vietnamese National plus AP at the same time — and then asked for one
 * "Current GPA". That box accepted anything, including letters, because the
 * only check was a `parseFloat` at save time whose `null` was written silently.
 * Two things were wrong with it:
 *
 *   1. One box for several curricula. A 10-point Vietnamese average and a 4.0
 *      US GPA are different numbers on different scales; a single field forces
 *      the student to throw one of them away, and whichever survives is
 *      unlabelled.
 *   2. No scale, no format. "8.5" is a good Vietnamese GPA and an impossible
 *      4.0-scale one. "38" is an IB total and nothing at all on a 4.0 scale.
 *      A shared, unvalidated box cannot tell those apart, so nothing
 *      downstream can compare them.
 *
 * So a grade is described by the scale it sits on, and every scale carries the
 * range, the granularity and the shape it accepts. One curriculum, one scale,
 * one checked grade.
 *
 * Câu 7's test scores get the same treatment for the same reason: IELTS runs
 * 0–9 in half bands, TOEFL 0–120 whole, A-Level is letters. A single free-text
 * box let "sdvds" through as a TOEFL score.
 *
 * WHAT IS DELIBERATELY LOOSE
 *
 * Text scales (A-Level letters, IGCSE 9–1, AP exam lists) are checked for
 * SHAPE, not truth: "A*AA" passes and "sdf" does not, but nothing here knows
 * whether the student actually holds those grades. That is the correct limit —
 * this is an input guard, not verification.
 *
 * Pure functions only. No React, no I/O — see the note on the domain barrel.
 */

/**
 * A rejected value, as a translatable template plus its numbers.
 *
 * Not a finished sentence: the ranges differ per scale, so a pre-formatted
 * string would need one dictionary key per scale to stay bilingual. The caller
 * runs `t(message, vars)`, which interpolates and falls back to English.
 */
export type GradeProblem = {
  /** English source string with `{name}` placeholders — a dictionary key. */
  message: string;
  vars: Record<string, string | number>;
};

/** One way of being graded: a named scale plus everything the field needs. */
export type GradeFormat = {
  /** Stored verbatim, and shown as the scale's label. */
  scale: string;
  /** Label above the box. Names what is being asked for, which is not always a GPA. */
  fieldLabel: string;
  placeholder: string;
  /** Helper text under the box while it is valid. */
  hint: string;
  /** False for letter-grade scales, so the mobile keyboard stays alphabetic. */
  numeric: boolean;
  /** `null` when `raw` is a grade on this scale. Empty input is the caller's call. */
  check: (raw: string) => GradeProblem | null;
  /** The comparable number, or `null` for scales that have none (letters). */
  toNumber: (raw: string) => number | null;
};

const MESSAGES = {
  range: 'Enter a number between {min} and {max}.',
  whole: 'This scale uses whole numbers only.',
  decimals: 'Round to {decimals} decimal places or fewer.',
  grid: 'Scores on this scale move in steps of {step}.',
  shape: 'Use grades like {example}.',
} as const;

/** Digits with at most one decimal separator. Rejects signs, spaces and letters. */
const NUMBER_SHAPE = /^\d+(?:[.,]\d+)?$/;

function readNumber(raw: string): number | null {
  const text = raw.trim();
  if (!NUMBER_SHAPE.test(text)) return null;
  const value = Number.parseFloat(text.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function decimalsIn(raw: string): number {
  const fraction = raw.trim().replace(',', '.').split('.')[1];
  return fraction === undefined ? 0 : fraction.length;
}

/**
 * Is `value` on the scale's grid?
 *
 * Compared as hundredths rather than with `%` on floats: `7.3 % 0.5` is
 * 0.2999999999999998, so a modulo test rejects legitimate half bands.
 */
function onGrid(value: number, grid: number): boolean {
  return Math.round(value * 100) % Math.round(grid * 100) === 0;
}

function numericScale(spec: {
  scale: string;
  fieldLabel: string;
  placeholder: string;
  hint: string;
  min: number;
  max: number;
  /** Decimal places the scale reports to. 0 for whole-number scales. */
  decimals: number;
  /** Multiple the scale steps in — 0.5 for IELTS bands, 10 for SAT. Omit for none. */
  grid?: number;
}): GradeFormat {
  const grid = spec.grid;
  return {
    scale: spec.scale,
    fieldLabel: spec.fieldLabel,
    placeholder: spec.placeholder,
    hint: spec.hint,
    numeric: true,
    // Annotated because TypeScript otherwise widens the union of returns into
    // one object with every `vars` key present-but-undefined, which no longer
    // satisfies `Record<string, string | number>`.
    check(raw): GradeProblem | null {
      const value = readNumber(raw);
      // Same message for "not a number" and "out of range": both mean the same
      // thing to the student — what is in the box is not a grade on this scale.
      if (value === null || value < spec.min || value > spec.max) {
        return { message: MESSAGES.range, vars: { min: spec.min, max: spec.max } };
      }
      if (decimalsIn(raw) > spec.decimals) {
        return spec.decimals === 0
          ? { message: MESSAGES.whole, vars: {} }
          : { message: MESSAGES.decimals, vars: { decimals: spec.decimals } };
      }
      if (grid !== undefined && !onGrid(value, grid)) {
        return { message: MESSAGES.grid, vars: { step: grid } };
      }
      return null;
    },
    toNumber: readNumber,
  };
}

function letterScale(spec: {
  scale: string;
  fieldLabel: string;
  placeholder: string;
  hint: string;
  shape: RegExp;
  /** Quoted back at the student when the shape fails. */
  example: string;
}): GradeFormat {
  return {
    scale: spec.scale,
    fieldLabel: spec.fieldLabel,
    placeholder: spec.placeholder,
    hint: spec.hint,
    numeric: false,
    check(raw) {
      return spec.shape.test(raw.trim())
        ? null
        : { message: MESSAGES.shape, vars: { example: spec.example } };
    },
    // Letters have no scale to compare on. Returning a number here — a count,
    // an A=4 conversion — would invent a figure the student never gave.
    toNumber: () => null,
  };
}

/**
 * A list of one kind of grade token: "A*AA", "A* A A", "9, 8, 7".
 *
 * ⚠️ The separator has to be OPTIONAL, because "A*AA" is how A Level results are
 * genuinely written. That is also this guard's ceiling: with no separator
 * required, any run of grade letters is a syntactically valid list, "dead"
 * included. Nothing can distinguish that from a real run-together result, so the
 * check is a shape filter and not a claim the grades exist.
 */
function listOf(token: string): RegExp {
  return new RegExp(`^${token}(?:[\\s,]*${token})*$`, 'i');
}

/**
 * A list drawn from TWO token families, which may only be mixed with an explicit
 * separator: "A*AB", "9 8 7" and "9, 8, A*" pass; "abc123def" does not.
 *
 * GCSE needs this. Both the 9–1 and the A*–G systems are live, so the token set
 * is letters OR digits — and `listOf` over that union accepts "abc123def", every
 * character of which happens to be a legal token. Requiring separators for the
 * mixed case closes exactly that hole and costs nothing real: a student writing
 * one system runs it together, a student writing both is listing subjects.
 */
function mixedList(letters: string, digits: string): RegExp {
  const either = `(?:${letters}|${digits})`;
  return new RegExp(
    `^(?:${letters}(?:[\\s,]*${letters})*` +
      `|${digits}(?:[\\s,]*${digits})*` +
      `|${either}(?:[\\s,]+${either})+)$`,
    'i',
  );
}

// ── Câu 6: curriculum → the scales it is graded on ───────────────────────────
//
// Order matters: the FIRST entry is preselected when the curriculum is ticked,
// so it should be the scale most students on that curriculum actually report.

/** Vietnamese schools report a 0–10 average (điểm trung bình) to one decimal. */
const VN_10_POINT = numericScale({
  scale: '10-point scale',
  fieldLabel: 'Current GPA (0–10)',
  placeholder: '8.5',
  hint: 'Your overall average, as it appears on your transcript.',
  min: 0,
  max: 10,
  decimals: 2,
});

/** The same student's converted GPA, which US applications ask for. */
const GPA_4_POINT = numericScale({
  scale: '4.0 scale',
  fieldLabel: 'Current GPA (0–4.0)',
  placeholder: '3.6',
  hint: 'Unweighted GPA on the 4.0 scale.',
  min: 0,
  max: 4,
  decimals: 2,
});

export const CURRICULUM_GRADE_FORMATS: Record<string, readonly GradeFormat[]> = {
  'Vietnamese National Curriculum': [VN_10_POINT, GPA_4_POINT],

  'IB Diploma Programme (IBDP)': [
    // IB is a total out of 45, not a GPA. Offering a "4.0 scale" here would be
    // asking for a number the student's school does not issue.
    numericScale({
      scale: 'IB points (out of 45)',
      fieldLabel: 'Predicted or current IB total',
      placeholder: '38',
      hint: 'Six subjects plus the bonus points — 24 to 45.',
      min: 0,
      max: 45,
      decimals: 0,
    }),
    numericScale({
      scale: '7-point subject average',
      fieldLabel: 'Average subject grade (1–7)',
      placeholder: '6.2',
      hint: 'Use this if you only have per-subject grades so far.',
      min: 1,
      max: 7,
      decimals: 2,
    }),
  ],

  'Cambridge International (IGCSE / AS & A Level)': [
    letterScale({
      scale: 'A Level / AS letter grades',
      fieldLabel: 'Your A Level / AS grades',
      placeholder: 'A*AA',
      hint: 'Predicted grades are fine — mark them as predicted in your notes.',
      shape: listOf('[A-E]\\*?'),
      example: 'A*AA',
    }),
    letterScale({
      scale: 'IGCSE grades (9–1)',
      fieldLabel: 'Your IGCSE grades',
      placeholder: '9, 8, 8, 7',
      hint: 'List one number per subject.',
      shape: listOf('[1-9]'),
      example: '9, 8, 7',
    }),
  ],

  'AP + US High School Diploma': [
    numericScale({
      scale: '4.0 scale (unweighted)',
      fieldLabel: 'Current GPA (0–4.0)',
      placeholder: '3.8',
      hint: 'The unweighted GPA on your transcript.',
      min: 0,
      max: 4,
      decimals: 2,
    }),
    numericScale({
      scale: '5.0 scale (weighted)',
      fieldLabel: 'Current GPA (0–5.0)',
      placeholder: '4.4',
      hint: 'Use this only if your school weights AP and honours courses.',
      min: 0,
      max: 5,
      decimals: 2,
    }),
  ],

  'Others...': [
    numericScale({
      scale: 'Percentage (%)',
      fieldLabel: 'Current average (%)',
      placeholder: '87',
      hint: 'Your overall average as a percentage.',
      min: 0,
      max: 100,
      decimals: 2,
    }),
    // An unknown scale cannot be range-checked. What it CAN be held to is the
    // way every grade is written: the number first, then what it is out of —
    // "18/20", "87%", "87 out of 100". Insisting on the leading digit is what
    // separates a grade from prose; a "contains a digit anywhere" test passes
    // "abc123def", which is the whole class of input this replaces.
    {
      scale: 'Other scale — describe it',
      fieldLabel: 'Your grade and its scale',
      placeholder: '18/20',
      hint: 'Start with the number — for example 18/20 or 87%.',
      numeric: false,
      check: (raw) =>
        /^\d[\d\s.,/%()A-Za-z-]{0,59}$/.test(raw.trim())
          ? null
          : { message: MESSAGES.shape, vars: { example: '18/20, 87%' } },
      toNumber: () => null,
    },
  ],
};

/**
 * The format for a curriculum on the scale the student picked.
 *
 * Falls back to the curriculum's first scale rather than to `undefined` when
 * the stored scale is unrecognised — a profile saved before a scale was
 * renamed still renders a usable field instead of an empty step.
 */
export function gradeFormatFor(
  curriculum: string,
  scale: string | undefined,
): GradeFormat | undefined {
  const formats = CURRICULUM_GRADE_FORMATS[curriculum];
  if (formats === undefined || formats.length === 0) return undefined;
  if (scale === undefined) return formats[0];
  return formats.find((format) => format.scale === scale) ?? formats[0];
}

/** Every scale a curriculum offers, for the scale picker. */
export function scalesFor(curriculum: string): readonly GradeFormat[] {
  return CURRICULUM_GRADE_FORMATS[curriculum] ?? [];
}

/** The scale preselected the moment a curriculum is ticked. */
export function defaultScaleFor(curriculum: string): string {
  return CURRICULUM_GRADE_FORMATS[curriculum]?.[0]?.scale ?? '';
}

// ── Câu 7: test → its one score format ──────────────────────────────────────

/** English proficiency. Every one of these is numeric; the column is NUMERIC. */
export const ENGLISH_TEST_FORMATS: Record<string, GradeFormat> = {
  'IELTS Academic': numericScale({
    scale: 'IELTS band',
    fieldLabel: 'Overall band',
    placeholder: '7.5',
    hint: 'Half bands only — 0 to 9.',
    min: 0,
    max: 9,
    decimals: 1,
    grid: 0.5,
  }),
  'TOEFL iBT': numericScale({
    scale: 'TOEFL total',
    fieldLabel: 'Total score',
    placeholder: '102',
    hint: 'Four sections out of 30 each — 0 to 120.',
    min: 0,
    max: 120,
    decimals: 0,
  }),
  'PTE Academic': numericScale({
    scale: 'PTE overall',
    fieldLabel: 'Overall score',
    placeholder: '68',
    hint: '10 to 90.',
    min: 10,
    max: 90,
    decimals: 0,
  }),
  'Duolingo English Test': numericScale({
    scale: 'Duolingo overall',
    fieldLabel: 'Overall score',
    placeholder: '125',
    hint: 'Reported in steps of 5 — 10 to 160.',
    min: 10,
    max: 160,
    decimals: 0,
    grid: 5,
  }),
  'Cambridge English': numericScale({
    scale: 'Cambridge English Scale',
    fieldLabel: 'Cambridge English Scale score',
    placeholder: '185',
    hint: '80 to 230 on the Cambridge English Scale.',
    min: 80,
    max: 230,
    decimals: 0,
  }),
};

/**
 * Standardized tests. Mixed numeric and letter scales, which is why the column
 * behind them is TEXT — see supabase-academic-intake.sql.
 */
export const STANDARDIZED_TEST_FORMATS: Record<string, GradeFormat> = {
  SAT: numericScale({
    scale: 'SAT total',
    fieldLabel: 'Total score',
    placeholder: '1450',
    hint: 'Reported in steps of 10 — 400 to 1600.',
    min: 400,
    max: 1600,
    decimals: 0,
    grid: 10,
  }),
  ACT: numericScale({
    scale: 'ACT composite',
    fieldLabel: 'Composite score',
    placeholder: '34',
    hint: '1 to 36.',
    min: 1,
    max: 36,
    decimals: 0,
  }),
  'AP Exams': letterScale({
    scale: 'AP exam scores',
    fieldLabel: 'Your AP scores',
    placeholder: '5, 4, 5',
    hint: 'One score per exam, 1 to 5.',
    shape: listOf('[1-5]'),
    example: '5, 4, 5',
  }),
  'IB Diploma': numericScale({
    scale: 'IB points (out of 45)',
    fieldLabel: 'IB total',
    placeholder: '38',
    hint: '24 to 45.',
    min: 0,
    max: 45,
    decimals: 0,
  }),
  'A-Level': letterScale({
    scale: 'A Level letter grades',
    fieldLabel: 'Your A Level grades',
    placeholder: 'A*AA',
    hint: 'One letter per subject; A* to E.',
    shape: listOf('[A-E]\\*?'),
    example: 'A*AA',
  }),
  'GCSE / IGCSE': letterScale({
    scale: 'GCSE / IGCSE grades',
    fieldLabel: 'Your GCSE / IGCSE grades',
    placeholder: '9, 8, A*',
    // Both the 9–1 and the A*–G systems are live, and a student who sat both
    // reports a mix, so the shape accepts either token.
    hint: 'Numbers (9–1) or letters (A*–G).',
    shape: mixedList('[A-G]\\*?', '[1-9]'),
    example: '9, 8, A*',
  }),
};

// ── Câu 6 answers, as saved ─────────────────────────────────────────────────

/**
 * One row of `student_profiles.curriculum_grades`.
 *
 * `grade` is what the student typed, kept verbatim so a letter scale survives
 * the round trip. `value` is the same grade as a number when the scale has one,
 * which is what a comparison against `universities.gpa_range` can use.
 */
export type CurriculumGrade = {
  curriculum: string;
  scale: string;
  grade: string;
  value: number | null;
};

/** Whatever the JSONB column hands back, as the list the UI is typed for. */
export function toCurriculumGrades(value: unknown): CurriculumGrade[] {
  if (!Array.isArray(value)) return [];
  const rows: CurriculumGrade[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const curriculum = row['curriculum'];
    const scale = row['scale'];
    const grade = row['grade'];
    if (typeof curriculum !== 'string' || typeof scale !== 'string') continue;
    rows.push({
      curriculum,
      scale,
      grade: typeof grade === 'string' ? grade : '',
      value: typeof row['value'] === 'number' ? row['value'] : null,
    });
  }
  return rows;
}
