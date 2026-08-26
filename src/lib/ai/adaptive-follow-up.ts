import { generateStructured, StructuredGenerationError } from './runtime/structured-generation';
import { z } from 'zod';

/**
 * Adaptive Follow-up question engine for ONE activity (Task 6).
 *
 * Deterministic priority — the dimension with the weakest evidence is asked
 * first:
 *   action > ownership > impact > transformation > challenge > motivation >
 *   context
 *
 * Hard limits (enforced here, not left to prompts):
 * - exactly ONE question per response;
 * - at most 2 attempts per dimension per activity;
 * - at most 6 questions per activity in total.
 *
 * AI only PHRASES the chosen question; when phrasing fails the deterministic
 * template ships instead. Stale questions (superseded by a newer ask) are
 * rejected as answer targets so an old tab cannot write into history.
 */

export const FOLLOW_UP_DIMENSION_PRIORITY = [
  'action',
  'ownership',
  'impact',
  'transformation',
  'challenge',
  'motivation',
  'context',
] as const;

export type FollowUpDimension = (typeof FOLLOW_UP_DIMENSION_PRIORITY)[number];

export const MAX_ATTEMPTS_PER_DIMENSION = 2;
export const MAX_QUESTIONS_PER_ACTIVITY = 6;

export type AskedQuestion = {
  id: string;
  dimension: FollowUpDimension;
  text: string;
  askedAt: string;
};

export type ExistingAnswer = {
  questionId: string;
  dimension: FollowUpDimension;
  round: number;
  answer: string;
  /** Set when a later round for the same dimension supersedes this one. */
  supersededBy?: string | null;
};

const TEMPLATE_QUESTIONS: Record<FollowUpDimension, string> = {
  action: 'What did you personally do, step by step, in this experience?',
  ownership: 'Which parts were your responsibility alone, and how did you take charge of them?',
  impact: 'What changed because of what you did — for people or for the situation?',
  transformation: 'How did this experience change the way you work or see things?',
  challenge: 'What was the hardest obstacle here, and how did you get through it?',
  motivation: 'Why did you choose to spend your time on this?',
  context: 'Where and when did this take place, and who else was involved?',
};

export type AIPhraser = (args: {
  dimension: FollowUpDimension;
  activityFreeText: string;
}) => Promise<string>;

/** Default phraser: one small structured call; any failure falls back. */
export const aiPhraser: AIPhraser = async ({ dimension, activityFreeText }) => {
  const phraseSchema = z.object({ question: z.string().min(12).max(240) });
  try {
    const result = await generateStructured({
      moduleId: 'activity_follow_up_phrase',
      promptVersion: 'follow-up-v1',
      schemaVersion: 'fu-v1',
      schema: phraseSchema,
      systemPrompt:
        'You write ONE short follow-up interview question about a student activity, asking for more detail on a given dimension. Never invent facts; ask, do not assume.',
      userPrompt: `Activity text: ${activityFreeText.slice(0, 1500)}\nDimension to ask about: ${dimension}`,
      temperature: 0.3,
      maxTokens: 200,
    });
    return result.data.question;
  } catch (error) {
    if (error instanceof StructuredGenerationError) {
      // Caller's template fallback handles it.
      throw new Error(`phrasing failed (${error.kind})`);
    }
    throw error;
  }
};

function attemptsByDimension(args: { existingAnswers: readonly ExistingAnswer[] }): Map<FollowUpDimension, number> {
  const counts = new Map<FollowUpDimension, number>();
  for (const answer of args.existingAnswers) {
    counts.set(answer.dimension, (counts.get(answer.dimension) ?? 0) + 1);
  }
  return counts;
}

export async function nextFollowUpQuestion(args: {
  activityFreeText: string;
  existingAnswers: readonly ExistingAnswer[];
  askedQuestions: readonly AskedQuestion[];
  /**
   * Explicit retry target — the ONLY way the same dimension is asked twice
   * (e.g. the student tapped "ask me differently"). Default flow walks the
   * priority ladder across untouched dimensions first.
   */
  preferDimension?: FollowUpDimension;
  phraser?: AIPhraser;
}): Promise<
  | { ok: true; question: AskedQuestion & { round: number; phrasing: 'ai' | 'template' } }
  | { ok: false; reason: 'activity_limit_reached' | 'all_dimensions_exhausted' }
> {
  if (args.askedQuestions.length >= MAX_QUESTIONS_PER_ACTIVITY) {
    return { ok: false, reason: 'activity_limit_reached' };
  }

  const attempts = attemptsByDimension(args);

  let chosen: FollowUpDimension | null = null;
  // 1. Explicit retry request (still respects the per-dimension cap).
  if (
    args.preferDimension &&
    (attempts.get(args.preferDimension) ?? 0) < MAX_ATTEMPTS_PER_DIMENSION
  ) {
    chosen = args.preferDimension;
  }
  // 2. Strict priority walk over untouched dimensions.
  if (!chosen) {
    chosen =
      FOLLOW_UP_DIMENSION_PRIORITY.find(
        (dimension) => (attempts.get(dimension) ?? 0) === 0,
      ) ?? null;
  }
  // 3. Only when every dimension has been touched, permit second attempts.
  if (!chosen) {
    chosen =
      FOLLOW_UP_DIMENSION_PRIORITY.find(
        (dimension) => (attempts.get(dimension) ?? 0) < MAX_ATTEMPTS_PER_DIMENSION,
      ) ?? null;
  }

  if (!chosen) return { ok: false, reason: 'all_dimensions_exhausted' };

  let text = TEMPLATE_QUESTIONS[chosen];
  let phrasing: 'ai' | 'template' = 'template';
  try {
    const phraser = args.phraser ?? aiPhraser;
    const phrased = await phraser({ dimension: chosen, activityFreeText: args.activityFreeText });
    if (phrased && phrased.trim().length >= 12) {
      text = phrased.trim();
      phrasing = 'ai';
    }
  } catch {
    // Deterministic template fallback ships instead of failing the ask.
  }

  return {
    ok: true,
    question: {
      id: `fq:${chosen}:${args.askedQuestions.length + 1}:${Date.now()}`,
      dimension: chosen,
      text,
      askedAt: new Date().toISOString(),
      round: (attempts.get(chosen) ?? 0) + 1,
      phrasing,
    },
  };
}

/** Stale-question guard: only a question from the LATEST ask batch is answerable. */
export const recordFollowUpAnswer = {
  validateTarget(args: { target: AskedQuestion; latestAsked: readonly AskedQuestion[] }): boolean {
    return args.latestAsked.some((question) => question.id === args.target.id);
  },

  /**
   * Append-only answer recording: a later round for the same dimension marks
   * the previous answer's `supersededBy` but never removes it.
   */
  append(existing: readonly ExistingAnswer[], incoming: ExistingAnswer): ExistingAnswer[] {
    const priorForDimension = existing.filter((entry) => entry.dimension === incoming.dimension);
    const supersededIds = new Set(priorForDimension.map((entry) => entry.questionId));
    return [
      ...existing.map((entry) =>
        supersededIds.has(entry.questionId) ? { ...entry, supersededBy: incoming.questionId } : entry,
      ),
      { ...incoming, supersededBy: null },
    ];
  },
};
