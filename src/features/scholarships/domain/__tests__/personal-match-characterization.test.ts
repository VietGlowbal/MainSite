import type { DirectoryScholarship } from '@/lib/scholarships-data';
import { describe, expect, it } from 'vitest';
import { scorePersonalMatch } from '../personal-match';

function scholarship(overrides: Partial<DirectoryScholarship> = {}): DirectoryScholarship {
  return {
    id: 1,
    name: 'Characterization Scholarship',
    slug: null,
    scope: 'provider',
    country: null,
    countryFlag: null,
    provider: null,
    funding_type: [],
    coverage: null,
    amount_min: null,
    amount_max: null,
    amount_currency: null,
    slots: null,
    slots_text: null,
    eligibility: null,
    applies_to_text: null,
    conditions: null,
    insight: null,
    deadline_date: null,
    deadline_text: null,
    source_url: null,
    source_lang: 'en',
    ranking_note: null,
    universities: [],
    universityIds: [],
    universityCountries: [],
    amountLabel: null,
    deadlineLabel: null,
    deadlineSortValue: Infinity,
    ...overrides,
  };
}

describe('current scholarship personal-match behavior', () => {
  it('matches a saved university before checking country signals', () => {
    expect(
      scorePersonalMatch(
        scholarship({
          country: 'Canada',
          universityIds: [7],
          universityCountries: ['Canada'],
        }),
        [7],
        ['Canada'],
      ),
    ).toEqual({ matched: true, reason: 'university' });
  });

  it('matches the scholarship country when no saved university matches', () => {
    expect(
      scorePersonalMatch(scholarship({ country: 'Canada' }), [7], ['Canada']),
    ).toEqual({ matched: true, reason: 'country' });
  });

  it('matches a linked university country when the scholarship country is empty', () => {
    expect(
      scorePersonalMatch(
        scholarship({ universityCountries: ['Canada'] }),
        [],
        ['Canada'],
      ),
    ).toEqual({ matched: true, reason: 'country' });
  });

  it('returns no match when saved university and country signals do not match', () => {
    expect(
      scorePersonalMatch(
        scholarship({ country: 'Australia', universityCountries: ['Australia'] }),
        [7],
        ['Canada'],
      ),
    ).toEqual({ matched: false, reason: null });
  });
});
