/**
 * The candidate-information flow: two steps, defined once.
 *
 * WHY THIS FILE EXISTS. The mockups badge the achievements page "1/2" and the
 * personal-information page "2/3" — two different totals for the same flow, and
 * the 1/2 page draws BOTH progress segments filled. That is what happens when
 * each screen carries its own copy of the step count, so neither page owns one:
 * they both read it from here.
 *
 * WHY TWO STEPS AND NOT THREE. The third step in the mockups' larger count was
 * documents, and documents already have their own profile page. Folding them in
 * would give the flow an invisible step that duplicates a screen the student
 * can reach anyway. The CV upload still appears on step 2 — it is useful there
 * — but it is not a step of its own.
 *
 * ORDER. Personal and study information first, achievements second: the second
 * is the long one, and asking for a nationality before an Olympiad placing is
 * the gentler ramp.
 */

export const REFLECTION_STEPS = [
  {
    key: 'about',
    /** 1-based, for "1/2". */
    number: 1,
    path: '/ai-strategy/reflection',
    en: 'Personal and study information',
    vi: 'Thông tin cá nhân và học tập',
  },
  {
    key: 'evidence',
    number: 2,
    path: '/ai-strategy/reflection/achievements',
    en: 'Achievements and activities',
    vi: 'Thành tích và hoạt động',
  },
] as const;

export type ReflectionStepKey = (typeof REFLECTION_STEPS)[number]['key'];

export const REFLECTION_STEP_COUNT = REFLECTION_STEPS.length;

export function reflectionStep(key: ReflectionStepKey) {
  const step = REFLECTION_STEPS.find((s) => s.key === key);
  // Non-null: the key type only admits members of the list above.
  return step!;
}

/**
 * How much of the bar is filled, 0–1, for a step that is being *worked on*.
 *
 * `number / count`, so step 1 of 2 shows half and step 2 shows full. The
 * mockup's achievements page showed a full bar while labelled 1/2, which reads
 * as "finished" on the screen where the student has done the least.
 */
export function reflectionProgress(key: ReflectionStepKey): number {
  return reflectionStep(key).number / REFLECTION_STEP_COUNT;
}

/**
 * Step 1's questions, one per screen, in the order they are asked.
 *
 * ─── WHY THE ORDER IS WHAT IT IS ─────────────────────────────────────────────
 *
 * The same ramp `REFLECTION_STEPS` already documents, applied within the step:
 * facts a student can answer without thinking come first (education,
 * nationality, grades), then choices they may already have made (subject,
 * country, level, intake), then the two that need a moment's reflection
 * (career goal, motivation), then money last. Asking "why does this subject
 * matter to you?" as the opening question of a form is how a student decides
 * to come back later.
 *
 * ─── WHY BUDGET IS ONE ENTRY AND NOT TWO ─────────────────────────────────────
 *
 * The VND slider and the USD band are two controls for one quantity and they
 * update each other (`vndRangeFromUsdBand`/`usdBandFromVndRange`). On separate
 * screens the sync would be invisible — a student would answer in USD, move
 * on, and never see the slider agree. They are one question with two ways to
 * answer it, so they share a screen.
 *
 * ─── ONLY STEP 1 ─────────────────────────────────────────────────────────────
 *
 * Step 2 is two repeatable lists (achievements, activities), not questions
 * with one answer each, so it keeps its existing layout — owner decision. A
 * student with four awards should not be walked through four identical
 * screens.
 */
export const ABOUT_QUESTIONS = [
  { key: 'highestEducation', section: 'Personal information' },
  { key: 'nationality', section: 'Personal information' },
  { key: 'gpa', section: 'Scores' },
  { key: 'ielts', section: 'Scores' },
  { key: 'majors', section: 'Aspirations' },
  { key: 'countries', section: 'Aspirations' },
  { key: 'intendedLevel', section: 'Aspirations' },
  { key: 'targetIntake', section: 'Aspirations' },
  { key: 'careerGoal', section: 'Aspirations' },
  { key: 'studyMotivation', section: 'Aspirations' },
  { key: 'fundingSource', section: 'Budget' },
  { key: 'budget', section: 'Budget' },
] as const;

export type AboutQuestionKey = (typeof ABOUT_QUESTIONS)[number]['key'];

export const ABOUT_QUESTION_COUNT = ABOUT_QUESTIONS.length;

/**
 * How full the bar is while answering question `index` (0-based) of step 1.
 *
 * Counts questions *behind* the student, not including the one on screen, and
 * scales into step 1's share of the whole flow — so the bar starts empty,
 * advances a notch per answer, and reads exactly `1 / REFLECTION_STEP_COUNT`
 * at the moment step 1 is handed off to step 2. The old behaviour jumped
 * straight to half on arrival, which told a student who had answered nothing
 * that they were halfway.
 */
export function aboutQuestionProgress(index: number): number {
  const clamped = Math.min(Math.max(index, 0), ABOUT_QUESTION_COUNT);
  return (clamped / ABOUT_QUESTION_COUNT) * (1 / REFLECTION_STEP_COUNT);
}
