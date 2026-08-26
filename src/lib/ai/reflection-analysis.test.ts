import { describe, expect, it } from 'vitest';
import {
  REFLECTION_ANSWER_DIMENSIONS,
  analyzeReflectionAnswers,
  deriveReflectionSignals,
} from './reflection-analysis';

describe('reflection answer dimension mapping', () => {
  const ANSWERS = {
    q1: 'I am drawn to building practical tools for my community.',
    q2: 'Growing as a patient organiser taught me to value reliability.',
    q3: 'I care about unequal access to education technology.',
    q4: 'I owned the entire rollout of our school tutoring platform.',
    q5: 'I want a computer science degree focused on human-computer interaction.',
    q6: 'In ten years I want to lead product teams in edtech.',
    q7: 'I prefer a campus with tight-knit residential colleges.',
  };

  it('maps each question onto its planned Identity/Direction dimension', () => {
    const signals = deriveReflectionSignals(ANSWERS);
    const byKey = Object.fromEntries(signals.map((signal) => [signal.key, signal.dimension]));
    expect(byKey).toEqual({
      q1: 'interests_motivations',
      q2: 'values_growth',
      q3: 'problem_domains',
      q4: 'capability_ownership',
      q5: 'academic_direction',
      q6: 'career_direction',
      q7: 'environment_preference',
    });
  });

  it('exposes the canonical dimension table for consumers', () => {
    expect(Object.keys(REFLECTION_ANSWER_DIMENSIONS)).toEqual([
      'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7',
    ]);
  });

  it('marks an answer with no corroborating source as isolated and one backed by activity text as repeated', () => {
    const isolated = analyzeReflectionAnswers(
      { q3: ANSWERS.q3 },
      ['Totally unrelated free text about football.'],
    );
    expect(isolated.signals[0]?.status).toBe('isolated');

    const repeated = analyzeReflectionAnswers(
      { q3: ANSWERS.q3 },
      [
        'She kept raising the problem of unequal access to education technology at every meeting.',
        'Second mention of unequal access to education technology elsewhere too.',
      ],
    );
    expect(repeated.signals[0]?.status).toBe('repeated');
  });

  it('groups signals into identity and direction bundles', () => {
    const analysis = analyzeReflectionAnswers(ANSWERS);
    expect(analysis.identitySignals?.interestsMotivations).toEqual([ANSWERS.q1]);
    expect(analysis.identitySignals?.capabilityOwnership).toEqual([ANSWERS.q4]);
    expect(analysis.directionSignals?.academicDirection).toBe(ANSWERS.q5);
    expect(analysis.directionSignals?.careerDirection).toBe(ANSWERS.q6);
    expect(analysis.directionSignals?.preferredEnvironment).toBe(ANSWERS.q7);
  });

  it('drops empty answers entirely', () => {
    expect(deriveReflectionSignals({ q1: '', q2: '   ', q3: undefined })).toEqual([]);
    expect(analyzeReflectionAnswers(null).signals).toEqual([]);
  });
});
