import { describe, expect, it } from 'vitest';
import { evaluateAdmission, evaluateEligibility, type MatchEvidence, type StudentMatchingProfile } from '../../domain/matching';
import type { CatalogueFieldValue, CatalogueProgrammeMatchingRecord } from '../programme-queries';
import type { UniversityListItem } from '../university-queries';
import { annualUsdBudget, candidateFrom } from '../matching-candidate-loader';

const studentEvidence: MatchEvidence = { source: 'fixture', scope: 'student', field: 'fixture', reliability: 'structured' };

function profile(overrides: Partial<StudentMatchingProfile> = {}): StudentMatchingProfile {
  return {
    studyLevel: 'undergraduate', targetSubjects: [], preferredCountries: [], preferredCities: [], budget: null,
    gpa: null, englishTests: [], standardizedTests: [], academicSubjects: [], ...overrides,
  };
}

const university = {
  id: 1, name: 'Fixture University', country: 'Canada', gpa_range: '3.8 / 4.0', accept_rate: null,
  admission_difficulty: null, teaching_style: null, international_environment: null, best_for: null,
} as unknown as UniversityListItem;

function fact(overrides: Partial<CatalogueFieldValue> & Pick<CatalogueFieldValue, 'fieldName' | 'valueJson'>): CatalogueFieldValue {
  return {
    id: `${overrides.fieldName}-fact`, courseId: 'programme-a', nullReason: null, sourceUrl: 'https://example.edu/admissions', sourceType: 'programme_admission', evidence: 'Fixture evidence', evidenceLocator: null,
    scope: 'programme', audience: 'international', academicCycle: '2026-2027', retrievedAt: '2026-08-01T00:00:00Z', confidence: 1,
    verificationStatus: 'HUMAN_VERIFIED', displayMode: 'structured', useForEligibility: true, validationErrors: [], ...overrides,
  };
}

function record(normalizedFacts: CatalogueFieldValue[] = []): CatalogueProgrammeMatchingRecord {
  return {
    id: 'programme-a', universityId: 1, name: 'Computer Science', degreeLevel: 'bachelor', credential: null, duration: null, officialUrl: 'https://example.edu/programme', units: [],
    sourceProgrammeId: 'source-a', normalizedField: 'computer_science', normalizedFacts, course: {
      tuitionFeeMin: 50000, tuitionCurrency: 'USD', tuitionFeeText: 'USD 50,000 per year', entryRequirementsSummary: null, englishRequirementsSummary: null, sourceConfidence: 1, verificationStatus: 'HUMAN_VERIFIED',
    },
  };
}

describe('annualUsdBudget', () => {
  it('uses the upper bound of a closed annual band without concatenating values', () => {
    const budget = annualUsdBudget('$10,000–$20,000 / year');

    expect(budget?.amount).toBe(20_000);
    expect(budget?.currency).toBe('USD');
    expect(budget?.period).toBe('annual');
    expect(budget?.evidence.note).toContain('Upper bound');
  });

  it('treats the dedicated tuition budget field as an annual USD band', () => {
    expect(annualUsdBudget('$20,000 - $30,000', 'tuition_budget_usd', true)?.amount).toBe(30_000);
  });

  it('does not infer a period or an upper bound', () => {
    expect(annualUsdBudget('Up to $25k')).toBeNull();
    expect(annualUsdBudget('Over $50,000 / year')).toBeNull();
  });
});

describe('normalized catalogue v2 matching facts', () => {
  it('scores verified subject prerequisites', () => {
    const candidate = candidateFrom(record([fact({ fieldName: 'subject_prerequisites', valueJson: { subjects: ['Calculus', 'Physics'] } })]), university);
    const result = evaluateAdmission(profile({ academicSubjects: ['Calculus', 'Physics'] }), candidate);

    expect(result.factors.find((factor) => factor.key === 'prerequisites')).toMatchObject({ status: 'scored', score: 100 });
  });

  it('keeps unverified prerequisites unknown', () => {
    const candidate = candidateFrom(record([fact({ fieldName: 'subject_prerequisites', valueJson: { subjects: ['Calculus'] }, verificationStatus: 'NEEDS_REVIEW', displayMode: 'source_excerpt' })]), university);
    const result = evaluateAdmission(profile({ academicSubjects: ['History'] }), candidate);

    expect(result.factors.find((factor) => factor.key === 'prerequisites')?.status).toBe('unknown');
    expect(evaluateEligibility(profile({ academicSubjects: ['History'] }), candidate).status).not.toBe('not_eligible');
  });

  it('keeps a missing prerequisite fact unknown', () => {
    const candidate = candidateFrom(record(), university);
    const result = evaluateAdmission(profile({ academicSubjects: ['Calculus'] }), candidate);

    expect(result.factors.find((factor) => factor.key === 'prerequisites')?.status).toBe('unknown');
    expect(evaluateEligibility(profile({ academicSubjects: ['Calculus'] }), candidate).status).toBe('unknown');
  });

  it('prefers a programme GPA fact over the university fallback', () => {
    const candidate = candidateFrom(record([fact({ fieldName: 'minimum_gpa', valueJson: { minimum: 3.0, scale: 4.0 } }), fact({ fieldName: 'gpa_scale', valueJson: 4.0 })]), university);

    expect(candidate.gpaRequirement?.minimum).toBe(3);
    expect(candidate.gpaRequirement?.evidence.scope).toBe('programme');
    expect(candidate.gpaRequirement?.evidence.source).toBe('course_current_field_values');
  });

  it('does not let a source excerpt create a hard eligibility failure', () => {
    const candidate = candidateFrom(record([fact({ fieldName: 'minimum_gpa', valueJson: { minimum: 4.0, scale: 4.0 }, displayMode: 'source_excerpt' })]), university);
    const result = evaluateEligibility(profile({ gpa: { value: 3.0, scale: '4.0 scale', evidence: studentEvidence } }), candidate);

    expect(candidate.gpaRequirement).toBeNull();
    expect(result.status).toBe('unknown');
    expect(result.checks.some((check) => check.status === 'not_met')).toBe(false);
  });
});
