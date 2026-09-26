import { describe, expect, it } from 'vitest';
import {
  buildScholarshipValuationContexts,
  selectScholarshipValuationContext,
  type ScholarshipValuationContext,
} from '../valuation-context';

function context(overrides: Partial<ScholarshipValuationContext> = {}): ScholarshipValuationContext {
  return {
    scholarshipId: 1,
    programme: null,
    university: null,
    city: null,
    country: 'United Kingdom',
    programmeKey: null,
    universityKey: null,
    cityKey: null,
    countryKey: 'United Kingdom',
    duration: null,
    tuitionReferenceKey: null,
    provenance: [],
    ...overrides,
  };
}

describe('candidate-owned scholarship valuation context', () => {
  it('builds deterministic alternatives from linked universities', () => {
    const contexts = buildScholarshipValuationContexts({
      scholarshipId: 10,
      scholarshipCountry: 'United Kingdom',
      universities: [
        { id: 20, name: 'B', country: 'United Kingdom', city: 'Oxford' },
        { id: 10, name: 'A', country: 'United Kingdom', city: 'London' },
      ],
    });

    expect(contexts.map((item) => item.university?.id)).toEqual([10, 20]);
    expect(contexts[0]).toMatchObject({
      universityKey: '10',
      cityKey: 'London',
      countryKey: 'United Kingdom',
    });
  });

  it('does not borrow a selected university for an unrelated candidate', () => {
    const candidate = context({
      scholarshipId: 2,
      university: {
        id: 20,
        name: 'University B',
        city: 'Oxford',
        country: 'United Kingdom',
        provenance: { sourceType: 'university', recordId: '20', sourceUrl: null, retrievedAt: null },
      },
      universityKey: '20',
      city: 'Oxford',
      cityKey: 'Oxford',
    });
    const selectedA = {
      programme: null,
      university: {
        id: 10,
        name: 'University A',
        city: 'London',
        country: 'United Kingdom',
        provenance: { sourceType: 'university' as const, recordId: '10', sourceUrl: null, retrievedAt: null },
      },
    };

    expect(selectScholarshipValuationContext([candidate], selectedA)).toBe(candidate);
  });

  it('refines only the matching candidate university', () => {
    const candidate = context({
      university: {
        id: 10,
        name: 'University A',
        city: 'London',
        country: 'United Kingdom',
        provenance: { sourceType: 'university', recordId: '10', sourceUrl: null, retrievedAt: null },
      },
      universityKey: '10',
      city: 'London',
      cityKey: 'London',
    });
    const selected = {
      programme: null,
      university: {
        id: 10,
        name: 'University A',
        city: 'Cambridge',
        country: 'United Kingdom',
        provenance: { sourceType: 'university' as const, recordId: '10', sourceUrl: null, retrievedAt: null },
      },
    };

    expect(selectScholarshipValuationContext([candidate], selected)?.cityKey).toBe('Cambridge');
  });

  it('keeps an unlinked candidate at country/global scope', () => {
    const [candidate] = buildScholarshipValuationContexts({
      scholarshipId: 30,
      scholarshipCountry: 'Canada',
      universities: [],
    });

    expect(candidate).toMatchObject({
      university: null,
      programme: null,
      cityKey: null,
      countryKey: 'Canada',
      universityKey: null,
    });
  });
});
