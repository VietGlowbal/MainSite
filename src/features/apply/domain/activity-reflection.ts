import { z } from 'zod';
import type { AchievementCategory, ActivityCategory } from './reflection';

/**
 * Activity-level reflection — Context → Motivation → Challenge → Action →
 * Impact → Transformation → Future, plus the AI-generated Reflection Card
 * built from those answers.
 *
 * ─── FOUR TOP-LEVEL CATEGORIES, NOT SEVEN ────────────────────────────────────
 *
 * The first pass at this feature used seven experience categories (folding
 * Research and Competition/Olympiad in as their own top-level buckets). The
 * approved framework has exactly FOUR — Community Impact, Leadership &
 * Initiative, Innovation & Projects, Academic & Personal Growth — with
 * Research classified under Innovation & Projects and Competition/Olympiad
 * classified under Academic & Personal Growth. `EXPERIENCE_CATEGORIES` is
 * the four the student picks from; `'other'` survives as a fifth, internal-
 * only fallback so legacy rows with `category: 'other'` still resolve to
 * *some* question set — it is never offered as a fifth card.
 *
 * ─── WHY THIS SITS ON TOP OF THE EXISTING TWO TABLES ─────────────────────────
 *
 * The codebase has two tables — `student_achievements` (academic_award /
 * competition / research / certification / other) and `student_activities`
 * (community_project / leadership / innovation / personal_growth /
 * mentoring / other) — each with real cards, extraction, and review-status
 * plumbing already built. Rather than merge them into a third table (or add
 * a subtype column), `experienceCategoryFor` maps both existing category
 * vocabularies onto the four approved categories, and `EXPERIENCE_SUBTYPES`
 * re-derives the "which subtype" picker directly from the SAME stored enum
 * values — every subtype a student can pick already has somewhere to live.
 * The reflection question set is chosen from the top-level category, so
 * "which table this row lives in" never leaks into the reflection copy.
 */

export const EXPERIENCE_CATEGORIES = [
  'community_impact',
  'leadership_initiative',
  'innovation_projects',
  'academic_personal_growth',
] as const;

export type TopLevelExperienceCategory = (typeof EXPERIENCE_CATEGORIES)[number];

/** Legacy escape hatch — never shown as a fifth card, only ever arrived at via an existing `category: 'other'` row. */
export const OTHER_EXPERIENCE_CATEGORY = 'other' as const;

export type ExperienceCategory = TopLevelExperienceCategory | typeof OTHER_EXPERIENCE_CATEGORY;

export const EXPERIENCE_CATEGORY_META: Record<
  TopLevelExperienceCategory,
  { label: string; description: string; icon: string }
> = {
  community_impact: {
    label: 'Community Impact',
    description: 'Volunteering, service, fundraising, social impact',
    icon: 'heart',
  },
  leadership_initiative: {
    label: 'Leadership & Initiative',
    description: 'Clubs, teams, organising, founding and leadership',
    icon: 'usersTwo',
  },
  innovation_projects: {
    label: 'Innovation & Projects',
    description: 'Projects, research, startups and hackathons',
    icon: 'zap',
  },
  academic_personal_growth: {
    label: 'Academic & Personal Growth',
    description: 'Competitions, learning, courses and certifications',
    icon: 'graduationCap',
  },
};

/**
 * `kind`/`category` pair each subtype resolves to — always an EXISTING
 * achievement/activity category value, never a new one. Where a top-level
 * category has only one subtype, the add-experience flow skips the subtype
 * step entirely (see `reflection-evidence-form.tsx`).
 */
export type ExperienceSubtype = {
  kind: 'achievement' | 'activity';
  category: AchievementCategory | ActivityCategory;
  label: string;
};

export const EXPERIENCE_SUBTYPES: Record<TopLevelExperienceCategory, readonly ExperienceSubtype[]> = {
  community_impact: [
    { kind: 'activity', category: 'community_project', label: 'Volunteering & community service' },
  ],
  leadership_initiative: [
    { kind: 'activity', category: 'leadership', label: 'Leadership & initiative' },
    { kind: 'activity', category: 'mentoring', label: 'Advising & tutoring' },
  ],
  innovation_projects: [
    { kind: 'activity', category: 'innovation', label: 'Project, startup or hackathon' },
    { kind: 'achievement', category: 'research', label: 'Research & publications' },
  ],
  academic_personal_growth: [
    { kind: 'achievement', category: 'competition', label: 'Competition & Olympiad' },
    { kind: 'achievement', category: 'academic_award', label: 'Academic award & prize' },
    { kind: 'achievement', category: 'certification', label: 'Certification' },
    { kind: 'activity', category: 'personal_growth', label: 'Independent learning & personal growth' },
  ],
};

const ACHIEVEMENT_TO_EXPERIENCE: Record<AchievementCategory, ExperienceCategory> = {
  academic_award: 'academic_personal_growth',
  // Competition/Olympiad is classified under Academic & Personal Growth —
  // it is NOT its own top-level category in the approved framework.
  competition: 'academic_personal_growth',
  // Research is classified under Innovation & Projects — it is NOT its own
  // top-level category in the approved framework.
  research: 'innovation_projects',
  certification: 'academic_personal_growth',
  other: 'other',
};

const ACTIVITY_TO_EXPERIENCE: Record<ActivityCategory, ExperienceCategory> = {
  community_project: 'community_impact',
  leadership: 'leadership_initiative',
  innovation: 'innovation_projects',
  personal_growth: 'academic_personal_growth',
  // Mentoring/tutoring is guiding and coaching others — closer in kind to
  // leadership than to a personal-growth activity done for oneself.
  mentoring: 'leadership_initiative',
  other: 'other',
};

/**
 * Legacy category value → the four-category framework, preserving every
 * existing stored value. Nothing here changes what is stored — only what
 * question set and top-level card a given row resolves to.
 */
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

export const DIMENSION_LABELS: Record<ReflectionDimension, string> = {
  context: 'Context',
  motivation: 'Motivation',
  challenge: 'Challenge',
  action: 'Action',
  impact: 'Impact',
  transformation: 'Transformation',
  future: 'Future',
};

type DimensionCopy = {
  heading: string;
  /** Level 2 — collapsed by default, behind "Help me think". */
  guidance: readonly string[];
  /** Level 3 — collapsed by default, behind "Need inspiration?". Absent where the approved source gave none — never invented. */
  framework?: string;
};

/**
 * Main question, guiding prompts, and optional answer framework, per
 * (category, dimension) — the exact wording from the approved question
 * bank. Kept as one literal table per category (not composed from smaller
 * per-dimension pieces) because the source is explicit that wording must
 * NOT be silently rewritten or substituted between categories, including
 * cases where two categories happen to share an identical question (e.g.
 * Leadership's and Innovation & Projects' Challenge are the same sentence
 * in the source — preserved verbatim in both rather than "deduplicated").
 *
 * Where the source supplied fewer than two guidance bullets, or no
 * framework at all, that is preserved as-is (an empty/short `guidance`
 * array, an absent `framework`) rather than padded with invented text.
 */
const CATEGORY_QUESTIONS: Record<TopLevelExperienceCategory, Record<ReflectionDimension, DimensionCopy>> = {
  community_impact: {
    context: {
      heading: 'What issue or need did you notice in the community?',
      guidance: ['What was happening at the time?', 'What problem, opportunity, or situation did you encounter?'],
      framework:
        'I noticed that [who] were facing [problem], which led to [consequence]. This caught my attention because [why it stood out].',
    },
    motivation: {
      heading: 'Why did you choose to participate?',
      // The approved source repeats Context's guidance here verbatim — preserved rather than replaced.
      guidance: ['What was happening at the time?', 'What problem, opportunity, or situation did you encounter?'],
      framework:
        'I decided to take action because [personal reason]. I hoped to [goal], even if it was only in a small way.',
    },
    challenge: {
      heading: 'What was the hardest obstacle you encountered?',
      guidance: ["What didn't go as planned?", 'Why was it difficult?'],
      framework:
        'The biggest challenge was [challenge] because [reason]. At first, I [initial response], but I realized [turning point].',
    },
    action: {
      heading: 'How did you respond to that challenge?',
      guidance: ['What was your role?', 'What specific actions did you take?'],
      framework: 'As [role], I [actions], which helped [result].',
    },
    impact: {
      heading: 'What changed because of your contribution?',
      guidance: [
        'Consider tangible impact: numbers, outcomes, deliverables, before/after comparisons, who benefited and how.',
        'Or intangible impact: trust built, mindset shifts, culture/behaviour change.',
      ],
      framework:
        'As a result, [outcome]. One moment that convinced me the project mattered was [story/example].',
    },
    transformation: {
      heading: 'How did this experience change the way you see yourself or your community?',
      guidance: ['What belief changed?', 'What did you learn about yourself?', 'Did you develop any hard, soft or meta skills?'],
    },
    future: {
      heading: 'How will this influence your future direction?',
      guidance: [],
    },
  },
  leadership_initiative: {
    context: {
      heading: 'What responsibility or opportunity did you take on?',
      guidance: ["What was the team's situation?", 'What were you expected to accomplish?'],
      framework:
        'I joined as [role] when [context/situation]. At the time, the team was trying to [goal], and I was responsible for [responsibilities].',
    },
    motivation: {
      heading: 'Why did you choose to participate (and even take the lead)?',
      guidance: ['What motivated you?', 'What change did you want to create?'],
      framework:
        'I stepped into this role because I wanted to [goal/change]. I believed that by [your contribution], I could help the team [desired outcome].',
    },
    challenge: {
      heading: 'What was the toughest leadership decision you had to make?',
      guidance: ['What options did you consider?', 'Why was the decision difficult?'],
      framework:
        'The most difficult decision was [decision] because [reason]. I had to balance [factor A] with [factor B], and ultimately chose to [decision].',
    },
    action: {
      heading: 'How did you lead your team through that situation?',
      guidance: ['What actions did you personally take?', 'How did you communicate or coordinate?'],
      framework: 'I [specific actions], coordinated with [people], and introduced [strategy/solution] to move the project forward.',
    },
    impact: {
      heading: 'How did your leadership influence the team or project?',
      guidance: [
        'Consider: numbers, outcomes, deliverables, before/after changes, who benefited.',
        'Consider: trust, mindset, culture/behaviour change.',
      ],
      framework:
        'As a result, [outcome]. The biggest impact was [result or story], which showed me that [reflection].',
    },
    transformation: {
      heading: 'What kind of leader did this experience help you become?',
      guidance: ['How has your leadership style changed?', 'What did you learn about working with people?', 'What skills did you develop?'],
      framework:
        'Before this experience, I tended to [old mindset]. Now I approach leadership by [new mindset], because I realized [insight].',
    },
    future: {
      heading: 'How will this influence your future direction?',
      guidance: ['How will you apply this lesson?', 'What kind of leader do you hope to become?'],
      framework:
        'Moving forward, I want to [future goal] by applying [lesson or leadership approach] in future teams and projects.',
    },
  },
  innovation_projects: {
    context: {
      heading: 'What problem inspired you to start this project?',
      guidance: ['What gap or opportunity did you notice?', 'Why was this problem worth solving?'],
      framework:
        'I noticed that [problem], which affected [people]. This made me wonder if there was a better way to [desired improvement].',
    },
    motivation: {
      heading: 'Why did you decide to solve this problem yourself?',
      guidance: ['Why was this meaningful?', 'Why did you think your idea could help?'],
      framework:
        'I felt motivated because [personal connection]. Instead of waiting for someone else to solve it, I wanted to [goal].',
    },
    challenge: {
      // Verbatim match with Leadership & Initiative's Challenge — the approved
      // source is explicit this is not a typo to "fix"; do not rewrite it.
      heading: 'What was the toughest leadership decision you had to make?',
      guidance: ['What options did you consider?', 'Why was the decision difficult?'],
      framework:
        'The most difficult decision was [decision] because [reason]. I had to balance [factor A] with [factor B], and ultimately chose to [decision].',
    },
    action: {
      heading: 'How did you develop or improve your solution?',
      guidance: ['What decisions did you make?', 'How did you test your ideas?'],
      framework: 'I [actions], gathered feedback from [users/stakeholders], and refined the solution by [improvements].',
    },
    impact: {
      heading: 'What difference did your solution make?',
      guidance: [
        'Consider: numbers, outcomes, deliverables, before/after comparisons, beneficiaries.',
        'Consider: trust, mindset shifts, culture/behaviour change.',
      ],
      framework:
        'The project resulted in [impact]. The most meaningful feedback came from [person/group], who said [story/example].',
    },
    transformation: {
      heading: 'What did building this project teach you about solving problems?',
      guidance: ['What changed in your thinking?', 'What surprised you most?', 'What hard, soft or meta skills did you develop?'],
      framework:
        'This project taught me that [lesson]. I realized that effective solutions require [insight], rather than simply [old assumption].',
    },
    future: {
      heading: 'How has this project influenced what you want to build or study next?',
      guidance: ['What new interests did it spark?', 'What problems do you want to solve in future?'],
      framework: 'This experience strengthened my interest in [field] and inspired me to continue exploring [future direction].',
    },
  },
  academic_personal_growth: {
    context: {
      heading: 'What challenge or goal were you pursuing?',
      guidance: ['Why did you choose this opportunity?', 'What were you hoping to achieve?'],
      framework:
        'I pursued this opportunity because I wanted to [goal]. At the time, I was hoping to improve [skill/knowledge].',
    },
    motivation: {
      heading: 'Why was this goal important to you?',
      guidance: ['What motivated you?', 'What kept you committed?'],
      framework: 'This goal mattered because [reason]. I believed it would help me [personal or academic objective].',
    },
    challenge: {
      heading: 'What moment tested your perseverance the most?',
      guidance: ['What setback did you face?', 'How did you respond?'],
      framework: 'I struggled with [challenge], which made me question [difficulty]. Instead of giving up, I [response].',
    },
    action: {
      heading: 'What did you do to keep improving?',
      guidance: ['What strategies worked?', 'What changes did you make?'],
      framework: 'I adjusted my approach by [strategy], practiced [actions], and sought feedback from [people/resources].',
    },
    impact: {
      heading: 'What did you achieve, and what does that achievement represent to you?',
      guidance: ['Beyond the award or score, what does it say about your growth?'],
      framework: 'I achieved [result], but more importantly, it showed me that [personal growth or capability].',
    },
    transformation: {
      heading: 'How has this experience changed the way you approach learning or challenges?',
      guidance: ['What mindset changed?', 'How do you approach similar situations now?', 'What skills did you develop?'],
      framework: 'Since then, I have approached challenges by [new approach], because I learned that [insight].',
    },
    future: {
      heading: 'How has this project influenced what you want to build or study next?',
      guidance: ['How does this connect to your future studies?', 'What skills do you want to continue developing?'],
      framework: 'This experience strengthened my interest in [field] and inspired me to continue exploring [future direction].',
    },
  },
};

/** Generic fallback wording for legacy `category: 'other'` rows — never shown as a pickable card. */
const OTHER_QUESTIONS: Record<ReflectionDimension, DimensionCopy> = {
  context: {
    heading: 'What was the situation, and how did you become part of it?',
    guidance: ['What was the situation before you got involved?', 'What made this moment or opportunity worth acting on?'],
  },
  motivation: {
    heading: 'Why did this matter enough to you to get involved?',
    guidance: ['What made this matter to you personally?', 'Was there a moment that made you decide to commit?'],
  },
  challenge: {
    heading: 'What was the hardest part?',
    guidance: ['What options did you consider?', 'Why was it difficult?'],
  },
  action: {
    heading: 'What did you personally do?',
    guidance: ['What did you personally do, step by step?', 'What decisions were yours to make?'],
  },
  impact: {
    heading: 'What changed as a result?',
    guidance: ['What changed as a result — for you, for others, or for the project?', 'How do you know it worked?'],
  },
  transformation: {
    heading: 'How did it change you?',
    guidance: ['What do you understand or do differently now?', 'What surprised you about yourself?'],
  },
  future: {
    heading: 'How does it connect to what you want to do next?',
    guidance: ['How does this connect to what you want to study or do next?', 'What would you carry forward from this experience?'],
  },
};

export function reflectionQuestion(category: ExperienceCategory, dimension: ReflectionDimension): DimensionCopy {
  if (category === OTHER_EXPERIENCE_CATEGORY) return OTHER_QUESTIONS[dimension];
  return CATEGORY_QUESTIONS[category][dimension];
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

/** The dimension a resumed reflection should reopen on — the first unanswered one, or the last if all are done. */
export function firstUnansweredDimension(values: ActivityReflectionValues | undefined): ReflectionDimension {
  const index = REFLECTION_DIMENSIONS.findIndex((dim) => !values?.[dim]?.trim());
  return index === -1 ? REFLECTION_DIMENSIONS[REFLECTION_DIMENSION_COUNT - 1]! : REFLECTION_DIMENSIONS[index]!;
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
