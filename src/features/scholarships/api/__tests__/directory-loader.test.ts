import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Page, ScholarshipListQuery, ScholarshipQueries } from '../scholarship-queries';
import type { DirectoryScholarship } from '@/lib/scholarships-data';
import { setScholarshipQueries } from '../index';
import { parseScholarshipSearchParams } from '../../domain/query-state';

const getPublicUniversityFocus = vi.hoisted(() => vi.fn());

vi.mock('next/cache', () => ({
  unstable_cache: (loader: unknown) => loader,
}));
vi.mock('@/server/directory/university-focus', () => ({ getPublicUniversityFocus }));

import { loadScholarshipDirectory } from '../directory-loader';

const page = (requested: number, total = 1): Page<DirectoryScholarship> => ({
  items: requested === 1 ? [{ id: 1 } as DirectoryScholarship] : [],
  total,
  page: requested,
  pageSize: 9,
  hasMore: requested * 9 < total,
});

afterEach(() => {
  setScholarshipQueries(null);
  getPublicUniversityFocus.mockReset();
});

describe('loadScholarshipDirectory', () => {
  it('does not allow the AI view through the public loader', async () => {
    await expect(
      loadScholarshipDirectory(parseScholarshipSearchParams({ view: 'ai' })),
    ).rejects.toThrow(/directory/i);
  });

  it('clamps a generic directory page to the final page', async () => {
    const listPublished = vi.fn((query: ScholarshipListQuery) =>
      Promise.resolve(page(query.page, 10)),
    );
    setScholarshipQueries({ listPublished } as unknown as ScholarshipQueries);

    const result = await loadScholarshipDirectory(
      parseScholarshipSearchParams({ page: '99' }),
    );

    expect(listPublished).toHaveBeenCalledTimes(2);
    expect(result.query.page).toBe(2);
    expect(result.canonicalSearch).toBe('page=2');
  });

  it('loads both focus sections and excludes the focused university from country results', async () => {
    const listPublished = vi.fn((query: ScholarshipListQuery) =>
      Promise.resolve(page(query.page)),
    );
    setScholarshipQueries({ listPublished } as unknown as ScholarshipQueries);
    getPublicUniversityFocus.mockResolvedValue({
      id: 42,
      name: 'Oxford',
      country: 'United Kingdom',
    });

    const result = await loadScholarshipDirectory(
      parseScholarshipSearchParams({ university: '42' }),
    );

    expect(result.focusUniversity).toEqual({
      id: 42,
      name: 'Oxford',
      country: 'United Kingdom',
    });
    expect(listPublished).toHaveBeenCalledWith(expect.objectContaining({ universityId: 42 }));
    expect(listPublished).toHaveBeenCalledWith(
      expect.objectContaining({
        relatedUniversityCountry: 'United Kingdom',
        excludeUniversityId: 42,
      }),
    );
  });
});
