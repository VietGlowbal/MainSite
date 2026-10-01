import { describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown) => fn,
}));
vi.mock('@/server/db/admin', () => ({
  createAdminClient: () => ({}),
}));

import { tallyScholarshipCountries } from '../supabase-scholarship-repository';

describe('tallyScholarshipCountries', () => {
  it('counts a scholarship once per country, however many universities link it', () => {
    const counts = tallyScholarshipCountries(
      [],
      [
        { scholarship_id: 1, universities: { country: 'United Kingdom' } },
        { scholarship_id: 1, universities: { country: 'United Kingdom' } },
        { scholarship_id: 1, universities: { country: 'Australia' } },
        { scholarship_id: 2, universities: { country: 'United Kingdom' } },
      ],
    );
    expect(counts).toEqual([
      { country: 'United Kingdom', count: 2 },
      { country: 'Australia', count: 1 },
    ]);
  });

  it("lets a scholarship's own country win over its universities'", () => {
    const counts = tallyScholarshipCountries(
      [{ id: 7, country: 'Germany' }],
      [{ scholarship_id: 7, universities: { country: 'France' } }],
    );
    expect(counts).toEqual([{ country: 'Germany', count: 1 }]);
  });

  it('skips rows with no country and orders ties by name', () => {
    const counts = tallyScholarshipCountries(
      [{ id: 1, country: null }],
      [
        { scholarship_id: 1, universities: null },
        { scholarship_id: 2, universities: { country: '  ' } },
        { scholarship_id: 3, universities: { country: 'Japan' } },
        { scholarship_id: 4, universities: { country: 'Hong Kong' } },
      ],
    );
    expect(counts).toEqual([
      { country: 'Hong Kong', count: 1 },
      { country: 'Japan', count: 1 },
    ]);
  });
});
