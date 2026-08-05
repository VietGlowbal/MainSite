import { describe, expect, it } from 'vitest';
import {
  parseScholarshipSearchParams,
  scholarshipSearchParams,
} from './query-state';

describe('scholarship query state', () => {
  it('normalizes filters, deduplicates funding, and keeps both focus pages', () => {
    expect(
      parseScholarshipSearchParams({
        q: ` ${'a'.repeat(120)} `,
        school: '  Oxford  ',
        major: 'stem',
        degree: 'postgraduate',
        country: 'United Kingdom',
        funding: 'merit,need,merit,invalid',
        sort: 'deadline',
        page: '2',
        university: '42',
        countryPage: '3',
      }),
    ).toEqual({
      search: 'a'.repeat(100),
      universitySearch: 'Oxford',
      major: 'stem',
      degree: 'postgraduate',
      country: 'United Kingdom',
      funding: ['merit', 'need'],
      sort: 'deadline',
      page: 2,
      universityId: 42,
      countryPage: 3,
    });
  });

  it('falls back to defaults for invalid values', () => {
    expect(
      parseScholarshipSearchParams({
        major: 'everything',
        degree: 'all-of-them',
        sort: 'random',
        page: '-5',
        university: 'oops',
        countryPage: '0',
      }),
    ).toEqual({
      search: '',
      universitySearch: '',
      major: 'all',
      degree: 'all',
      country: 'all',
      funding: [],
      sort: 'relevance',
      page: 1,
      universityId: null,
      countryPage: 1,
    });
  });

  it('omits defaults when serializing and resets both pages after a filter change', () => {
    const current = parseScholarshipSearchParams({
      university: '42',
      page: '4',
      countryPage: '5',
    });

    expect(
      scholarshipSearchParams(current, {
        search: 'award',
        funding: ['need', 'merit'],
      }).toString(),
    ).toBe('q=award&funding=merit%2Cneed&university=42');
  });

  it('updates one pagination target without resetting the other', () => {
    const current = parseScholarshipSearchParams({ university: '42', page: '2', countryPage: '3' });

    expect(scholarshipSearchParams(current, { page: 4 }).toString()).toBe(
      'page=4&university=42&countryPage=3',
    );
    expect(scholarshipSearchParams(current, { countryPage: 5 }).toString()).toBe(
      'page=2&university=42&countryPage=5',
    );
  });
});
