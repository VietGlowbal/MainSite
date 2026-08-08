import { describe, expect, it } from 'vitest';
import { computeMatchResult } from './matching';

describe('computeMatchResult', () => {
  it('treats the saved "Open to ideas" onboarding answer as no country restriction', () => {
    const result = computeMatchResult(
      { preferred_countries: ['Open to ideas'] },
      {
        id: 1,
        name: 'Example University',
        country: 'Canada',
      },
    );

    expect(result.breakdown?.country).toEqual({
      score: 12,
      max: 25,
      reason: 'No country preference set — partial credit',
    });
  });

  it('matches a saved subject family through any of its child subjects', () => {
    const result = computeMatchResult(
      { target_subjects: ['Technology'] },
      {
        id: 1,
        name: 'Computing University',
        country: 'Canada',
        strengths: 'Computer Science and Mathematics',
      },
    );

    expect(result.breakdown?.subjects).toEqual({
      score: 25,
      max: 25,
      reason: 'Matches: technology',
    });
  });

  it('keeps a subject family as one scoring preference after expansion', () => {
    const result = computeMatchResult(
      { target_subjects: ['Technology', 'Business'] },
      {
        id: 1,
        name: 'Computing University',
        country: 'Canada',
        best_for: 'Artificial Intelligence',
      },
    );

    expect(result.breakdown?.subjects).toEqual({
      score: 13,
      max: 25,
      reason: 'Matches: technology',
    });
  });
});
