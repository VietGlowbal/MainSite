import { describe, expect, it } from 'vitest';
import source from '../../data/vinuni-reviewed.json';
import { buildVinUniPlan } from '../../scripts/import-vinuni-reviewed.mjs';

describe('reviewed VinUni importer', () => {
  it('builds the complete, VinUni-only verified staging plan', () => {
    const plan = buildVinUniPlan(source, {
      id: 97,
      name: 'VinUniversity',
      country: 'Vietnam',
      country_code: 'VN',
      primary_domain: 'vinuni.edu.vn',
      official_url: 'https://vinuni.edu.vn',
    });

    expect(plan.institutions).toHaveLength(1);
    expect(plan.organisationUnits).toHaveLength(4);
    expect(plan.programmes).toHaveLength(12);
    expect(plan.programmeRelations).toHaveLength(12);
    expect(plan.fieldAssertions).toHaveLength(60);
    expect(plan.programmes.every((row) => row.institution_id === 'csv-university-97')).toBe(true);
    expect(plan.programmes.every((row) => row.verification_status === 'HUMAN_VERIFIED')).toBe(true);
    expect(plan.fieldAssertions.every((row) => row.verification_status === 'HUMAN_VERIFIED')).toBe(true);
  });

  it('rejects incomplete reviewed data before any database call', () => {
    expect(() => buildVinUniPlan({ ...source, programmes: source.programmes.slice(1) }, {
      id: 97,
      name: 'VinUniversity',
      country_code: 'VN',
      primary_domain: 'vinuni.edu.vn',
      official_url: 'https://vinuni.edu.vn',
    })).toThrow('Expected 12 programmes');
  });
});
