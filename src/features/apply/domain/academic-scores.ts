/**
 * Academic and English-test scales, and the conversions between them.
 *
 * ─── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 *
 * The reflection form used to take GPA and IELTS as free text ("3.5 / 4",
 * "8.7/10") on the honest grounds that grading scales do not generalise. That
 * kept the form from lying, but it pushed the whole problem onto the student:
 * anyone from a system that does not use GPA had to convert their own grades
 * before they could answer, and nothing validated the result — an IELTS of 10
 * (the placeholder the old form actually shipped) was accepted silently even
 * though the band scale stops at 9.
 *
 * Owner direction: every numeric field should know its own scale, reject what
 * is out of range inline, and offer an AI conversion for students whose system
 * does not fit the box. That needs the scales stated once, in one pure module
 * the UI, the validators and the AI prompt all read from — otherwise "IELTS is
 * out of 9" ends up written in three places and disagrees in two of them.
 *
 * ─── WHAT IS DETERMINISTIC AND WHAT IS NOT ───────────────────────────────────
 *
 * The published English tests have real, publicly documented concordance
 * tables, so TOEFL/PTE/Duolingo/Cambridge → IELTS is done here in code, with
 * no model involved: it is faster, free, reproducible, and cannot hallucinate.
 * Only the open-ended cases go to a model — a natural-language grade
 * description ("9 As at GCSE and 4 A*s at A Level") or an English
 * qualification that is not one of the listed tests.
 *
 * ⚠️ EVERY NUMBER THIS PRODUCES IS AN ESTIMATE, AND MUST BE LABELLED AS ONE.
 * These are approximate equivalences for matching, not official conversions;
 * no examination board recognises them. The UI says so and the stored value
 * records how it was arrived at (`GpaMethod`), so a converted 4.0 can never be
 * mistaken later for a GPA the student actually holds.
 */

/* ─────────────────────────────────────────────────────────────────────────
   Scales
   ───────────────────────────────────────────────────────────────────────── */

export type ScoreScale = {
  min: number;
  max: number;
  /** Smallest legal increment. IELTS moves in half bands; TOEFL is whole points. */
  step: number;
  /** Decimal places to show. */
  precision: number;
  label: string;
};

export const GPA_SCALE: ScoreScale = {
  min: 0,
  max: 4,
  step: 0.01,
  precision: 2,
  label: '4.0',
};

/**
 * IELTS is out of 9, in half bands.
 *
 * The old form's placeholder read "7 / 10", which is not a scale IELTS has
 * ever used. A student copying the placeholder would have stored a score that
 * cannot exist.
 */
export const IELTS_SCALE: ScoreScale = {
  min: 0,
  max: 9,
  step: 0.5,
  precision: 1,
  label: '9.0',
};

/** The other English tests a student might hold, with their real ranges. */
export const ENGLISH_TESTS = [
  { value: 'toefl_ibt', label: 'TOEFL iBT', min: 0, max: 120, step: 1, precision: 0 },
  { value: 'pte_academic', label: 'PTE Academic', min: 10, max: 90, step: 1, precision: 0 },
  { value: 'duolingo', label: 'Duolingo English Test', min: 10, max: 160, step: 5, precision: 0 },
  { value: 'cambridge', label: 'Cambridge English', min: 80, max: 230, step: 1, precision: 0 },
  { value: 'other', label: 'Other', min: 0, max: 0, step: 1, precision: 0 },
] as const;

export type EnglishTestId = (typeof ENGLISH_TESTS)[number]['value'];

export function englishTest(id: EnglishTestId) {
  const found = ENGLISH_TESTS.find((t) => t.value === id);
  // Non-null: the id type only admits members of the list above.
  return found!;
}

export function englishTestScale(id: EnglishTestId): ScoreScale {
  const test = englishTest(id);
  return {
    min: test.min,
    max: test.max,
    step: test.step,
    precision: test.precision,
    label: String(test.max),
  };
}

/**
 * Admissions tests, for the scales the spec asks us not to get wrong.
 *
 * NOT CURRENTLY ASKED. The questionnaire is a fixed twelve questions and the
 * owner asked to keep it that way, so nothing renders these yet — they are
 * here because the spec is explicit that an SAT question must use 1600 rather
 * than being treated as a GPA, and the cheapest way to guarantee that is for
 * the scale to already exist and be tested when the question is added.
 */
export const ADMISSIONS_TESTS = [
  { value: 'sat', label: 'SAT', min: 400, max: 1600, step: 10, precision: 0 },
  { value: 'act', label: 'ACT', min: 1, max: 36, step: 1, precision: 0 },
  { value: 'ib', label: 'IB Diploma', min: 0, max: 45, step: 1, precision: 0 },
  { value: 'ap', label: 'AP', min: 1, max: 5, step: 1, precision: 0 },
] as const;

export type AdmissionsTestId = (typeof ADMISSIONS_TESTS)[number]['value'];

export function admissionsTestScale(id: AdmissionsTestId): ScoreScale {
  const test = ADMISSIONS_TESTS.find((t) => t.value === id)!;
  return {
    min: test.min,
    max: test.max,
    step: test.step,
    precision: test.precision,
    label: String(test.max),
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   Validation
   ───────────────────────────────────────────────────────────────────────── */

/**
 * `null` when the value is fine (or empty — every question is skippable),
 * otherwise the sentence to show directly beneath the field.
 *
 * Returns a message rather than a boolean because the spec asks for the scale
 * to be named in the error ("IELTS scores cannot be higher than 9.0"), and a
 * caller reconstructing that from a boolean would drift from the scale.
 */
export function validateScore(raw: string, scale: ScoreScale, name: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const value = Number(trimmed);
  if (!Number.isFinite(value)) return `Enter ${name} as a number.`;
  if (value < scale.min) return `${name} cannot be lower than ${scale.min}.`;
  if (value > scale.max) return `${name} cannot be higher than ${scale.label}.`;

  // Half bands only, and only where the scale says so. Checked in tenths to
  // avoid a float comparison rejecting a legitimate 6.5.
  if (scale.step >= 0.5) {
    const remainder = Math.round(value * 10) % Math.round(scale.step * 10);
    if (remainder !== 0) {
      return scale.step === 0.5
        ? `${name} moves in half bands — try ${Math.floor(value)} or ${Math.floor(value) + 0.5}.`
        : `${name} moves in steps of ${scale.step}.`;
    }
  }

  return null;
}

export const validateGpa = (raw: string) => validateScore(raw, GPA_SCALE, 'GPA');
export const validateIelts = (raw: string) => validateScore(raw, IELTS_SCALE, 'IELTS');

/* ─────────────────────────────────────────────────────────────────────────
   English test → IELTS, deterministically
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Published concordance bands, lowest first: a score at or above `from` maps
 * to `ielts`.
 *
 * Sources are each test's own published IELTS comparison. They are ranges in
 * the originals, so a single band is already a rounding — which is exactly why
 * the result is presented as an estimate the student confirms rather than
 * written straight into their profile.
 */
const CONCORDANCE: Record<Exclude<EnglishTestId, 'other'>, ReadonlyArray<{ from: number; ielts: number }>> = {
  toefl_ibt: [
    { from: 0, ielts: 4 },
    { from: 35, ielts: 4.5 },
    { from: 46, ielts: 5.5 },
    { from: 60, ielts: 6 },
    { from: 79, ielts: 6.5 },
    { from: 94, ielts: 7 },
    { from: 102, ielts: 7.5 },
    { from: 110, ielts: 8 },
    { from: 115, ielts: 8.5 },
    { from: 118, ielts: 9 },
  ],
  pte_academic: [
    { from: 10, ielts: 4 },
    { from: 30, ielts: 4.5 },
    { from: 36, ielts: 5 },
    { from: 42, ielts: 5.5 },
    { from: 50, ielts: 6 },
    { from: 58, ielts: 6.5 },
    { from: 65, ielts: 7 },
    { from: 73, ielts: 7.5 },
    { from: 79, ielts: 8 },
    { from: 84, ielts: 8.5 },
    { from: 89, ielts: 9 },
  ],
  duolingo: [
    { from: 10, ielts: 4 },
    { from: 55, ielts: 4.5 },
    { from: 65, ielts: 5 },
    { from: 75, ielts: 5.5 },
    { from: 95, ielts: 6 },
    { from: 105, ielts: 6.5 },
    { from: 115, ielts: 7 },
    { from: 125, ielts: 7.5 },
    { from: 135, ielts: 8 },
    { from: 145, ielts: 8.5 },
    { from: 155, ielts: 9 },
  ],
  cambridge: [
    { from: 80, ielts: 4 },
    { from: 120, ielts: 4.5 },
    { from: 140, ielts: 5 },
    { from: 154, ielts: 5.5 },
    { from: 169, ielts: 6 },
    { from: 176, ielts: 6.5 },
    { from: 185, ielts: 7 },
    { from: 191, ielts: 7.5 },
    { from: 200, ielts: 8 },
    { from: 210, ielts: 8.5 },
    { from: 220, ielts: 9 },
  ],
};

export type IeltsEstimate = {
  ielts: number;
  /** One line, for the result card. */
  explanation: string;
};

/**
 * A published test score → its IELTS equivalent, or `null` when we should not
 * guess.
 *
 * `null` for 'other' (there is no table to consult — that case goes to the
 * model) and for a score outside the test's own range, because a number the
 * test cannot produce is a typo, not a result to convert.
 */
export function ieltsFromEnglishTest(id: EnglishTestId, score: number): IeltsEstimate | null {
  if (id === 'other') return null;
  const test = englishTest(id);
  if (!Number.isFinite(score) || score < test.min || score > test.max) return null;

  const bands = CONCORDANCE[id];
  let match = bands[0];
  for (const band of bands) {
    if (score >= band.from) match = band;
  }
  if (!match) return null;

  return {
    ielts: match.ielts,
    explanation: `${test.label} ${formatScore(score, test.precision)} is roughly an IELTS ${match.ielts.toFixed(1)}.`,
  };
}

/** Trim a score to its scale's precision without trailing noise. */
export function formatScore(value: number, precision: number): string {
  return value.toFixed(precision);
}

/* ─────────────────────────────────────────────────────────────────────────
   How a stored score was arrived at
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Provenance for a stored GPA or IELTS.
 *
 * The spec is explicit that the original academic information must never be
 * lost, and that an AI estimate must not be mistaken for an official
 * conversion. Storing the method alongside the number is what makes that true
 * after the fact: a `4.0` tagged `ai_estimate` can be shown with a caveat, or
 * recomputed if the prompt improves, while a `4.0` tagged `entered` is the
 * student's own claim.
 */
export const SCORE_METHODS = ['entered', 'ai_estimate', 'test_conversion', 'not_taken'] as const;
export type ScoreMethod = (typeof SCORE_METHODS)[number];

/**
 * The academic block inside `student_profiles.grades_summary`.
 *
 * A JSON column rather than new columns, following the precedent that column
 * already sets (it is shared, merged rather than replaced, and other screens
 * write their own keys into it). That also means none of this needs a
 * migration — which matters given how often this project has shipped code
 * ahead of one.
 */
export type StoredScores = {
  gpa?: string;
  gpaMethod?: ScoreMethod;
  /** What the student actually typed, when the GPA came from a conversion. */
  gpaSource?: string;
  ielts?: string;
  ieltsMethod?: ScoreMethod;
  englishTest?: EnglishTestId;
  englishTestScore?: string;
  /** Set when the student says they have not sat an English test yet. */
  englishNotTaken?: boolean;
};
