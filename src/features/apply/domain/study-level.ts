/**
 * Canonical "intended study level" — the exact duplication CLAUDE.md's
 * application-flow spec calls out by name: onboarding's wizard writes
 * `student_profiles.study_level` as `undergraduate` / `postgraduate` / `phd`
 * (`src/app/onboarding/onboarding-wizard.tsx`), while the older reflection
 * "about" form wrote the SAME column from `INTENDED_LEVELS`
 * (`reflection.ts`) — `"Bachelor's Degree"` / `"Master or Post-Graduate
 * Certificate"` / `"College Diploma / Certificate"`. Whichever flow ran last
 * silently overwrote the other in a vocabulary the first flow's own reader
 * does not recognise.
 *
 * This module is the one place that vocabulary is defined. Both flows read
 * and write through it from here on, so the column can only ever hold one of
 * four tokens, and `studyLevelFromStored` still understands legacy values
 * already sitting in production so nothing already saved is lost.
 */

export const STUDY_LEVELS = ['undergraduate', 'postgraduate', 'phd', 'diploma'] as const;

export type StudyLevel = (typeof STUDY_LEVELS)[number];

export const STUDY_LEVEL_LABELS: Record<StudyLevel, string> = {
  undergraduate: 'Bachelor’s Degree',
  postgraduate: 'Master’s / Postgraduate Certificate',
  phd: 'PhD / Doctorate',
  diploma: 'College Diploma / Certificate',
};

/**
 * The reflection form's old three-option vocabulary, mapped onto the
 * canonical tokens above so `reflectionFromProfile` can keep offering the
 * same three cards without a second source of truth for the label text.
 * `phd` has no dedicated card in that older list — it lands on the
 * postgraduate option, the nearest of the three.
 */
const LEGACY_INTENDED_LEVEL_TO_CANONICAL: Record<string, StudyLevel> = {
  'Bachelor’s Degree': 'undergraduate',
  "Bachelor's Degree": 'undergraduate',
  'Master or Post-Graduate Certificate': 'postgraduate',
  'College Diploma / Certificate': 'diploma',
};

/**
 * Reads either generation of stored value — onboarding's canonical token or
 * the older reflection form's display-string — and returns the canonical
 * token. Returns `undefined` for anything else rather than guessing: a
 * genuinely unrecognised value (a future rename, a hand-edited row) is
 * preserved on the record and surfaced to the student to re-answer, not
 * silently coerced.
 */
export function studyLevelFromStored(value: string | null | undefined): StudyLevel | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if ((STUDY_LEVELS as readonly string[]).includes(trimmed)) return trimmed as StudyLevel;
  return LEGACY_INTENDED_LEVEL_TO_CANONICAL[trimmed];
}

export function studyLevelLabel(value: StudyLevel): string {
  return STUDY_LEVEL_LABELS[value];
}
