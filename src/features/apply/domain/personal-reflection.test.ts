import { describe, expect, it } from 'vitest';
import {
  PERSONAL_REFLECTION_QUESTIONS,
  PERSONAL_REFLECTION_QUESTION_COUNT,
  personalReflectionAnsweredCount,
  personalReflectionComplete,
  personalReflectionProgress,
  personalReflectionQuestion,
} from './personal-reflection';

describe('PERSONAL_REFLECTION_QUESTIONS', () => {
  it('has exactly five fixed questions, each with two guidance prompts', () => {
    expect(PERSONAL_REFLECTION_QUESTIONS).toHaveLength(5);
    expect(PERSONAL_REFLECTION_QUESTION_COUNT).toBe(5);
    for (const question of PERSONAL_REFLECTION_QUESTIONS) {
      expect(question.heading.length).toBeGreaterThan(0);
      expect(question.guidance).toHaveLength(2);
    }
  });

  it('personalReflectionQuestion resolves every key', () => {
    for (const question of PERSONAL_REFLECTION_QUESTIONS) {
      expect(personalReflectionQuestion(question.key)).toBe(question);
    }
  });
});

describe('personalReflectionProgress', () => {
  it('goes from empty to full across the five questions', () => {
    expect(personalReflectionProgress(0)).toBe(0);
    expect(personalReflectionProgress(5)).toBe(1);
    expect(personalReflectionProgress(-1)).toBe(0);
    expect(personalReflectionProgress(50)).toBe(1);
  });
});

describe('personalReflectionAnsweredCount / personalReflectionComplete', () => {
  it('counts only non-blank answers', () => {
    expect(personalReflectionAnsweredCount(undefined)).toBe(0);
    expect(personalReflectionAnsweredCount({})).toBe(0);
    expect(personalReflectionAnsweredCount({ q1: 'answer', q2: '   ' })).toBe(1);
  });

  it('is complete only once all five are answered', () => {
    expect(personalReflectionComplete({ q1: 'a', q2: 'b', q3: 'c', q4: 'd' })).toBe(false);
    expect(
      personalReflectionComplete({ q1: 'a', q2: 'b', q3: 'c', q4: 'd', q5: 'e' }),
    ).toBe(true);
  });
});
