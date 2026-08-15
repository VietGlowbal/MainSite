import { z } from 'zod';

/**
 * Personal Reflection — five fixed, cross-cutting questions asked once per
 * student (not per activity, not per application). Where Activity Reflection
 * asks "what happened during this specific experience and what did it
 * mean?", these ask "what patterns exist across your experiences, and what
 * genuinely drives you?" — deliberately kept as its own short flow rather
 * than folded into the activity reflection modal or the twelve-question
 * profile form.
 *
 * Stored globally on `student_profiles.personal_reflection_answers` (like
 * activities: written once, reusable across every application) and copied
 * into `confirmed_candidate_snapshots.payload` at confirm time so a later
 * profile edit cannot silently change what an already-generated report was
 * built from.
 */

export const PERSONAL_REFLECTION_QUESTIONS = [
  {
    key: 'q1',
    heading: 'Looking back, which experiences have shaped you the most?',
    guidance: [
      'Which moments or activities still stand out?',
      'If they had never happened, what might be different about you?',
    ],
  },
  {
    key: 'q2',
    heading: 'What keeps pulling your attention, even when nobody asks you to do it?',
    guidance: [
      'Which problems, topics or communities do you keep returning to?',
      'What would you still spend time on if nobody judged or paid you?',
    ],
  },
  {
    key: 'q3',
    heading:
      'Think about your best moments. What made you feel proud, not because of awards, but because of what you accomplished?',
    guidance: [
      'When were you genuinely proud of your contribution?',
      'What role do you naturally seem to take on?',
    ],
  },
  {
    key: 'q4',
    heading: 'Think about the biggest challenge you’ve faced. How did it change the way you think or act?',
    guidance: ['What happened?', 'What became different about you afterwards?'],
  },
  {
    key: 'q5',
    heading: 'Imagine yourself 10 years from now. What would make you feel that your work truly mattered?',
    guidance: ['Who or what would you want your work to benefit?', 'Why does that matter personally?'],
  },
] as const;

export type PersonalReflectionKey = (typeof PERSONAL_REFLECTION_QUESTIONS)[number]['key'];

export const PERSONAL_REFLECTION_QUESTION_COUNT = PERSONAL_REFLECTION_QUESTIONS.length;

export function personalReflectionQuestion(key: PersonalReflectionKey) {
  const question = PERSONAL_REFLECTION_QUESTIONS.find((q) => q.key === key);
  return question!; // non-null: key type only admits members of the list above
}

/** How full the bar is while answering question `index` (0-based) of 5. */
export function personalReflectionProgress(index: number): number {
  const clamped = Math.min(Math.max(index, 0), PERSONAL_REFLECTION_QUESTION_COUNT);
  return clamped / PERSONAL_REFLECTION_QUESTION_COUNT;
}

const answerText = z.string().trim().max(4000).optional();

export const personalReflectionSchema = z.object({
  q1: answerText,
  q2: answerText,
  q3: answerText,
  q4: answerText,
  q5: answerText,
});

export type PersonalReflectionValues = z.infer<typeof personalReflectionSchema>;

export function personalReflectionAnsweredCount(values: PersonalReflectionValues | undefined): number {
  if (!values) return 0;
  return PERSONAL_REFLECTION_QUESTIONS.filter((q) => Boolean(values[q.key]?.trim())).length;
}

export function personalReflectionComplete(values: PersonalReflectionValues | undefined): boolean {
  return personalReflectionAnsweredCount(values) === PERSONAL_REFLECTION_QUESTION_COUNT;
}
