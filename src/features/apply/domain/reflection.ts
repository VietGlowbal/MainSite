import { z } from 'zod';

/**
 * Reflection — the questionnaire that opens the AI strategy journey.
 *
 * THE CENTRAL DECISION: THIS IS A VIEW OVER `student_profiles`, NOT A STORE.
 *
 * Nearly every field the form asks for already has a column, and a dedicated
 * page under /profile that edits it: nationality, study level, GPA, IELTS,
 * target subjects, preferred countries, budget. If reflection kept its own copy
 * there would be two sources of truth for the same facts, and a student who
 * updated their IELTS on /profile/english would silently get a stale match
 * report from a portrait built on the old number.
 *
 * So the form reads from the profile and writes back to it. The pleasant
 * side-effect is that a returning student sees most of it filled in, which
 * matters directly before a paywall.
 *
 * Only two fields genuinely had nowhere to live — how study will be funded, and
 * the USD tuition band — and supabase-reflection.sql adds those as columns
 * rather than inventing a parallel table for them.
 *
 * This module is pure. It knows the shape of the form and the shape of the
 * profile row, and nothing about Supabase or React.
 */

/* ─────────────────────────────────────────────────────────────────────────
   Option sets

   Exported so the form renders exactly what the schema accepts. A dropdown
   built from a separate literal list is a validation error waiting to happen.
   ───────────────────────────────────────────────────────────────────────── */

export const EDUCATION_LEVELS = [
  'High school',
  '2 - Year Associate Degree',
  '4 - Year Bachelor’s Degree',
  'Master’s Degree',
  'Doctorate',
] as const;

/**
 * What the student is applying *for*, drawn as three selectable cards rather
 * than a dropdown in the design.
 */
export const INTENDED_LEVELS = [
  'Master or Post-Graduate Certificate',
  'Bachelor’s Degree',
  'College Diploma / Certificate',
] as const;

export const FUNDING_SOURCES = [
  'Personal savings or parents',
  'Scholarship',
  'Student loan',
  'Employer or sponsor',
  'Not decided yet',
] as const;

/** Annual tuition, in USD. Bands rather than a figure — students estimate. */
export const TUITION_BUDGETS_USD = [
  'Under $10,000',
  '$10,000 - $20,000',
  '$20,000 - $30,000',
  '$30,000 - $50,000',
  'Over $50,000',
] as const;

/**
 * Academic achievement types.
 *
 * The mockup drew four, two of which were the same thing twice ("Nhóm Bằng
 * khen / Giấy khen & Chứng chỉ" and "Bằng khen / Giấy khen & Chứng chỉ", both
 * glossed "Certificates & Recognitions"). Confirmed as a mockup slip; the
 * duplicate is not reproduced here.
 *
 * `competition` is new and earns its place — an Olympiad placing is the single
 * most common Vietnamese academic credential, and filing it under "Academic
 * award" loses the distinction admissions readers care about.
 *
 * `mentoring` has MOVED to ACTIVITY_CATEGORIES. Tutoring a younger year is
 * something you did, not something you were awarded, and leaving it here put a
 * service activity in a list of prizes.
 */
export const ACHIEVEMENT_CATEGORIES = [
  { value: 'academic_award', label: 'Academic Awards & Prizes' },
  { value: 'competition', label: 'Competitions & Olympiads' },
  { value: 'research', label: 'Research & Publications' },
  { value: 'certification', label: 'Certificates & Recognitions' },
  { value: 'other', label: 'Other' },
] as const;

/**
 * Extracurricular activity types.
 *
 * `mentoring` is a category of its own rather than a corner of `leadership`:
 * it is common enough among Vietnamese applicants to be worth counting, and
 * folding it into leadership would make that bucket mean two things.
 */
export const ACTIVITY_CATEGORIES = [
  { value: 'community_project', label: 'Community Impact Project' },
  { value: 'leadership', label: 'Leadership & Initiative' },
  { value: 'innovation', label: 'Innovation & Projects' },
  { value: 'personal_growth', label: 'Personal Growth' },
  { value: 'mentoring', label: 'Advising & Tutoring' },
  { value: 'other', label: 'Other' },
] as const;

export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number]['value'];
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]['value'];

/* ─────────────────────────────────────────────────────────────────────────
   Schemas

   One per form part, so each step validates on its own and a student is never
   blocked from continuing by a field two screens away.
   ───────────────────────────────────────────────────────────────────────── */

/**
 * An optional free-text field.
 *
 * Trims, then turns '' into undefined. Without this every untouched input
 * would persist an empty string, and `''` and `null` would both mean "not
 * answered" in a column the portrait later reads — one of them displaying as a
 * blank line rather than being skipped.
 */
const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? undefined : v))
    .optional();

/** Part 2 — who the student is, what they have, where they want to go. */
export const aboutYouSchema = z.object({
  highestEducation: z.enum(EDUCATION_LEVELS).optional(),
  nationality: optionalText(120),
  /**
   * Kept as written ("3.5 / 4", "8.7/10") rather than parsed to a number.
   * Grading scales do not generalise — Vietnamese students report out of 10,
   * the template this feeds assumes 4.0 — and a number alone loses the scale.
   * The CV template makes the same call for the same reason.
   */
  gpa: optionalText(40),
  ielts: optionalText(40),
});

export const aspirationsSchema = z.object({
  /** Free text: the design offers a picker but lets students type their own. */
  majors: z.array(z.string().trim().min(1)).max(10).default([]),
  countries: z.array(z.string().trim().min(1)).max(10).default([]),
  intendedLevel: z.enum(INTENDED_LEVELS).optional(),
  fundingSource: z.enum(FUNDING_SOURCES).optional(),
  /** Total budget in VND, as a "min-max" band from the histogram slider. */
  budgetRange: optionalText(60),
  tuitionBudgetUsd: z.enum(TUITION_BUDGETS_USD).optional(),
});

export const achievementSchema = z.object({
  id: z.string().optional(),
  category: z.enum(['academic_award', 'competition', 'research', 'certification', 'other']),
  title: z.string().trim().min(1, 'Give this achievement a name.').max(200),
  competition: optionalText(200),
  organisation: optionalText(200),
  level: optionalText(80),
  /**
   * Bounded so a typo cannot store a year that makes the portrait nonsensical.
   * The lower bound is generous rather than principled; the upper allows a
   * student to record something they expect to finish next year.
   */
  year: z
    .number()
    .int()
    .min(1950)
    .max(new Date().getFullYear() + 5)
    .optional(),
  detail: optionalText(2000),
  evidenceKey: optionalText(500),
});

export const activitySchema = z.object({
  id: z.string().optional(),
  category: z.enum([
    'community_project',
    'leadership',
    'innovation',
    'personal_growth',
    'mentoring',
    'other',
  ]),
  title: z.string().trim().min(1, 'Give this activity a name.').max(200),
  organisation: optionalText(200),
  level: optionalText(80),
  period: optionalText(80),
  description: optionalText(2000),
});

export const evidenceSchema = z.object({
  achievements: z.array(achievementSchema).max(20).default([]),
  activities: z.array(activitySchema).max(20).default([]),
});

export const reflectionSchema = aboutYouSchema.merge(aspirationsSchema).merge(evidenceSchema);

export type AboutYouValues = z.infer<typeof aboutYouSchema>;
export type AspirationsValues = z.infer<typeof aspirationsSchema>;
export type AchievementValues = z.infer<typeof achievementSchema>;
export type ActivityValues = z.infer<typeof activitySchema>;
export type ReflectionValues = z.infer<typeof reflectionSchema>;

/* ─────────────────────────────────────────────────────────────────────────
   Mapping to and from student_profiles
   ───────────────────────────────────────────────────────────────────────── */

/** The subset of the profile row reflection reads and writes. */
export type ReflectionProfileRow = {
  nationality?: string | null;
  current_qualification?: string | null;
  study_level?: string | null;
  target_subjects?: string[] | null;
  preferred_countries?: string[] | null;
  budget_range?: string | null;
  funding_source?: string | null;
  tuition_budget_usd?: string | null;
  grades_summary?: Record<string, unknown> | null;
};

/** Narrow an unknown stored value to a non-empty string. */
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/** Narrow to a member of an option set, so stale data cannot break the form. */
function oneOf<T extends readonly string[]>(
  options: T,
  value: unknown,
): T[number] | undefined {
  const candidate = text(value);
  return candidate && (options as readonly string[]).includes(candidate)
    ? (candidate as T[number])
    : undefined;
}

/**
 * Build the form's initial values from what the student has already told us.
 *
 * Anything stored that is no longer a valid option — a funding source that was
 * renamed, say — is dropped rather than carried through, so the field renders
 * empty and the student re-answers instead of the form failing to submit on a
 * value they cannot see.
 */
export function reflectionFromProfile(
  profile: ReflectionProfileRow | null,
  achievements: AchievementValues[] = [],
  activities: ActivityValues[] = [],
): ReflectionValues {
  const grades = (profile?.grades_summary ?? {}) as Record<string, unknown>;

  return {
    ...(oneOf(EDUCATION_LEVELS, profile?.current_qualification) !== undefined
      ? { highestEducation: oneOf(EDUCATION_LEVELS, profile?.current_qualification) }
      : {}),
    ...(text(profile?.nationality) !== undefined
      ? { nationality: text(profile?.nationality) }
      : {}),
    ...(text(grades['gpa']) !== undefined ? { gpa: text(grades['gpa']) } : {}),
    ...(text(grades['ielts']) !== undefined ? { ielts: text(grades['ielts']) } : {}),
    majors: profile?.target_subjects ?? [],
    countries: profile?.preferred_countries ?? [],
    ...(oneOf(INTENDED_LEVELS, profile?.study_level) !== undefined
      ? { intendedLevel: oneOf(INTENDED_LEVELS, profile?.study_level) }
      : {}),
    ...(oneOf(FUNDING_SOURCES, profile?.funding_source) !== undefined
      ? { fundingSource: oneOf(FUNDING_SOURCES, profile?.funding_source) }
      : {}),
    ...(text(profile?.budget_range) !== undefined
      ? { budgetRange: text(profile?.budget_range) }
      : {}),
    ...(oneOf(TUITION_BUDGETS_USD, profile?.tuition_budget_usd) !== undefined
      ? { tuitionBudgetUsd: oneOf(TUITION_BUDGETS_USD, profile?.tuition_budget_usd) }
      : {}),
    achievements,
    activities,
  };
}

/**
 * The profile columns to write for a completed reflection.
 *
 * `grades_summary` is merged rather than replaced: it is a shared JSON column
 * that other screens write their own keys into, and overwriting it wholesale
 * would silently discard whatever /profile/academic had put there.
 *
 * Absent answers are written as null, not skipped. Reflection is where the
 * student states these facts, so clearing a field has to mean clearing it —
 * otherwise a value they deliberately removed comes back on next load.
 */
export function profileUpdateFromReflection(
  values: Pick<
    ReflectionValues,
    | 'highestEducation'
    | 'nationality'
    | 'gpa'
    | 'ielts'
    | 'majors'
    | 'countries'
    | 'intendedLevel'
    | 'fundingSource'
    | 'budgetRange'
    | 'tuitionBudgetUsd'
  >,
  existingGrades: Record<string, unknown> | null = null,
): Record<string, unknown> {
  const grades: Record<string, unknown> = { ...(existingGrades ?? {}) };
  if (values.gpa) grades['gpa'] = values.gpa;
  else delete grades['gpa'];
  if (values.ielts) grades['ielts'] = values.ielts;
  else delete grades['ielts'];

  return {
    current_qualification: values.highestEducation ?? null,
    nationality: values.nationality ?? null,
    target_subjects: values.majors.length > 0 ? values.majors : null,
    preferred_countries: values.countries.length > 0 ? values.countries : null,
    study_level: values.intendedLevel ?? null,
    funding_source: values.fundingSource ?? null,
    budget_range: values.budgetRange ?? null,
    tuition_budget_usd: values.tuitionBudgetUsd ?? null,
    grades_summary: Object.keys(grades).length > 0 ? grades : null,
  };
}

/**
 * How much of the reflection is answered, 0–100.
 *
 * Drives the form's progress bar and, later, whether the portrait is worth
 * generating at all — a portrait built on three answered fields is a portrait
 * about nobody.
 *
 * Achievements and activities count as one slot each rather than per entry, so
 * a student with one well-described award is not told they are 5% complete.
 */
export function reflectionCompleteness(values: ReflectionValues): number {
  const slots: boolean[] = [
    values.highestEducation !== undefined,
    values.nationality !== undefined,
    values.gpa !== undefined,
    values.ielts !== undefined,
    values.majors.length > 0,
    values.countries.length > 0,
    values.intendedLevel !== undefined,
    values.fundingSource !== undefined,
    values.budgetRange !== undefined,
    values.tuitionBudgetUsd !== undefined,
    values.achievements.length > 0,
    values.activities.length > 0,
  ];

  const answered = slots.filter(Boolean).length;
  return Math.round((answered / slots.length) * 100);
}
