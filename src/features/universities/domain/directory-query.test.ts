import { describe, expect, it } from 'vitest';
import {
  parseUniversitySearchParams,
  universitySearchParams,
} from './directory-query';

describe('university directory query state', () => {
  it('normalizes text and page values', () => {
    expect(
      parseUniversitySearchParams({
        q: ` ${'a'.repeat(120)} `,
        country: '  United Kingdom  ',
        page: '-4',
      }),
    ).toEqual({
      search: 'a'.repeat(100),
      country: 'United Kingdom',
      page: 1,
    });
  });

  it('omits defaults and resets pagination after filters change', () => {
    const current = parseUniversitySearchParams({
      q: 'Oxford',
      country: 'United Kingdom',
      page: '4',
    });

    expect(universitySearchParams(current, { page: 2 }).toString()).toBe(
      'q=Oxford&country=United+Kingdom&page=2',
    );
    expect(universitySearchParams(current, { search: 'Cambridge' }).toString()).toBe(
      'q=Cambridge&country=United+Kingdom',
    );
  });
});
