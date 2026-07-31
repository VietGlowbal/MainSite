/**
 * AI Coach — a per-recommendation chat thread (requirements.md 12).
 *
 * Phase 1 ships types only: no route reads or writes `strategy_coach_*` yet.
 * Ships non-streaming (design.md, Open decision 3) — one JSON-mode reply per
 * turn, not the SSE/streaming pattern used elsewhere in the repo on the
 * competing `feature/cv-essay-ai-workflows-*` branch.
 */

export type CoachRole = 'user' | 'assistant';

export type CoachMessage = {
  id: string;
  threadId: string;
  role: CoachRole;
  content: string;
  createdAt: string;
};

export type CoachThread = {
  id: string;
  recommendationId: string;
  createdAt: string;
  messages: CoachMessage[];
};

/** The four intents requirements.md 12.2 requires the coach to support. */
export const COACH_SEED_INTENTS = [
  'How do I improve this?',
  'Create a study plan.',
  'Find resources.',
  'Review my work.',
] as const;

export type CoachSeedIntent = (typeof COACH_SEED_INTENTS)[number];
