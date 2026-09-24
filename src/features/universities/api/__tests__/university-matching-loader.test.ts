import { afterEach, describe, expect, it, vi } from 'vitest';
import { setProgrammeQueries, setUniversityQueries } from '../index';
import type { ProgrammeQueries } from '../programme-queries';
import { InMemoryUniversityRepository, makeUniversity } from './fakes';

// `unstable_cache` throws `Invariant: incrementalCache missing` outside a Next
// request or build context, so the catalogue read is unwrapped here — same
// convention as `directory-loader.test.ts` next door. What the cache does is
// covered by the fact that the loader still asks the repositories for the same
// data; what it stores is Next's problem, not this loader's.
vi.mock('next/cache', () => ({
  unstable_cache: (loader: unknown) => loader,
}));

import { loadUniversityRecommendations } from '../university-matching-loader';

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
  it('returns incomplete_profile without ranking anything', async () => {
    setUniversityQueries(new InMemoryUniversityRepository([makeUniversity({ id: 1, name: 'Example', country: 'Canada' })]));
    setProgrammeQueries({
      byUniversityId: vi.fn(),
      byUniversityIds: vi.fn(),
      allForMatching: vi.fn(async () => []),
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
    expect(result.results).toEqual([]);
  });

  it('never reaches the catalogue through the per-university batch path', async () => {
    // The old shape asked for `byUniversityIds(everyId)`, which forced the
    // programme read to wait on the university read for a filter that matched
    // every row — and carried `academic_units`, 192 kB that ranking never
    // reads. Both catalogue reads now go out together through `allForMatching`.
    // See docs/performance.md fix 6.
    const byUniversityIds = vi.fn();
    setUniversityQueries(new InMemoryUniversityRepository([makeUniversity({ id: 1, name: 'Example', country: 'Canada' })]));
    setProgrammeQueries({
      byUniversityId: vi.fn(),
      byUniversityIds,
      allForMatching: vi.fn(async () => []),
    } satisfies ProgrammeQueries);

    await loadUniversityRecommendations(
      supabaseWithProfile({
        study_level: 'postgraduate',
        target_subjects: ['Computer Science'],
        preferred_countries: ['Canada'],
        budget_range: null,
        campus_preferences: null,
      }),
      'user-1',
    );

    expect(byUniversityIds).not.toHaveBeenCalled();
  });

  it('batch-loads programme evidence and returns a successful recommendation response', async () => {
    setUniversityQueries(new InMemoryUniversityRepository([makeUniversity({
      id: 1,
      name: 'Example University',
      country: 'Canada',
      accept_rate: '4-5%',
    })]));
    setProgrammeQueries({
      byUniversityId: vi.fn(),
      byUniversityIds: vi.fn(),
      allForMatching: vi.fn(async () => [{
        id: 'programme-1',
        universityId: 1,
        name: 'MSc Computer Science',
        degreeLevel: 'master',
        officialUrl: 'https://example.com/programme-1',
        normalizedSubject: 'Computer Science',
        verificationStatus: 'RULE_VALIDATED',
        retrievedAt: '2026-08-18T00:00:00.000Z',
      }]),
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
    expect(result.results[0]?.selectivityContext).toBe('highly_selective');
  });

  it('returns error instead of presenting a repository failure as an empty result', async () => {
    setUniversityQueries(new InMemoryUniversityRepository([makeUniversity({ id: 1, name: 'Example', country: 'Canada' })]));
    setProgrammeQueries({
      byUniversityId: vi.fn(),
      byUniversityIds: vi.fn(),
      allForMatching: vi.fn(async () => { throw new Error('catalogue unavailable'); }),
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
