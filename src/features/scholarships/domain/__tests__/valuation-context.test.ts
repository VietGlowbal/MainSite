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

function university(id: number, city = 'Oxford') {
  return {
    id,
    name: `University ${id}`,
    city,
    country: 'United Kingdom',
    provenance: { sourceType: 'university' as const, recordId: String(id), sourceUrl: null, retrievedAt: null },
  };
}

function programme(id: string, universityId: number | null, count = 1) {
  return {
    id,
    name: `Programme ${id}`,
    universityId,
    duration: { count, unit: 'year' as const },
    tuitionSource: null,
    provenance: { sourceType: 'programme' as const, recordId: id, sourceUrl: null, retrievedAt: null },
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

  it('rejects an incoherent programme/university pair without changing candidate programme facts', () => {
    const candidate = context({
      university: university(20),
      universityKey: '20',
      city: 'Oxford',
      cityKey: 'Oxford',
      duration: { count: 3, unit: 'year' },
      programmeKey: 'candidate-programme',
      tuitionReferenceKey: 'candidate-tuition',
    });
    const selected = {
      programme: programme('programme-10', 10, 1),
      university: university(20, 'London'),
    };

    expect(selectScholarshipValuationContext([candidate], selected)).toMatchObject({
      university: { id: 20, city: 'London' },
      programme: null,
      duration: { count: 3, unit: 'year' },
      programmeKey: 'candidate-programme',
      tuitionReferenceKey: 'candidate-tuition',
    });
  });

  it('accepts a programme when its university agrees with the candidate selection', () => {
    const candidate = context({ university: university(20), universityKey: '20' });
    const selected = { programme: programme('programme-20', 20), university: university(20) };

    expect(selectScholarshipValuationContext([candidate], selected)).toMatchObject({
      programme: { id: 'programme-20', universityId: 20 },
      duration: { count: 1, unit: 'year' },
      programmeKey: 'programme-20',
    });
  });

  it('accepts a direct programme match without requiring a separate university selection', () => {
    const candidate = context({
      programme: programme('programme-direct', 10, 2),
      programmeKey: 'programme-direct',
      duration: { count: 2, unit: 'year' },
    });

    expect(selectScholarshipValuationContext([candidate], {
      programme: programme('programme-direct', 10, 2),
      university: null,
    })?.programme?.id).toBe('programme-direct');
  });

  it('does not attach an unlinked programme to a university-only candidate match', () => {
    const candidate = context({
      programme: programme('candidate-programme', 20, 3),
      programmeKey: 'candidate-programme',
      duration: { count: 3, unit: 'year' },
      university: university(20),
      universityKey: '20',
    });

    expect(selectScholarshipValuationContext([candidate], {
      programme: programme('unlinked-programme', null, 1),
      university: university(20, 'London'),
    })).toMatchObject({
      programme: { id: 'candidate-programme' },
      programmeKey: 'candidate-programme',
      duration: { count: 3, unit: 'year' },
      university: { id: 20, city: 'London' },
    });
  });

  it('keeps a valid university-only refinement without attaching a programme', () => {
    const candidate = context({ university: university(20), universityKey: '20' });

    expect(selectScholarshipValuationContext([candidate], {
      programme: null,
      university: university(20, 'London'),
    })).toMatchObject({
      programme: null,
      university: { id: 20, city: 'London' },
    });
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
