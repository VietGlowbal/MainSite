import { z } from 'zod';

/**
 * Personal Reflection — seven fixed, cross-cutting questions asked once per
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
    shortLabel: 'What You Enjoy Exploring',
    heading: 'What topics, activities, or problems do you genuinely enjoy exploring? Why do you find them interesting?',
    guidance: [
      'Think about what you enjoy learning, discussing, researching, or doing even without being asked.',
      'Mention what specifically interests you and why.',
    ],
    sampleAnswer: 'I often find myself reading about how technology can improve education. I like thinking about why some students struggle with traditional learning and how technology could make learning more personalised.',
  },
  {
    key: 'q2',
    shortLabel: 'A Perspective-Changing Experience',
    heading: 'What is one experience that has changed the way you think or see yourself? What happened, and how did it change you?',
    guidance: [
      'This could be a challenge, a project, a volunteer experience, a competition, or even a personal moment.',
      'Briefly explain what happened, what you realised, and how it changed your mindset, values, or actions.',
    ],
    sampleAnswer: 'Volunteering at an English class for visually impaired students changed how I viewed accessibility. I realised that many difficulties came not from the students’ abilities, but from how the learning environment was designed.',
  },
  {
    key: 'q3',
    shortLabel: 'A Problem You Care About',
    heading: 'What is one problem in your school, community, or society that you genuinely care about? Who is affected, and why does this problem matter to you?',
    guidance: [
      'Name one specific problem, who is affected, and why you personally care about it.',
      'It can come from your school, community, industry, or personal experience.',
    ],
    sampleAnswer: 'I care about the lack of career guidance for high school students in smaller cities. Many students have limited exposure to different careers, so they often choose majors based on what their families or friends recommend.',
  },
  {
    key: 'q4',
    shortLabel: 'What You Are Proud Of',
    heading: 'What is something you have built, improved, solved, or helped others achieve that you are genuinely proud of? What did you personally do?',
    guidance: [
      'Choose something where you made a meaningful contribution.',
      'Explain what you did, the challenge you faced, and what changed because of your work. Add numbers if possible.',
    ],
    sampleAnswer: 'I am most proud of a financial literacy workshop I organised for middle school students. I redesigned the activities into an investment simulation and led a five-person team to deliver the programme to over 100 students.',
  },
  {
    key: 'q5',
    shortLabel: 'Why This Major',
    heading: 'Why did you choose your intended major?',
    guidance: [
      'Describe the experience, interest, or problem that led you to this field.',
      'Explain what you hope to learn and how those skills could help solve problems you care about.',
    ],
    sampleAnswer: 'I want to use technology and business to make quality education more accessible to students with disabilities, especially by developing learning products that allow them to study more independently.',
  },
  {
    key: 'q6',
    shortLabel: 'Future Change',
    heading: 'What problem or change do you hope to work on in the future?',
    guidance: [
      'Start with one problem or group of people you care about; you do not need a specific career title yet.',
      'Imagine what you would like to change, the kind of solution you might create, and who would benefit.',
    ],
    sampleAnswer: 'I want to make quality learning more accessible to students with disabilities. I hope to develop technology-enabled learning products that adapt to different needs rather than expecting every learner to use the same system.',
  },
  {
    key: 'q7',
    shortLabel: 'Ideal University Environment',
    heading: 'What kind of university environment would help you become the person you want to be?',
    guidance: [
      'Consider how you learn best, who you want to learn with, and what you want to experience outside the classroom.',
      'You might include projects, research, entrepreneurship, competitions, mentorship, or community work.',
    ],
    sampleAnswer: 'I want an environment where I can learn through real projects rather than lectures alone. I would like to work with students from different disciplines, receive mentorship, and have opportunities to test ideas through entrepreneurship and community initiatives.',
  },
] as const;

export type PersonalReflectionKey = (typeof PERSONAL_REFLECTION_QUESTIONS)[number]['key'];

export const PERSONAL_REFLECTION_QUESTION_COUNT = PERSONAL_REFLECTION_QUESTIONS.length;

export function personalReflectionQuestion(key: PersonalReflectionKey) {
  const question = PERSONAL_REFLECTION_QUESTIONS.find((q) => q.key === key);
  return question!; // non-null: key type only admits members of the list above
}

/** How full the bar is while answering question `index` (0-based) of 7. */
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
  q6: answerText,
  q7: answerText,
});

export type PersonalReflectionValues = z.infer<typeof personalReflectionSchema>;

export function personalReflectionAnsweredCount(values: PersonalReflectionValues | undefined): number {
  if (!values) return 0;
  return PERSONAL_REFLECTION_QUESTIONS.filter((q) => Boolean(values[q.key]?.trim())).length;
}

export function personalReflectionComplete(values: PersonalReflectionValues | undefined): boolean {
  return personalReflectionAnsweredCount(values) === PERSONAL_REFLECTION_QUESTION_COUNT;
}
