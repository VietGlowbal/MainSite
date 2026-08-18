import { afterEach, describe, expect, it, vi } from 'vitest';
import { setProgrammeQueries, setUniversityQueries } from '../index';
import type { ProgrammeQueries } from '../programme-queries';
import { loadUniversityRecommendations } from '../university-matching-loader';
import { InMemoryUniversityRepository, makeUniversity } from './fakes';

function supabaseWithProfile(data: unknown, error: { message: string } | null = null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data, error })),
        })),
      })),
    })),
  } as never;
}

afterEach(() => {
  setUniversityQueries(null);
  setProgrammeQueries(null);
});

describe('loadUniversityRecommendations', () => {
  it('returns incomplete_profile without loading programme rows', async () => {
    setUniversityQueries(new InMemoryUniversityRepository([makeUniversity({ id: 1, name: 'Example', country: 'Canada' })]));
    const byUniversityIds = vi.fn();
    setProgrammeQueries({
      byUniversityId: vi.fn(),
      byUniversityIds,
    } satisfies ProgrammeQueries);

    const result = await loadUniversityRecommendations(
      supabaseWithProfile({
        study_level: null,
        target_subjects: [],
        preferred_countries: [],
        budget_range: null,
        campus_preferences: null,
      }),
      'user-1',
    );

    expect(result.status).toBe('incomplete_profile');
    expect(byUniversityIds).not.toHaveBeenCalled();
  });

  it('batch-loads programme evidence and returns a successful recommendation response', async () => {
    setUniversityQueries(new InMemoryUniversityRepository([makeUniversity({
      id: 1,
      name: 'Example University',
      country: 'Canada',
    })]));
    setProgrammeQueries({
      byUniversityId: vi.fn(),
      byUniversityIds: vi.fn(async () => new Map([
        [1, [{
          id: 'programme-1',
          universityId: 1,
          name: 'MSc Computer Science',
          degreeLevel: 'master',
          credential: null,
          duration: null,
          officialUrl: 'https://example.com/programme-1',
          normalizedSubject: 'Computer Science',
          programmeStatus: null,
          verificationStatus: 'RULE_VALIDATED',
          retrievedAt: '2026-08-18T00:00:00.000Z',
          units: [],
        }]],
      ])),
    } satisfies ProgrammeQueries);

    const result = await loadUniversityRecommendations(
      supabaseWithProfile({
        study_level: 'postgraduate',
        target_subjects: ['Computer Science'],
        preferred_countries: ['Canada'],
        budget_range: null,
        campus_preferences: null,
      }),
      'user-1',
    );

    expect(result.status).toBe('success');
    expect(result.results[0]?.programmeMatches[0]?.programmeName).toBe('MSc Computer Science');
  });

  it('returns error instead of presenting a repository failure as an empty result', async () => {
    setUniversityQueries(new InMemoryUniversityRepository([makeUniversity({ id: 1, name: 'Example', country: 'Canada' })]));
    setProgrammeQueries({
      byUniversityId: vi.fn(),
      byUniversityIds: vi.fn(async () => { throw new Error('catalogue unavailable'); }),
    } satisfies ProgrammeQueries);

    const result = await loadUniversityRecommendations(
      supabaseWithProfile({
        study_level: 'postgraduate',
        target_subjects: ['Computer Science'],
        preferred_countries: [],
        budget_range: null,
        campus_preferences: null,
      }),
      'user-1',
    );

    expect(result.status).toBe('error');
    expect(result.results).toEqual([]);
  });
});
