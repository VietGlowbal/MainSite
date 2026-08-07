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
});
