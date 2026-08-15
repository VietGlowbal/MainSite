import { z } from 'zod';
import type { AchievementCategory, ActivityCategory } from './reflection';

/**
 * Activity-level reflection — Context → Motivation → Challenge → Action →
 * Impact → Transformation → Future, plus the AI-generated Reflection Card
 * built from those answers.
 *
 * ─── WHY THIS SITS ON TOP OF THE EXISTING TWO TABLES ─────────────────────────
 *
 * The spec asks for one unified "experiences" concept with seven high-level
 * categories (Community Impact, Leadership & Initiative, Innovation &
 * Projects, Research, Competition / Olympiad, Academic & Personal Growth,
 * Other). The codebase already has two tables — `student_achievements`
 * (academic_award / competition / research / certification / other) and
 * `student_activities` (community_project / leadership / innovation /
 * personal_growth / mentoring / other) — each with real cards, extraction,
 * and review-status plumbing already built. Rather than merge them into a
 * third table, `experienceCategoryFor` maps both existing category
 * vocabularies onto the seven spec categories, and is the ONLY place that
 * mapping is defined. The reflection question set is chosen from its result,
 * so "which table this row lives in" never leaks into the reflection copy.
 */

export const EXPERIENCE_CATEGORIES = [
  'community_impact',
  'leadership_initiative',
  'innovation_projects',
  'research',
  'competition_olympiad',
  'academic_growth',
  'other',
] as const;

export type ExperienceCategory = (typeof EXPERIENCE_CATEGORIES)[number];

const ACHIEVEMENT_TO_EXPERIENCE: Record<AchievementCategory, ExperienceCategory> = {
  academic_award: 'academic_growth',
  competition: 'competition_olympiad',
  research: 'research',
  certification: 'academic_growth',
  other: 'other',
};

const ACTIVITY_TO_EXPERIENCE: Record<ActivityCategory, ExperienceCategory> = {
  community_project: 'community_impact',
  leadership: 'leadership_initiative',
  innovation: 'innovation_projects',
  personal_growth: 'academic_growth',
  // Mentoring/tutoring is guiding and coaching others — closer in kind to
  // leadership than to a personal-growth activity done for oneself.
  mentoring: 'leadership_initiative',
  other: 'other',
};

export function experienceCategoryFor(
  kind: 'achievement',
  category: AchievementCategory,
): ExperienceCategory;
export function experienceCategoryFor(
  kind: 'activity',
  category: ActivityCategory,
): ExperienceCategory;
export function experienceCategoryFor(
  kind: 'achievement' | 'activity',
  category: string,
): ExperienceCategory {
  if (kind === 'achievement') {
    return ACHIEVEMENT_TO_EXPERIENCE[category as AchievementCategory] ?? 'other';
  }
  return ACTIVITY_TO_EXPERIENCE[category as ActivityCategory] ?? 'other';
}

/* ─────────────────────────────────────────────────────────────────────────
   The seven reflection dimensions
   ───────────────────────────────────────────────────────────────────────── */

export const REFLECTION_DIMENSIONS = [
  'context',
  'motivation',
  'challenge',
  'action',
  'impact',
  'transformation',
  'future',
] as const;

export type ReflectionDimension = (typeof REFLECTION_DIMENSIONS)[number];

export const REFLECTION_DIMENSION_COUNT = REFLECTION_DIMENSIONS.length;

type DimensionCopy = {
  heading: string;
  guidance: readonly [string, string];
};

/**
 * Main question per (category, dimension) — the part of the spec explicit
 * about needing to change wording, not just labels, per activity type.
 * Guiding prompts are per-dimension rather than per-category-and-dimension:
 * the two given in the spec's own worked example ("What options did you
 * consider? Why was the decision difficult?") are generic enough to sit
 * under any category's Challenge heading, and writing forty-nine distinct
 * guidance pairs would mostly restate the same two questions with different
 * nouns.
 */
const DIMENSION_GUIDANCE: Record<ReflectionDimension, readonly [string, string]> = {
  context: [
    'What was the situation before you got involved?',
    'What made this moment or opportunity worth acting on?',
  ],
  motivation: [
    'What made this matter to you personally?',
    'Was there a moment that made you decide to commit?',
  ],
  challenge: [
    'What options did you consider?',
    'Why was it difficult?',
  ],
  action: [
    'What did you personally do, step by step?',
    'What decisions were yours to make?',
  ],
  impact: [
    'What changed as a result — for you, for others, or for the project?',
    'How do you know it worked?',
  ],
  transformation: [
    'What do you understand or do differently now?',
    'What surprised you about yourself?',
  ],
  future: [
    'How does this connect to what you want to study or do next?',
    'What would you carry forward from this experience?',
  ],
};

const HEADINGS: Record<ExperienceCategory, Record<ReflectionDimension, string>> = {
  community_impact: {
    context: 'What issue or need did you notice?',
    motivation: 'Why did you choose to get involved?',
    challenge: 'What was the hardest obstacle?',
    action: 'What did you personally do?',
    impact: 'What changed because of your contribution?',
    transformation: 'How did the experience change you?',
    future: 'How will it influence what you do next?',
  },
  leadership_initiative: {
    context: 'What responsibility or opportunity did you take on?',
    motivation: 'Why did you decide to step up or lead?',
    challenge: 'What was the toughest leadership decision you faced?',
    action: 'How did you lead the team through it?',
    impact: 'How did your leadership affect the team or project?',
    transformation: 'What kind of leader did this experience help you become?',
    future: 'How will this influence the way you lead in future?',
  },
  innovation_projects: {
    context: 'What problem inspired you to start this project?',
    motivation: 'Why did you want to solve it?',
    challenge: 'What was the hardest part of making the idea work?',
    action: 'How did you develop, test or improve your solution?',
    impact: 'What difference did the solution make?',
    transformation: 'What did building it teach you about solving problems?',
    future: 'What has it made you want to build or study next?',
  },
  research: {
    context: 'What question or gap did you set out to investigate?',
    motivation: 'Why was this question worth pursuing to you?',
    challenge: 'Where did the evidence or method get hardest to pin down?',
    action: 'How did you gather, test, or analyse what you needed?',
    impact: 'What did you find, and what does it explain?',
    transformation: 'How did it change the way you evaluate a claim or a problem?',
    future: 'How does it shape what you want to study or research next?',
  },
  competition_olympiad: {
    context: 'What challenge or goal were you pursuing?',
    motivation: 'Why was the goal important to you?',
    challenge: 'What moment tested your perseverance the most?',
    action: 'What did you change or do to improve?',
    impact: 'What did you achieve, and what did it represent?',
    transformation: 'How did it change the way you approach learning or challenges?',
    future: 'How does it connect to what you want to study or develop next?',
  },
  academic_growth: {
    context: 'What challenge or goal were you pursuing?',
    motivation: 'Why was the goal important to you?',
    challenge: 'What moment tested your perseverance the most?',
    action: 'What did you change or do to improve?',
    impact: 'What did you achieve, and what did it represent?',
    transformation: 'How did it change the way you approach learning or challenges?',
    future: 'How does it connect to what you want to study or develop next?',
  },
  other: {
    context: 'What was the situation, and how did you become part of it?',
    motivation: 'Why did this matter enough to you to get involved?',
    challenge: 'What was the hardest part?',
    action: 'What did you personally do?',
    impact: 'What changed as a result?',
    transformation: 'How did it change you?',
    future: 'How does it connect to what you want to do next?',
  },
};

export function reflectionQuestion(
  category: ExperienceCategory,
  dimension: ReflectionDimension,
): DimensionCopy {
  return {
    heading: HEADINGS[category][dimension],
    guidance: DIMENSION_GUIDANCE[dimension],
  };
}

/**
 * "Need inspiration?" scaffolding — shown only when the student asks for it
 * (never by default, per spec), and never used to pre-fill the answer box.
 * One structure per dimension rather than per category: the shape of a good
 * answer ("what/why/how it was hard") is the same regardless of activity
 * type, only the heading above it changes.
 */
const DIMENSION_INSPIRATION: Record<ReflectionDimension, string> = {
  context:
    'One way to structure your answer: "Before I got involved, [situation]. I noticed / was asked to help with [opportunity] because [reason]."',
  motivation:
    'One way to structure your answer: "This mattered to me because [personal reason]. I decided to commit when [moment/realisation]."',
  challenge:
    'One way to structure your answer: "The hardest part was [difficulty] because [reason]. I considered [option A] and [option B]."',
  action:
    'One way to structure your answer: "I personally [specific action], which involved [step 1], [step 2] and [step 3]."',
  impact:
    'One way to structure your answer: "As a result, [what changed] for [who/what]. I know this because [evidence, even if it\'s a comment or reaction rather than a number]."',
  transformation:
    'One way to structure your answer: "I used to [old way of thinking/doing]. Now I [new understanding or behaviour], which surprised me because [reason]."',
  future:
    'One way to structure your answer: "This connects to what I want to study/do next because [reason]. I want to carry [specific lesson] forward."',
};

export function reflectionInspiration(dimension: ReflectionDimension): string {
  return DIMENSION_INSPIRATION[dimension];
}

/** How full the bar is while answering dimension `index` (0-based) of 7. */
export function activityReflectionProgress(index: number): number {
  const clamped = Math.min(Math.max(index, 0), REFLECTION_DIMENSION_COUNT);
  return clamped / REFLECTION_DIMENSION_COUNT;
}

/* ─────────────────────────────────────────────────────────────────────────
   Schemas
   ───────────────────────────────────────────────────────────────────────── */

const reflectionText = z.string().trim().max(4000).optional();

/** Raw, in-the-student's-own-words answers to the seven dimensions. */
export const activityReflectionSchema = z.object({
  context: reflectionText,
  motivation: reflectionText,
  challenge: reflectionText,
  action: reflectionText,
  impact: reflectionText,
  transformation: reflectionText,
  future: reflectionText,
  /** ISO timestamp of the last save, so "exit and resume" has something to show. */
  updatedAt: z.string().optional(),
});

export type ActivityReflectionValues = z.infer<typeof activityReflectionSchema>;

export function activityReflectionAnsweredCount(values: ActivityReflectionValues | undefined): number {
  if (!values) return 0;
  return REFLECTION_DIMENSIONS.filter((dim) => Boolean(values[dim]?.trim())).length;
}

/** One evidence-linked skill — never asserted without the behaviour that shows it. */
export const reflectionCardSkillSchema = z.object({
  skill: z.string().trim().min(1).max(80),
  /** "Why GlowBal identified this" — traced back to what the student wrote. */
  evidence: z.string().trim().max(500).optional(),
});

export const REFLECTION_CARD_STATUSES = ['generated', 'confirmed', 'edited'] as const;
export type ReflectionCardStatus = (typeof REFLECTION_CARD_STATUSES)[number];

export const reflectionCardSchema = z.object({
  story: z.string().trim().max(2000).optional(),
  contributions: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
  evidence: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
  demonstratedSkills: z.array(reflectionCardSkillSchema).max(6).default([]),
  keyTakeaway: z.string().trim().max(1000).optional(),
  futureConnection: z.string().trim().max(1000).optional(),
  status: z.enum(REFLECTION_CARD_STATUSES).default('generated'),
});

export type ReflectionCardValues = z.infer<typeof reflectionCardSchema>;

/** A Reflection Card with nothing generated yet renders no meaningful content. */
export function isReflectionCardEmpty(card: ReflectionCardValues | undefined): boolean {
  if (!card) return true;
  return (
    !card.story &&
    card.contributions.length === 0 &&
    card.evidence.length === 0 &&
    card.demonstratedSkills.length === 0 &&
    !card.keyTakeaway &&
    !card.futureConnection
  );
}
