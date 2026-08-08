/**
 * The two structured onboarding answers, and how to read them back out of an
 * untrusted localStorage draft.
 *
 * WHY THIS IS ITS OWN MODULE
 *
 * A draft is not a value this build wrote. It is a value SOME build wrote, on a
 * machine that may not have loaded the app since — and it has now broken twice:
 *
 *   1. Commit 09d3bc9 renamed `Tests.englishScore: string` to
 *      `englishScores: Record<string, string>` (one score per test, instead of
 *      one shared number written across all of them) and did not migrate the
 *      drafts already sitting in people's browsers. Restoring one unchanged put
 *      `undefined` where the map belongs, and every read of it threw
 *      `Cannot read properties of undefined`.
 *   2. The câu 6 rework replaced `{ gpaScale: string[], gpa: string }` with
 *      per-curriculum `scales` / `grades` maps, with the same hazard.
 *
 * FOUR components share the `glowbal-onboarding-draft` key — this wizard,
 * `onboarding-single-page`, `onboarding-globe-quiz` and `profile-form` — and
 * they write three different top-level shapes between them. So the draft is
 * parsed defensively here, in one place, with tests, instead of being cast into
 * shape at the call site. `as` on a `JSON.parse` result is how both bugs above
 * got in.
 *
 * Pure functions only. No React, no I/O.
 */

import {
  defaultScaleFor,
  gradeFormatFor,
  scalesFor,
  toCurriculumGrades,
} from './academic-grading';
import type { CurriculumGrade, GradeFormat } from './academic-grading';

/**
 * Câu 6, keyed BY CURRICULUM.
 *
 * The frame draws one grading-scale list and one "Current GPA" box under a
 * CHECKBOX list of curricula, and that shape cannot hold the answer. A student
 * sitting the Vietnamese National Curriculum and AP has a 0–10 average and a
 * 4.0 GPA; one box makes them discard one of the two, and whichever survives is
 * stored without saying which curriculum it belongs to. An IB student has
 * neither — they have a total out of 45, which is not a GPA at all and does not
 * fit a box labelled "10-point / 4.0".
 *
 * So each ticked curriculum gets its own scale and its own checked grade, the
 * same departure (and for the same reason) as the per-test score fields in câu
 * 7. `academic-grading.ts` owns which scales a curriculum offers and what each
 * one accepts.
 */
export type Academic = {
  curriculum: string[];
  /** curriculum → the scale chosen for it. Preselected when it is ticked. */
  scales: Record<string, string>;
  /** curriculum → the grade, exactly as typed. */
  grades: Record<string, string>;
};

/**
 * Câu 7. Scores are keyed BY TEST, not shared.
 *
 * The frame draws one "Your Score:" field under each multi-select, but the
 * multi-select takes several tests. Writing that one number to every selected
 * test fabricates data — a student who ticks IELTS and TOEFL and types 7.5 gets
 * a TOEFL of 7.5, which is not a score on that scale at all. One field per
 * chosen test is a small departure from the frame and the only way these rows
 * land honestly.
 *
 * The frame's second, unlabelled "Other" box is dropped: nothing in the schema
 * corresponds to it, so it was a control that collected typing and threw it
 * away.
 */
export type Tests = {
  english: string[];
  englishScores: Record<string, string>;
  standardized: string[];
  standardizedScores: Record<string, string>;
};

export const EMPTY_ACADEMIC: Academic = { curriculum: [], scales: {}, grades: {} };
export const EMPTY_TESTS: Tests = {
  english: [],
  englishScores: {},
  standardized: [],
  standardizedScores: {},
};

// ── Untrusted-value coercion ────────────────────────────────────────────────

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function toStringMap(value: unknown): Record<string, string> {
  const map: Record<string, string> = {};
  if (value === null || typeof value !== 'object') return map;
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') map[key] = entry;
  }
  return map;
}

/**
 * Whatever `student_profiles.curriculum` hands back, as the list the UI wants.
 *
 * The column is TEXT[] — but only on a database that has had the repair block in
 * supabase-academic-intake.sql applied. It shipped as TEXT, and
 * `ADD COLUMN IF NOT EXISTS` matches on name alone, so a project that ran the
 * early copy still has TEXT and hands back a bare string.
 */
export function toCurriculumList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string' && value.trim() !== '') return [value];
  return [];
}

/**
 * The curriculum fields as they come back from `student_profiles`.
 *
 * Kept deliberately narrower than `StudentProfile` so this pure domain module
 * does not depend on an application-boundary type. It is shared by onboarding
 * and the profile editor: both must restore the same grade onto the same scale.
 */
export type AcademicProfileSource = {
  curriculum?: unknown;
  curriculum_grades?: unknown;
  gpa_scale?: string | null | undefined;
  gpa_value?: number | null | undefined;
};

/**
 * Restore the normalized profile columns into the editable câu-6 shape.
 *
 * `curriculum_grades` is canonical. The scale/value pair is only a legacy
 * fallback for a row written before the JSONB column existed, and is applied to
 * the first curriculum only when that curriculum genuinely offers the scale.
 */
export function academicFromProfile(profile: AcademicProfileSource): Academic {
  const curriculum = toCurriculumList(profile.curriculum);
  const scales: Record<string, string> = {};
  const grades: Record<string, string> = {};

  for (const row of toCurriculumGrades(profile.curriculum_grades)) {
    if (!curriculum.includes(row.curriculum)) continue;
    scales[row.curriculum] = row.scale;
    grades[row.curriculum] = row.grade;
  }

  const first = curriculum[0];
  if (
    first !== undefined &&
    grades[first] === undefined &&
    profile.gpa_value != null &&
    profile.gpa_scale != null &&
    scalesFor(first).some((format) => format.scale === profile.gpa_scale)
  ) {
    scales[first] = profile.gpa_scale;
    grades[first] = String(profile.gpa_value);
  }

  for (const name of curriculum) {
    if (scales[name] === undefined) scales[name] = defaultScaleFor(name);
  }

  return { curriculum, scales, grades: keepScores(curriculum, grades) };
}

/**
 * Drop scores belonging to tests that are no longer selected.
 *
 * Without this, unticking IELTS leaves its score behind; re-ticking it later
 * silently restores a number the student may have meant to clear, and the draft
 * carries it between sessions.
 */
export function keepScores(
  selected: readonly string[],
  scores: Record<string, string>,
): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const test of selected) {
    const score = scores[test];
    if (score !== undefined) kept[test] = score;
  }
  return kept;
}

/**
 * A câu 6 draft, as the current `Academic`.
 *
 * Pre-rework drafts hold `{ curriculum, gpaScale: string[], gpa: string }`: one
 * scale and one number covering every curriculum at once. Its single grade is
 * attributed to the FIRST curriculum, and only when that curriculum actually
 * offers the scale the grade was recorded on — a 10-point average must not
 * resurface labelled as an IB total. Anything else it held is dropped, which is
 * the honest outcome: the old form never recorded which curriculum the number
 * belonged to.
 */
export function readAcademicDraft(value: unknown): Academic | null {
  if (value === null || typeof value !== 'object') return null;
  const draft = value as Record<string, unknown>;
  const curriculum = toCurriculumList(draft['curriculum']);
  if (curriculum.length === 0) return null;

  const scales = toStringMap(draft['scales']);
  const grades = toStringMap(draft['grades']);

  const first = curriculum[0];
  const legacyGrade = draft['gpa'];
  const legacyScale = toStringList(draft['gpaScale'])[0];
  if (
    first !== undefined &&
    grades[first] === undefined &&
    typeof legacyGrade === 'string' &&
    legacyGrade.trim() !== '' &&
    legacyScale !== undefined &&
    scalesFor(first).some((format) => format.scale === legacyScale)
  ) {
    scales[first] = legacyScale;
    grades[first] = legacyGrade;
  }

  // Anything still without a scale gets its curriculum's default, so its box
  // renders with a format rather than blank.
  for (const name of curriculum) {
    if (scales[name] === undefined) scales[name] = defaultScaleFor(name);
  }

  return { curriculum, scales, grades: keepScores(curriculum, grades) };
}

/**
 * A câu 7 draft, as the current `Tests`.
 *
 * ⚠️ THIS IS THE 09d3bc9 CRASH. A draft from before that commit carries
 * `englishScore: '7.5'` and NO `englishScores` map, so restoring it unchanged
 * leaves `undefined` where every score read expects an object. The old shared
 * number is dropped rather than copied onto each selected test: writing one
 * score across several test types is exactly the invented data the rename
 * existed to stop.
 */
export function readTestsDraft(value: unknown): Tests | null {
  if (value === null || typeof value !== 'object') return null;
  const draft = value as Record<string, unknown>;
  const english = toStringList(draft['english']);
  const standardized = toStringList(draft['standardized']);
  if (english.length === 0 && standardized.length === 0) return null;
  return {
    english,
    englishScores: keepScores(english, toStringMap(draft['englishScores'])),
    standardized,
    standardizedScores: keepScores(standardized, toStringMap(draft['standardizedScores'])),
  };
}

// ── Completeness ────────────────────────────────────────────────────────────

/** Câu 6 is answered when every ticked curriculum carries a grade on its scale. */
export function academicComplete(academic: Academic): boolean {
  if (academic.curriculum.length === 0) return false;
  return academic.curriculum.every((curriculum) => {
    const format = gradeFormatFor(curriculum, academic.scales[curriculum]);
    if (format === undefined) return true;
    const raw = academic.grades[curriculum] ?? '';
    return raw.trim() !== '' && format.check(raw) === null;
  });
}

/**
 * Câu 7's scores are OPTIONAL — the step's own copy says to leave one blank
 * while waiting for a result — so this only rejects a box that has been filled
 * in with something that is not a score on that test's scale.
 */
export function testScoresValid(
  selected: readonly string[],
  scores: Record<string, string>,
  formats: Record<string, GradeFormat>,
): boolean {
  return selected.every((test) => {
    const raw = scores[test] ?? '';
    if (raw.trim() === '') return true;
    return formats[test]?.check(raw) == null;
  });
}

/**
 * Câu 6, as the rows that go into `student_profiles.curriculum_grades`.
 *
 * Ticked-but-blank curricula are skipped rather than written as empty strings:
 * "Vietnamese National Curriculum / 10-point scale / ''" claims a grade exists.
 * `academicComplete` blocks that case anyway; this is the belt to its braces,
 * and it also covers the guest path, where the draft is saved mid-answer.
 */
export function collectCurriculumGrades(academic: Academic): CurriculumGrade[] {
  const rows: CurriculumGrade[] = [];
  for (const curriculum of academic.curriculum) {
    const format = gradeFormatFor(curriculum, academic.scales[curriculum]);
    if (format === undefined) continue;
    const grade = (academic.grades[curriculum] ?? '').trim();
    if (grade === '' || format.check(grade) !== null) continue;
    rows.push({ curriculum, scale: format.scale, grade, value: format.toNumber(grade) });
  }
  return rows;
}
