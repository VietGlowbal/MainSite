import { describe, expect, it } from 'vitest';
import type { NarrativeActivity } from './f4-narrative-identity';
import { assessMotivationConsistencyWithProfile } from './profile-motivation';

function activity(id: string, motivation: string | null): NarrativeActivity {
  return {
    id,
    title: id,
    role: 'builder',
    behaviour: 'built a practical solution',
    domainTheme: 'education access',
    statedMotivation: motivation,
    outcome: 'Students gained clearer access to information.',
    evidenceRefs: [{ id, kind: 'activity', label: id }],
  };
}

describe('assessMotivationConsistencyWithProfile', () => {
  it('treats an explicit Reflection motivation as a direct observation', () => {
    const result = assessMotivationConsistencyWithProfile(
      [activity('a', null), activity('b', null)],
      [{ id: 'profile:study_motivation', label: 'Study motivation', value: 'I want to improve access to education.' }],
    );

    expect(result.kind).toBe('observation');
    expect(result.motivationStatus).toBe('emerging');
    expect(result.statedMotivation).toBe('I want to improve access to education.');
    expect(result.personallyGrounded).toBe(true);
  });

  it('only establishes recurrence when mature activity evidence aligns with the stated motivation', () => {
    const result = assessMotivationConsistencyWithProfile(
      [
        activity('a', 'I wanted students to have better access to education.'),
        activity('b', 'I wanted to improve education access for younger students.'),
        activity('c', null),
      ],
      [{ id: 'profile:study_motivation', label: 'Study motivation', value: 'I want to improve access to education.' }],
    );

    expect(result.motivationStatus).toBe('established');
    expect(result.actionAligned).toBe(true);
    expect(result.recurrenceCount).toBeGreaterThanOrEqual(2);
  });
});
