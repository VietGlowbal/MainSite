import { describe, expect, it, vi } from 'vitest';
import {
  FOLLOW_UP_DIMENSION_PRIORITY,
  MAX_ATTEMPTS_PER_DIMENSION,
  MAX_QUESTIONS_PER_ACTIVITY,
  nextFollowUpQuestion,
  recordFollowUpAnswer,
  type AskedQuestion,
  type ExistingAnswer,
} from './adaptive-follow-up';

const FREE_TEXT =
  'I founded a robotics club, led twelve members, and our team reached the national finals after months of preparation.';

describe('follow-up dimension priority', () => {
  it('orders dimensions action > ownership > impact > transformation > challenge > motivation > context', () => {
    expect(FOLLOW_UP_DIMENSION_PRIORITY).toEqual([
      'action',
      'ownership',
      'impact',
      'transformation',
      'challenge',
      'motivation',
      'context',
    ]);
  });

  it('asks the highest-priority open dimension first', async () => {
    const result = await nextFollowUpQuestion({
      activityFreeText: FREE_TEXT,
      existingAnswers: [],
      askedQuestions: [],
    });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.question.dimension).toBe('action');
      expect(result.question.text).toMatch(/\?$/);
    }
  });

  it('asks exactly ONE question per response', async () => {
    const result = await nextFollowUpQuestion({
      activityFreeText: FREE_TEXT,
      existingAnswers: [],
      askedQuestions: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question).toBeDefined();
      expect(Array.isArray((result as unknown as { questions?: unknown[] }).questions)).toBe(false);
    }
  });

  it('moves down the priority ladder as answers arrive', async () => {
    let asked: AskedQuestion[] = [];
    const answers: ExistingAnswer[] = [];

    for (let index = 0; index < 3; index += 1) {
      const result = await nextFollowUpQuestion({
        activityFreeText: FREE_TEXT,
        existingAnswers: answers,
        askedQuestions: asked,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      answers.push({
        questionId: result.question.id,
        dimension: result.question.dimension,
        round: 1,
        answer: `Answer ${index + 1}`,
      });
      asked = [...asked, result.question];
    }

    // First three answered → the next one is the FOURTH priority dimension.
    const fourth = await nextFollowUpQuestion({
      activityFreeText: FREE_TEXT,
      existingAnswers: answers,
      askedQuestions: asked,
    });
    expect(fourth.ok).toBe(true);
    if (fourth.ok) {
      expect(fourth.question.dimension).toBe(FOLLOW_UP_DIMENSION_PRIORITY[3]);
    }
  });

  it('allows at most two attempts per dimension before moving on', async () => {
    const answers: ExistingAnswer[] = [];
    const asked: AskedQuestion[] = [];
    // Round 1 of action
    const first = await nextFollowUpQuestion({ activityFreeText: FREE_TEXT, existingAnswers: [], askedQuestions: [] });
    if (!first.ok) throw new Error('expected a question');
    expect(first.question.dimension).toBe('action');
    answers.push({ questionId: first.question.id, dimension: 'action', round: 1, answer: 'vague' });
    asked.push(first.question);

    // Round 2 of action is allowed ONLY as an explicit retry request.
    const second = await nextFollowUpQuestion({
      activityFreeText: FREE_TEXT,
      existingAnswers: answers,
      askedQuestions: asked,
      preferDimension: 'action',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.question.dimension).toBe('action');
    answers.push({ questionId: second.question.id, dimension: 'action', round: 2, answer: 'still vague' });
    asked.push(second.question);

    // A third attempt on action must be refused — default flow moves on.
    const third = await nextFollowUpQuestion({
      activityFreeText: FREE_TEXT,
      existingAnswers: answers,
      askedQuestions: asked,
      preferDimension: 'action',
    });
    expect(third.ok).toBe(true);
    if (third.ok) {
      expect(third.question.dimension).not.toBe('action');
    }
    // And the default (no preference) flow was never on action after round 1.
    const fourth = await nextFollowUpQuestion({
      activityFreeText: FREE_TEXT,
      existingAnswers: [answers[0]],
      askedQuestions: [asked[0]],
    });
    if (fourth.ok) {
      expect(fourth.question.dimension).toBe('ownership');
    }
  });

  it('caps follow-ups at six per activity then reports completion', async () => {
    let asked: AskedQuestion[] = [];
    const answers: ExistingAnswer[] = [];
    for (let index = 0; index < MAX_QUESTIONS_PER_ACTIVITY; index += 1) {
      const result = await nextFollowUpQuestion({
        activityFreeText: FREE_TEXT,
        existingAnswers: answers,
        askedQuestions: asked,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      answers.push({
        questionId: result.question.id,
        dimension: result.question.dimension,
        round: 1,
        answer: `answer ${index}`,
      });
      asked = [...asked, result.question];
    }
    expect(asked).toHaveLength(MAX_QUESTIONS_PER_ACTIVITY);

    const exhausted = await nextFollowUpQuestion({
      activityFreeText: FREE_TEXT,
      existingAnswers: answers,
      askedQuestions: asked,
    });
    expect(exhausted).toEqual({ ok: false, reason: 'activity_limit_reached' });
  });

  it('rejects stale questions (already superseded or from an older ask batch)', () => {
    const stale: AskedQuestion = {
      id: 'q-stale',
      dimension: 'impact',
      text: 'What changed?',
      askedAt: '2026-08-01T00:00:00Z',
    };
    const newer: AskedQuestion = { ...stale, id: 'q-newer', askedAt: '2026-08-02T00:00:00Z' };
    expect(recordFollowUpAnswer.validateTarget({ target: stale, latestAsked: [newer] })).toBe(false);
    expect(recordFollowUpAnswer.validateTarget({ target: newer, latestAsked: [newer] })).toBe(true);
  });

  it('supersedes the prior answer when a later round lands for the same dimension', () => {
    const previous: ExistingAnswer[] = [
      { questionId: 'q1', dimension: 'action', round: 1, answer: 'first attempt' },
    ];
    const updated = recordFollowUpAnswer.append(previous, {
      questionId: 'q2',
      dimension: 'action',
      round: 2,
      answer: 'better attempt',
    });

    expect(updated.find((entry) => entry.round === 1)?.supersededBy).toBe('q2');
    expect(updated.at(-1)).toMatchObject({ questionId: 'q2', round: 2, supersededBy: null });
    // History stays — append-only.
    expect(updated).toHaveLength(2);
  });

  it('falls back to a deterministic template when AI phrasing fails', async () => {
    const failingPhraser = vi.fn(async () => {
      throw new Error('model down');
    });
    const result = await nextFollowUpQuestion({
      activityFreeText: FREE_TEXT,
      existingAnswers: [],
      askedQuestions: [],
      phraser: failingPhraser,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question.text.length).toBeGreaterThan(8);
      expect(result.question.phrasing).toBe('template');
    }
    expect(failingPhraser).toHaveBeenCalled();
  });
});
