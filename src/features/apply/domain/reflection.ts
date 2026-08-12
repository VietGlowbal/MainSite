import { z } from 'zod';
import { ENGLISH_TESTS, SCORE_METHODS } from './academic-scores';
import { destinationIdsFromStored } from './destination-catalog';
import { FUNDING_SOURCE_IDS, fundingSourceFromStored } from './funding-catalog';
import { intakeChoiceSchema, parseIntake, serialiseIntake } from './intake';
import {
  ALL_CURRENCIES,
  convertAmount,
  isCompleteBudget,
  parseBudget,
  serialiseBudget,
  type TuitionBudget,
} from './tuition-budget';

/** The English test ids, as a zod-friendly tuple. */
const ENGLISH_TEST_IDS = ENGLISH_TESTS.map((t) => t.value) as unknown as [
  (typeof ENGLISH_TESTS)[number]['value'],
  ...(typeof ENGLISH_TESTS)[number]['value'][],
];

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
  /**
   * Added with the option-card redesign. A student on a system none of the
   * five describes (a three-year bachelor's, a national diploma, a
   * professional qualification) previously had to pick the nearest wrong one,
   * which then went into the portrait as fact. Choosing this reveals a text
   * field — see `otherEducation` — so the real answer is captured instead of
   * approximated.
   */
  'Other',
] as const;

/**
 * The icon and one-line gloss each education option carries as a card.
 *
 * Kept beside the option set rather than in the component so the two cannot
 * drift: a level added above with no entry here renders a card with no icon,
 * which the test catches.
 */
export const EDUCATION_LEVEL_META: Record<
  (typeof EDUCATION_LEVELS)[number],
  { icon: string; hint: string }
> = {
  'High school': { icon: 'graduationCap', hint: 'Secondary school or equivalent' },
  '2 - Year Associate Degree': { icon: 'gift01', hint: 'Associate degree or diploma' },
  '4 - Year Bachelor’s Degree': { icon: 'graduationCap', hint: 'Undergraduate degree' },
  'Master’s Degree': { icon: 'zapFast', hint: 'Postgraduate degree' },
  Doctorate: { icon: 'zap', hint: 'PhD or equivalent' },
  Other: { icon: 'edit02', hint: 'Something else — tell us' },
};

/**
 * What the student is applying *for*, drawn as three selectable cards rather
 * than a dropdown in the design.
 */
export const INTENDED_LEVELS = [
  'Master or Post-Graduate Certificate',
  'Bachelor’s Degree',
  'College Diploma / Certificate',
] as const;

/**
 * Annual tuition, in USD. Bands rather than a figure — students estimate.
 *
 * ⚠️ NO LONGER ASKED. The budget question now takes a real range in the
 * student's own currency (`tuition-budget.ts`), which a five-way enum cannot
 * express. The band survives as a DERIVED value: `student_profiles
 * .tuition_budget_usd` is read by the matching prompt and by
 * `candidate-context.ts`, so `profileUpdateFromReflection` keeps writing the
 * nearest band rather than leaving those readers with a null they never had
 * before.
 */
export const TUITION_BUDGETS_USD = [
  'Under $10,000',
  '$10,000 - $20,000',
  '$20,000 - $30,000',
  '$30,000 - $50,000',
  'Over $50,000',
] as const;

export type TuitionBudgetUsd = (typeof TUITION_BUDGETS_USD)[number];

/**
 * When the student wants to start.
 *
 * Nothing else in the product asks a student this at the profile level —
 * `course_applications.intake` is per-application and is the university's
 * published intake, not the student's own target. Without it the Planner's
 * deadlines and the strategy report's roadmap have no anchor date to reason
 * about, so "prepare this over the next six months" is advice with no
 * endpoint.
 *
 * A rolling list rather than fixed years would need generating at render
 * time; these are stated plainly and reviewed when they go stale, which is
 * the same call `TUITION_BUDGETS_USD` makes.
 */
export const INTAKE_TERMS = [
  'Autumn / Fall 2026',
  'Spring 2027',
  'Autumn / Fall 2027',
  'Spring 2028',
  'Autumn / Fall 2028',
  'Later than 2028',
  'Not decided yet',
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
   Budget — one quantity, two controls

   The form asks for the budget twice: a VND slider and a USD band. They used
   to be independent, which meant a student could leave saying both "300
   triệu" and "Over $50,000" and nothing would notice. Owner decision: they
   are the SAME quantity — annual tuition — shown in two currencies, and
   moving either updates the other.

   ⚠️ BOTH CONTROLS MUST BE LABELLED "annual tuition". They previously read
   "Total budget" and "tuition budget", which are genuinely different numbers
   (whole cost of study vs one year's fees). Syncing those two would need a
   course length and a living-cost estimate we have no data for — inventing
   them is exactly what `RangeHistogram`'s own header refuses to do for the
   histogram bars. Making them one quantity is what makes the sync honest.
   ───────────────────────────────────────────────────────────────────────── */

/**
 * VND per USD, for the budget controls only.
 *
 * A CONSTANT, AND SHOWN TO THE STUDENT. A live FX rate would make a saved
 * budget mean something different next week, and the stored value is a band a
 * student chose, not a price. The form prints the rate next to the slider so
 * the conversion is a stated assumption rather than a hidden one — if it
 * drifts far enough to matter, this number changes and the label changes with
 * it.
 */
export const VND_PER_USD = 25_400;

/** The USD span each band covers. `null` is an open end. */
const TUITION_BAND_USD: Record<TuitionBudgetUsd, { min: number; max: number | null }> = {
  'Under $10,000': { min: 0, max: 10_000 },
  '$10,000 - $20,000': { min: 10_000, max: 20_000 },
  '$20,000 - $30,000': { min: 20_000, max: 30_000 },
  '$30,000 - $50,000': { min: 30_000, max: 50_000 },
  'Over $50,000': { min: 50_000, max: null },
};

/**
 * A USD band → the VND span the slider should show for it.
 *
 * The open-ended top band ("Over $50,000") stops at the slider's own maximum
 * rather than running to infinity, so selecting it puts the upper handle at
 * the end of the track instead of somewhere off it.
 */
export function vndRangeFromUsdBand(
  band: TuitionBudgetUsd,
  sliderMax: number,
): { low: number; high: number } {
  const span = TUITION_BAND_USD[band];
  const low = Math.min(span.min * VND_PER_USD, sliderMax);
  const high = span.max === null ? sliderMax : Math.min(span.max * VND_PER_USD, sliderMax);
  return { low, high };
}

/**
 * A VND span → the USD band that best describes it.
 *
 * Chosen by overlap rather than by the midpoint: a student whose range sits
 * across two bands should get the one their range actually covers most of,
 * and a midpoint test gets that wrong for any asymmetric range. Ties go to
 * the lower band, so nudging the handle up from zero does not skip ahead.
 */
export function usdBandFromVndRange(low: number, high: number): TuitionBudgetUsd {
  const lowUsd = low / VND_PER_USD;
  const highUsd = Math.max(high / VND_PER_USD, lowUsd);

  let best: TuitionBudgetUsd = TUITION_BUDGETS_USD[0];
  let bestOverlap = -1;

  for (const band of TUITION_BUDGETS_USD) {
    const span = TUITION_BAND_USD[band];
    const bandMax = span.max ?? Number.POSITIVE_INFINITY;
    const overlap = Math.min(highUsd, bandMax) - Math.max(lowUsd, span.min);
    // A zero-width range (both handles together) overlaps nothing, so fall
    // back to containment: the band the single point sits inside.
    const score = highUsd === lowUsd && lowUsd >= span.min && lowUsd <= bandMax ? 0 : overlap;
    if (score > bestOverlap) {
      bestOverlap = score;
      best = band;
    }
  }

  return best;
}

/** "1000-2000" → [1000, 2000], clamped, falling back to the full span. */
export function parseBudgetBand(
  band: string | undefined,
  min: number,
  max: number,
): [number, number] {
  if (!band) return [min, max];
  const parts = band.split('-').map((part) => Number.parseInt(part.trim(), 10));
  const [low, high] = parts;
  if (low === undefined || high === undefined) return [min, max];
  if (!Number.isFinite(low) || !Number.isFinite(high)) return [min, max];
  return [Math.max(min, Math.min(low, max)), Math.min(max, Math.max(high, min))];
}

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

/**
 * The structured tuition budget, validated at the edge.
 *
 * Mirrors `TuitionBudget` in `tuition-budget.ts` rather than re-deriving it:
 * the currency list is the same one the sliders are built from, so a request
 * cannot store a currency the form could never show, and `max` is nullable
 * because the open-ended top band is a real answer rather than a missing one.
 */
const tuitionBudgetSchema = z.object({
  currency: z.enum(ALL_CURRENCIES),
  min: z.number().min(0).max(1e12),
  max: z.number().min(0).max(1e12).nullable(),
});

/** Part 2 — who the student is, what they have, where they want to go. */
export const aboutYouSchema = z.object({
  highestEducation: z.enum(EDUCATION_LEVELS).optional(),
  /**
   * Only meaningful when `highestEducation` is 'Other'. Stored on
   * `current_qualification` in place of the literal word "Other", so the
   * portrait reads the real qualification rather than a placeholder — see
   * `profileUpdateFromReflection`.
   */
  otherEducation: optionalText(160),
  nationality: optionalText(120),
  /**
   * Kept as written ("3.5 / 4", "8.7/10") rather than parsed to a number.
   * Grading scales do not generalise — Vietnamese students report out of 10,
   * the template this feeds assumes 4.0 — and a number alone loses the scale.
   * The CV template makes the same call for the same reason.
   */
  gpa: optionalText(40),
  ielts: optionalText(40),
  /**
   * How the two scores above were arrived at, and — where one came from a
   * conversion — what the student actually wrote.
   *
   * The spec is emphatic that the original academic information must never be
   * lost and that an estimate must not be mistaken for an official
   * conversion. Keeping the provenance beside the number is what makes both
   * true after the fact: a `4.0` tagged `ai_estimate` alongside "9 As at GCSE
   * and 4 A*s at A Level" can be shown with a caveat, re-estimated if the
   * prompt improves, or corrected by the student — none of which is possible
   * once the description has been thrown away.
   *
   * All of it lands in `grades_summary`, the shared JSON column this table
   * already uses for exactly this kind of academic detail, so none of it
   * needs a migration.
   */
  gpaMethod: z.enum(SCORE_METHODS).optional(),
  gpaSource: optionalText(1000),
  ieltsMethod: z.enum(SCORE_METHODS).optional(),
  englishTest: z.enum(ENGLISH_TEST_IDS).optional(),
  englishTestScore: optionalText(20),
  englishNotTaken: z.boolean().optional(),
});

export const aspirationsSchema = z.object({
  /**
   * Subject ids from `SUBJECTS` and ISO country codes from `DESTINATIONS`.
   *
   * ⚠️ TWO GENERATIONS OF VALUE LIVE IN THESE COLUMNS. Earlier versions of
   * this form wrote display names ("Computer Science", "United Kingdom"); this
   * one writes stable ids. The schema stays a plain string array rather than
   * an enum for exactly that reason — rejecting the old values would fail the
   * save for every student who had already answered. `reflectionFromProfile`
   * normalises on the way in (see `destinationIdsFromStored`), so the form
   * always works in ids and the column converges as students revisit.
   *
   * The cap is generous rather than principled; it exists so a scripted
   * request cannot store an unbounded array.
   */
  majors: z.array(z.string().trim().min(1)).max(30).default([]),
  countries: z.array(z.string().trim().min(1)).max(30).default([]),
  /** A subject the catalogue does not list, kept beside the ids. */
  customSubject: optionalText(120),
  /**
   * "Show me strong options outside my current choices too."
   *
   * More useful to matching than an undefined "Other" country, and NOT the
   * same as selecting all 197 — which would say nothing about preference.
   */
  countryPreferenceFlexible: z.boolean().optional(),
  intendedLevel: z.enum(INTENDED_LEVELS).optional(),
  /**
   * A `FundingSourceId`, not the option's label — see `funding-catalog.ts`.
   * Stored values that are still display strings are converted on read.
   */
  fundingSource: z.enum(FUNDING_SOURCE_IDS).optional(),
  /**
   * Annual tuition, as a real range in the student's own currency.
   *
   * Replaces the VND slider (`budgetRange`) and the USD band
   * (`tuitionBudgetUsd`) that used to be asked side by side. Both of those
   * assumed the student thinks in đồng — one literally, the other by making
   * "£15,000–£40,000" unsayable. `max: null` is the open-ended top band.
   */
  tuitionBudget: tuitionBudgetSchema.optional(),
  /**
   * The three questions below exist because the reports already ask for them
   * and were getting nothing.
   *
   * `match-insights.ts` builds `careerDirection` from
   * `student_profiles.career_interests`/`goals` and `personalContext` from
   * `goals`, and the strategy report (F7) scores every candidate direction on
   * a `futureAlignment` dimension defined as "fit with the target programme
   * and career direction". Nothing in reflection wrote any of those columns,
   * so for a student who never visited the separate profile pages the model
   * was scoring future alignment against a blank. These are the cheapest
   * possible fix: three questions the student can answer in a sentence.
   */
  careerGoal: optionalText(1500),
  /**
   * Why this subject — the single answer the reports read.
   *
   * Kept as one string because that is what `student_profiles
   * .study_motivation` is and what the portrait's "driving force" section
   * consumes. It is now DERIVED rather than typed: the question asks per
   * subject (see below), and `profileUpdateFromReflection` writes the primary
   * subject's answer here. A student who answered the older single-box version
   * still has their text, and it is carried into the map on read.
   */
  studyMotivation: optionalText(1000),
  /**
   * Why each subject, keyed by the subject ids from `majors`.
   *
   * ─── WHY PER SUBJECT ─────────────────────────────────────────────────────
   *
   * "Why this subject?" is unanswerable for someone who picked three: the
   * honest answer differs per subject, and one box forces them to either pick
   * one silently or write a paragraph that is about none of them. Asking per
   * subject also gives the strategy report something it could not previously
   * have — which of a student's interests they can actually argue for.
   *
   * Only one is required. The map is sparse by design.
   */
  subjectMotivations: z
    .record(z.string().min(1).max(80), z.string().trim().max(1000))
    .optional(),
  /**
   * Which subject's motivation is the headline one.
   *
   * Needed because `study_motivation` is a single column: without it, writing
   * "the" motivation from a map of three would be an arbitrary pick that
   * changes with key order. Defaults to the first subject the student answered
   * for, and they can change it.
   */
  primaryMotivationSubject: optionalText(80),
  /**
   * When the student wants to start, as structured data.
   *
   * Replaces the `INTAKE_TERMS` enum, whose members were display strings and
   * whose years were hardcoded. See `intake.ts` for why both had to go: the
   * list went stale silently, and a display string has to be parsed before
   * anything can match against it.
   */
  intake: intakeChoiceSchema.optional(),
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
  /**
   * `goals` is REUSED, not new. `supabase-strategy-personal-summary.sql`
   * already repurposed this base-schema column as "Career goals" for the
   * unified profile editor, and that is exactly what this question asks —
   * a second column for the same fact is how two screens end up disagreeing
   * about a student's plans.
   */
  goals?: string | null;
  study_motivation?: string | null;
  /**
   * `{ "<subjectId>": "<why>", ... }`, plus a `__primary` key naming the
   * subject whose answer is mirrored into `study_motivation`.
   *
   * One JSONB column rather than a `student_subject_motivations` table: the
   * map is written and read whole, always by the owner of the profile, and is
   * capped at the thirty subjects `majors` allows. A table would buy nothing
   * but a second set of RLS policies to keep in step.
   */
  subject_motivations?: Record<string, unknown> | null;
  target_intake?: string | null;
};

/** The key inside `subject_motivations` that names the primary subject. */
const PRIMARY_MOTIVATION_KEY = '__primary';

/** Narrow an unknown stored value to a non-empty string. */
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * A stored `current_qualification` → the form's education answer.
 *
 * See the call site for why one column carries both cases.
 */
function educationFromStored(
  stored: string | null | undefined,
): { highestEducation?: (typeof EDUCATION_LEVELS)[number]; otherEducation?: string } {
  const known = oneOf(EDUCATION_LEVELS, stored);
  if (known !== undefined) return { highestEducation: known };
  const free = text(stored);
  if (free === undefined) return {};
  return { highestEducation: 'Other', otherEducation: free };
}

/**
 * The stored motivation map → the form's per-subject answers.
 *
 * ⚠️ THE OLD SINGLE ANSWER IS NEVER DROPPED. A student who answered the
 * previous one-box "Why this subject?" has their text in `study_motivation`
 * and nothing in the map. Returning it under the primary subject would be a
 * guess about which subject they meant; returning nothing would look, to them,
 * like we lost it. So it comes back as `studyMotivation` — the form shows it
 * above the per-subject boxes as the answer they gave before — and the map
 * fills in as they answer per subject.
 */
function subjectMotivationsFromStored(
  stored: Record<string, unknown> | null | undefined,
  legacy: string | null | undefined,
): {
  subjectMotivations?: Record<string, string>;
  primaryMotivationSubject?: string;
  studyMotivation?: string;
} {
  const map: Record<string, string> = {};
  let primary: string | undefined;
  const legacyText = text(legacy);

  for (const [key, value] of Object.entries(stored ?? {})) {
    if (key === PRIMARY_MOTIVATION_KEY) {
      primary = text(value);
      continue;
    }
    const answer = text(value);
    if (answer !== undefined) map[key] = answer;
  }

  // A primary naming a subject with no answer would put the form on an empty
  // box and write an empty `study_motivation` back.
  if (primary !== undefined && map[primary] === undefined) primary = undefined;

  return {
    ...(Object.keys(map).length > 0 ? { subjectMotivations: map } : {}),
    ...(primary !== undefined ? { primaryMotivationSubject: primary } : {}),
    ...(legacyText !== undefined ? { studyMotivation: legacyText } : {}),
  };
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
    /*
     * `current_qualification` holds either one of the listed levels, or — when
     * the student picked "Other" — the qualification they typed. Reading it
     * back: a recognised level is that level; anything else non-empty is an
     * "Other" answer and its own text. That keeps ONE column for one fact
     * while still round-tripping the free-text case, and means the portrait
     * reads "Diplôme d'ingénieur" rather than the word "Other".
     */
    ...educationFromStored(profile?.current_qualification),
    ...(text(profile?.nationality) !== undefined
      ? { nationality: text(profile?.nationality) }
      : {}),
    ...(text(grades['gpa']) !== undefined ? { gpa: text(grades['gpa']) } : {}),
    ...(text(grades['ielts']) !== undefined ? { ielts: text(grades['ielts']) } : {}),
    // Provenance, so a returning student lands back in the mode they used —
    // someone who described their grades sees their description again rather
    // than an empty box beside a GPA they never typed.
    ...(oneOf(SCORE_METHODS, grades['gpaMethod']) !== undefined
      ? { gpaMethod: oneOf(SCORE_METHODS, grades['gpaMethod']) }
      : {}),
    ...(text(grades['gpaSource']) !== undefined ? { gpaSource: text(grades['gpaSource']) } : {}),
    ...(oneOf(SCORE_METHODS, grades['ieltsMethod']) !== undefined
      ? { ieltsMethod: oneOf(SCORE_METHODS, grades['ieltsMethod']) }
      : {}),
    ...(oneOf(ENGLISH_TEST_IDS, grades['englishTest']) !== undefined
      ? { englishTest: oneOf(ENGLISH_TEST_IDS, grades['englishTest']) }
      : {}),
    ...(text(grades['englishTestScore']) !== undefined
      ? { englishTestScore: text(grades['englishTestScore']) }
      : {}),
    ...(grades['englishNotTaken'] === true ? { englishNotTaken: true } : {}),
    // Subjects keep whatever ids/labels are stored — the grid matches on id
    // and simply does not tick an unrecognised one, which is the same
    // outcome as dropping it but without destroying the value on next save.
    majors: profile?.target_subjects ?? [],
    // Countries are normalised to ISO codes, because the grid keys on them.
    countries: destinationIdsFromStored(profile?.preferred_countries),
    ...(oneOf(INTENDED_LEVELS, profile?.study_level) !== undefined
      ? { intendedLevel: oneOf(INTENDED_LEVELS, profile?.study_level) }
      : {}),
    // Understands both the id this form writes and the display strings the
    // previous one wrote — see `fundingSourceFromStored`.
    ...(fundingSourceFromStored(profile?.funding_source) !== undefined
      ? { fundingSource: fundingSourceFromStored(profile?.funding_source) }
      : {}),
    /*
     * Two generations of value again: the tagged `"GBP:15000-40000"` this form
     * writes, and the bare VND `"min-max"` the previous one did. `parseBudget`
     * reads both and returns undefined for anything else — including the
     * `"$15k-25k"`-style strings the old /onboarding forms wrote into the same
     * column, which have no defensible reading as a number.
     */
    ...(parseBudget(profile?.budget_range) !== undefined
      ? { tuitionBudget: parseBudget(profile?.budget_range) }
      : {}),
    ...(text(profile?.goals) !== undefined ? { careerGoal: text(profile?.goals) } : {}),
    ...subjectMotivationsFromStored(profile?.subject_motivations, profile?.study_motivation),
    // Understands both the token this form writes and the display strings
    // the previous one wrote — see `parseIntake`.
    ...(parseIntake(profile?.target_intake) !== undefined
      ? { intake: parseIntake(profile?.target_intake) }
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
    | 'otherEducation'
    | 'nationality'
    | 'gpa'
    | 'ielts'
    | 'majors'
    | 'countries'
    | 'intendedLevel'
    | 'fundingSource'
    | 'tuitionBudget'
    | 'careerGoal'
    | 'studyMotivation'
    | 'subjectMotivations'
    | 'primaryMotivationSubject'
    | 'intake'
    | 'customSubject'
    | 'countryPreferenceFlexible'
    | 'gpaMethod'
    | 'gpaSource'
    | 'ieltsMethod'
    | 'englishTest'
    | 'englishTestScore'
    | 'englishNotTaken'
  >,
  existingGrades: Record<string, unknown> | null = null,
): Record<string, unknown> {
  const grades: Record<string, unknown> = { ...(existingGrades ?? {}) };
  if (values.gpa) grades['gpa'] = values.gpa;
  else delete grades['gpa'];
  if (values.ielts) grades['ielts'] = values.ielts;
  else delete grades['ielts'];

  /*
   * Score provenance travels with the score, in the same shared JSON column.
   *
   * `gpaSource` in particular is the student's own description of their
   * grades — the thing the spec says must never be lost. Deleting a key when
   * its value is absent (rather than writing null) keeps the column tidy and
   * matches how `gpa`/`ielts` above already behave, so a student who switches
   * back to typing a score does not leave a stale "this was AI-estimated"
   * tag attached to a number they entered by hand.
   */
  const provenance: Array<[string, unknown]> = [
    ['gpaMethod', values.gpaMethod],
    ['gpaSource', values.gpaSource],
    ['ieltsMethod', values.ieltsMethod],
    ['englishTest', values.englishTest],
    ['englishTestScore', values.englishTestScore],
    ['englishNotTaken', values.englishNotTaken === true ? true : undefined],
  ];
  for (const [key, value] of provenance) {
    if (value === undefined) delete grades[key];
    else grades[key] = value;
  }

  return {
    // "Other" is a UI affordance, not an answer — store what they actually
    // wrote. If they chose Other and typed nothing, the level is genuinely
    // unanswered rather than literally "Other".
    current_qualification:
      values.highestEducation === 'Other'
        ? (values.otherEducation ?? null)
        : (values.highestEducation ?? null),
    nationality: values.nationality ?? null,
    target_subjects: values.majors.length > 0 ? values.majors : null,
    preferred_countries: values.countries.length > 0 ? values.countries : null,
    study_level: values.intendedLevel ?? null,
    funding_source: values.fundingSource ?? null,
    budget_range: isCompleteBudget(values.tuitionBudget)
      ? serialiseBudget(values.tuitionBudget)
      : null,
    // Derived, not asked. See the note on `TUITION_BUDGETS_USD`.
    tuition_budget_usd: isCompleteBudget(values.tuitionBudget)
      ? usdBandFromBudget(values.tuitionBudget)
      : null,
    goals: values.careerGoal ?? null,
    study_motivation: primaryMotivation(values) ?? null,
    subject_motivations: motivationMapForStorage(values),
    target_intake: values.intake ? serialiseIntake(values.intake) : null,
    grades_summary: Object.keys(grades).length > 0 ? grades : null,
  };
}

/**
 * The structured budget → the nearest legacy USD band.
 *
 * Goes through VND rather than duplicating `usdBandFromVndRange`'s
 * overlap-scoring rule, which is tested and correct. An open-ended top has no
 * VND figure, so it is given one far above the top band's floor — the only
 * band it can land in is "Over $50,000", which is what "and above" means.
 */
function usdBandFromBudget(budget: TuitionBudget): TuitionBudgetUsd {
  const low = convertAmount(budget.min, budget.currency, 'VND');
  const high =
    budget.max === null
      ? Math.max(low, 100_000 * VND_PER_USD)
      : convertAmount(budget.max, budget.currency, 'VND');
  return usdBandFromVndRange(low, high);
}

/** Which subject's answer is the one `study_motivation` carries. */
function primaryMotivation(
  values: Pick<
    ReflectionValues,
    'subjectMotivations' | 'primaryMotivationSubject' | 'studyMotivation'
  >,
): string | undefined {
  const map = values.subjectMotivations ?? {};
  const chosen = values.primaryMotivationSubject;
  if (chosen && text(map[chosen]) !== undefined) return text(map[chosen]);

  // No explicit primary: the first subject with an answer. Falls back to the
  // single answer a student gave before the question was split per subject,
  // so upgrading the form never blanks a column the portrait reads.
  const first = Object.values(map).find((answer) => text(answer) !== undefined);
  return text(first) ?? values.studyMotivation;
}

/**
 * The map as it is stored — answers, plus which one is primary.
 *
 * Returns null when there is nothing to store, so the column matches the
 * "absent answers are written as null, not skipped" rule the rest of this
 * function follows.
 */
function motivationMapForStorage(
  values: Pick<ReflectionValues, 'subjectMotivations' | 'primaryMotivationSubject'>,
): Record<string, string> | null {
  const entries = Object.entries(values.subjectMotivations ?? {}).filter(
    ([, answer]) => text(answer) !== undefined,
  );
  if (entries.length === 0) return null;

  const map: Record<string, string> = {};
  for (const [subject, answer] of entries) map[subject] = answer.trim();

  const chosen = values.primaryMotivationSubject;
  // Only record a primary that actually has an answer — otherwise the reader
  // drops it anyway and the column carries a key that means nothing.
  const primary = chosen && map[chosen] !== undefined ? chosen : entries[0]?.[0];
  if (primary !== undefined) map[PRIMARY_MOTIVATION_KEY] = primary;

  return map;
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
    isCompleteBudget(values.tuitionBudget),
    values.careerGoal !== undefined,
    primaryMotivation(values) !== undefined,
    values.intake !== undefined,
    values.achievements.length > 0,
    values.activities.length > 0,
  ];

  const answered = slots.filter(Boolean).length;
  return Math.round((answered / slots.length) * 100);
}
