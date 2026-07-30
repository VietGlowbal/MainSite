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
