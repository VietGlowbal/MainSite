import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryUniversityRepository, makeUniversity } from './fakes';
import { setUniversityQueries } from '../index';

vi.mock('next/cache', () => ({
  unstable_cache: (loader: unknown) => loader,
}));

import { loadUniversityDirectory } from '../directory-loader';

afterEach(() => setUniversityQueries(null));

describe('loadUniversityDirectory', () => {
  it('clamps an out-of-range page and returns only display data', async () => {
    setUniversityQueries(
      new InMemoryUniversityRepository(
        Array.from({ length: 10 }, (_, index) =>
          makeUniversity({
            id: index + 1,
            name: `University ${index + 1}`,
            country: 'United Kingdom',
            qs_rank: index + 1,
          }),
        ),
      ),
    );

    const result = await loadUniversityDirectory({ search: '', country: '', page: 99 });

    expect(result.query.page).toBe(2);
    expect(result.page.page).toBe(2);
    expect(result.page.items).toHaveLength(1);
    expect(result.page.items[0]?.scholarships).toEqual([]);
    expect(result.canonicalSearch).toBe('page=2');
  });
});
