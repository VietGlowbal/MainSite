import { describe, expect, it } from 'vitest';
import type { NarrativeActivity } from './f4-narrative-identity';
import { scoreNarrativeBaseFaithful } from './f4-quality';

function activity(id: string, behaviour: string, theme: string): NarrativeActivity {
  return {
    id,
    title: id,
    role: 'organiser',
    behaviour,
    domainTheme: theme,
    statedMotivation: null,
    outcome: 'A result was recorded.',
    evidenceRefs: [{ id, kind: 'activity', label: id }],
  };
}

describe('scoreNarrativeBaseFaithful', () => {
  it('does not call unrelated behaviours a consistent pattern merely because the fields are populated', () => {
    const result = scoreNarrativeBaseFaithful([
      activity('a', 'built a tutoring programme', 'education access'),
      activity('b', 'painted a school mural', 'the arts'),
      activity('c', 'surveyed transport users', 'public transport'),
    ]);

    expect(result.metrics.patternConsistency).toBe(0);
  });

  it('recognises a recurring action pattern across distinct experiences', () => {
    const result = scoreNarrativeBaseFaithful([
      activity('a', 'built a tutoring programme', 'education access'),
      activity('b', 'built a coding curriculum', 'technology education'),
      activity('c', 'built an information portal', 'education access'),
    ]);

    expect(result.metrics.patternConsistency).toBe(100);
  });

  it('leaves growth arc and evidence density unassessed instead of substituting numeric-outcome/self-ref proxies', () => {
    const result = scoreNarrativeBaseFaithful([
      activity('a', 'built a tutoring programme', 'education access'),
      activity('b', 'built a coding curriculum', 'education access'),
      activity('c', 'built an information portal', 'education access'),
    ]);

    expect(result.metrics.growthArc).toBeNull();
    expect(result.metrics.evidenceDensity).toBeNull();
    expect(result.limitations.join(' ')).toContain('Growth arc');
  });
});
