import { describe, expect, it } from 'vitest';
import type {
  MatchingAcademicEvidence,
  MatchingScholarshipContext,
  MatchingStudentContext,
  ScholarshipMatchingContext,
} from '../matching-context';
import {
  evaluateScholarshipEligibility,
  matchScholarshipDirectoryFilters,
  SCHOLARSHIP_ELIGIBILITY_POLICY_VERSION,
} from '../eligibility';
import {
  normalizeScholarshipEligibility,
  normalizeScholarshipDirectoryFilters,
} from '../eligibility-normalization';
import type { NormalizedScholarshipBenefits } from '../benefit-types';

const source = (sourceKind: 'student-profile' | 'scholarship-catalogue', recordId: string | null) => ({
  sourceKind,
  recordId,
  sourceUrl: 'https://example.test/scholarship',
  sourceField: null,
  retrievedAt: null,
});

const benefits: NormalizedScholarshipBenefits = {
  components: [],
  scenarios: [],
  classification: {
    label: 'unknown',
    tuitionCoverage: 'none',
    fullRideStatus: 'not-claimed',
    fullRideClaimed: false,
    fullyFundedClaimed: false,
    nonTuitionTypes: [],
  },
  raw: {
    coverage: null,
    amountMin: null,
    amountMax: null,
    amountCurrency: null,
    fundingType: [],
    sourceUrl: 'https://example.test/scholarship',
    fields: {},
  },
  warnings: [],
};

const student = (overrides: Partial<MatchingStudentContext> = {}): MatchingStudentContext => ({
  userId: 'user-1',
  profileId: 'profile-1',
  profileVersion: '1',
  nationality: 'Vietnamese',
  preferredCountries: ['United Kingdom'],
  targetSubjects: ['Computer Science'],
  studyLevel: 'undergraduate',
  budgetRange: null,
  tuitionBudgetUsd: null,
  fundingPreference: null,
  targetIntake: 'September 2027',
  applicationCycleYear: 2027,
  preferredCities: null,
  studyMode: null,
  academicBackground: null,
  currentQualification: null,
  gradesSummary: null,
  curriculumGrades: null,
  gpaScale: '4.0',
  gpaValue: 3.5,
  predictedGrades: null,
  postgraduateAcademic: null,
  phdAcademic: null,
  careerInterests: null,
  campusPreferences: null,
  ...overrides,
});

const academicEvidence: MatchingAcademicEvidence = {
  achievements: [],
  activities: [],
  englishTests: [],
  standardizedTests: [],
};

function scholarship(overrides: Partial<MatchingScholarshipContext> = {}): MatchingScholarshipContext {
  return {
    id: 1,
    name: 'Test Scholarship',
    scope: 'provider',
    country: 'United Kingdom',
    provider: 'Test Provider',
    fundingType: ['merit'],
    coverage: 'Tuition support',
    eligibility: 'Rolling applications for international students',
    appliesToText: null,
    conditions: null,
    deadline: 'rolling',
    sourceUrl: 'https://example.test/scholarship',
    raw: {},
    universityIds: [],
    universityCountries: [],
    normalizedBenefits: benefits,
    source: source('scholarship-catalogue', '1'),
    benefits: [],
    ...overrides,
  };
}

function context(
  currentStudent: MatchingStudentContext = student(),
  currentScholarship: MatchingScholarshipContext = scholarship(),
  selection: ScholarshipMatchingContext['selection'] = {
    requestedApplicationId: null,
    requestedProgrammeId: null,
    requestedUniversityId: null,
    application: null,
    programme: null,
    university: null,
  },
): ScholarshipMatchingContext {
  return {
    contextVersion: 'scholarship-matching-context-v2',
    cache: { scope: 'user', key: 'cache', userId: currentStudent.userId, profileVersion: currentStudent.profileVersion },
    student: currentStudent,
    academicEvidence,
    savedUniversities: [],
    selection,
    scholarships: [currentScholarship],
    sourceStatus: {
      profile: 'present',
      evidence: 'present',
      savedUniversities: 'present',
      applications: 'present',
      programmes: 'present',
      universities: 'present',
      scholarships: 'present',
    },
    diagnostics: [],
  };
}

const policy = { asOf: '2027-01-15T00:00:00.000Z' };

function evaluate(
  currentScholarship: MatchingScholarshipContext,
  currentContext = context(student(), currentScholarship),
) {
  return evaluateScholarshipEligibility({
    context: currentContext,
    scholarship: currentScholarship,
    policy,
  });
}

describe('scholarship eligibility normalization and evaluation', () => {
  it('accepts a supported nationality and rejects an explicit nationality contradiction', () => {
    const supported = evaluate(scholarship({ eligibility: 'Vietnamese citizens only' }));
    const rejected = evaluate(
      scholarship({ eligibility: 'Canadian citizens only' }),
      context(student(), scholarship({ id: 2, eligibility: 'Canadian citizens only' })),
    );

    expect(supported.status).toBe('ELIGIBLE');
    expect(supported.reasonCodes).toContain('nationality-supported');
    expect(rejected.status).toBe('INELIGIBLE');
    expect(rejected.reasonCodes).toContain('nationality-mismatch');
  });

  it('rejects degree and subject mismatches without using fuzzy similarity', () => {
    const degreeMismatch = evaluate(scholarship({ eligibility: 'Postgraduate students only' }));
    const subjectScholarship = scholarship({ eligibility: 'Students majoring in Computer Science' });
    const subjectMismatch = evaluate(
      subjectScholarship,
      context(student({ targetSubjects: ['History'] }), subjectScholarship),
    );

    expect(degreeMismatch.status).toBe('INELIGIBLE');
    expect(degreeMismatch.reasonCodes).toContain('study-level-mismatch');
    expect(subjectMismatch.status).toBe('INELIGIBLE');
    expect(subjectMismatch.reasonCodes).toContain('subject-mismatch');
  });

  it('requires the selected university and programme to satisfy structured restrictions', () => {
    const current = scholarship({
      scope: 'university',
      universityIds: [42],
      raw: { programme_ids: ['programme-1'] },
      eligibility: 'Vietnamese citizens only',
    });
    const selected: ScholarshipMatchingContext['selection'] = {
      requestedApplicationId: null,
      requestedProgrammeId: 'programme-1',
      requestedUniversityId: 42,
      application: null,
      programme: {
        id: 'programme-1', universityId: 42, universityName: 'Example University', name: 'Computer Science',
        degreeLevel: 'undergraduate', subject: 'Computer Science', studyMode: null, intake: 'September 2027',
        country: 'United Kingdom', city: 'London', durationText: null, duration: null, tuitionText: null,
        tuitionAmount: null, tuitionPeriod: 'unspecified', source: source('scholarship-catalogue', 'programme-1'),
      },
      university: {
        id: 42, name: 'Example University', country: 'United Kingdom', city: null, type: null,
        tuitionText: null, livingCostText: null, housingText: null, source: source('scholarship-catalogue', '42'),
      },
    };
    const eligible = evaluate(current, context(student(), current, selected));
    const wrongUniversity = evaluate(current, context(student(), current, {
      ...selected,
      requestedUniversityId: 99,
      university: { ...selected.university!, id: 99 },
    }));

    expect(eligible.status).toBe('ELIGIBLE');
    expect(eligible.reasonCodes).toContain('university-supported');
    expect(eligible.reasonCodes).toContain('programme-supported');
    expect(wrongUniversity.status).toBe('INELIGIBLE');
    expect(wrongUniversity.reasonCodes).toContain('university-mismatch');
  });

  it('fails closed for expired and explicit closed deadlines', () => {
    const expired = evaluate(scholarship({ deadline: '2027-01-01' }));
    const closed = evaluate(scholarship({ deadline: 'Applications are closed' }));

    expect(expired.status).toBe('INELIGIBLE');
    expect(expired.reasonCodes).toContain('deadline-passed');
    expect(closed.status).toBe('INELIGIBLE');
    expect(closed.reasonCodes).toContain('deadline-closed');
  });

  it('rejects an intake mismatch and supports a matching cycle', () => {
    const current = scholarship({ raw: { intake: 'January 2028' } });
    const result = evaluate(current);
    expect(result.status).toBe('INELIGIBLE');
    expect(result.reasonCodes).toContain('intake-mismatch');

    const matching = scholarship({ id: 2, raw: { intake: 'September 2027' } });
    const matchingResult = evaluate(matching, context(student(), matching));
    expect(matchingResult.status).toBe('ELIGIBLE');
    expect(matchingResult.reasonCodes).toContain('intake-supported');
  });

  it('evaluates explicit GPA requirements and does not infer academic eligibility', () => {
    const academic = scholarship({ eligibility: 'Minimum GPA 3.0/4.0' });
    const eligible = evaluate(academic);
    const ineligible = evaluate(academic, context(student({ gpaValue: 2.5 }), academic));
    const ambiguous = evaluate(scholarship({ eligibility: 'Applicants must demonstrate academic excellence' }));

    expect(eligible.status).toBe('ELIGIBLE');
    expect(eligible.reasonCodes).toContain('academic-supported');
    expect(ineligible.status).toBe('INELIGIBLE');
    expect(ineligible.reasonCodes).toContain('academic-mismatch');
    expect(ambiguous.status).toBe('UNKNOWN');
    expect(ambiguous.missingSignals).toContain('academic');
  });

  it('returns UNKNOWN for missing profile evidence, ambiguous prose, and missing structured facts', () => {
    const nationality = scholarship({ eligibility: 'Vietnamese citizens only' });
    const missing = evaluate(
      nationality,
      context(student({ nationality: null }), nationality),
    );
    const ambiguous = evaluate(scholarship({ eligibility: 'Applicants from developing countries' }));
    const noFacts = evaluate(scholarship({ eligibility: null, deadline: null }));

    expect(missing.status).toBe('UNKNOWN');
    expect(missing.missingSignals).toContain('nationality');
    expect(ambiguous.status).toBe('UNKNOWN');
    expect(ambiguous.reasonCodes).toContain('requirement-ambiguous');
    expect(noFacts.status).toBe('UNKNOWN');
    expect(noFacts.missingSignals).toContain('eligibility-evidence');
  });

  it('fails closed when residency is required but the canonical context has no residence signal', () => {
    const residency = scholarship({ eligibility: 'Residents of the United Kingdom only' });
    const result = evaluate(residency);

    expect(result.status).toBe('UNKNOWN');
    expect(result.missingSignals).toContain('residency');
    expect(result.reasonCodes).toContain('evidence-missing');
  });

  it('keeps directory filtering separate from hard eligibility', () => {
    const filters = normalizeScholarshipDirectoryFilters({
      country: 'United Kingdom',
      universityIds: [42],
      fundingTypes: ['merit'],
      deadline: 'open',
    });
    const candidate = {
      id: 1,
      country: 'United Kingdom',
      universityIds: [42],
      universityCountries: [],
      fundingTypes: ['merit'],
      normalizedEligibility: normalizeScholarshipEligibility(scholarship({ deadline: 'rolling' })),
      comparableTotalValue: null,
    };
    const filterResult = matchScholarshipDirectoryFilters(candidate, filters);
    const eligibility = evaluate(scholarship({ country: 'United Kingdom', eligibility: null, deadline: null }));

    expect(filterResult).toEqual({ matches: true, mode: 'structured' });
    expect(eligibility.status).toBe('UNKNOWN');
    expect(eligibility.status).not.toBe('ELIGIBLE');
  });

  it('matches structured subject groups for major filters without using them as eligibility proof', () => {
    const candidate = {
      id: 1,
      country: null,
      universityIds: [],
      universityCountries: [],
      fundingTypes: [],
      normalizedEligibility: normalizeScholarshipEligibility(
        scholarship({ eligibility: 'Students majoring in Computer Science' }),
      ),
      comparableTotalValue: null,
    };

    expect(
      matchScholarshipDirectoryFilters(candidate, { major: 'stem' }),
    ).toEqual({ matches: true, mode: 'structured' });
  });

  it('preserves value filters as comparable-only and is deterministic on repetition', () => {
    const filters = normalizeScholarshipDirectoryFilters({
      value: { min: 80_000, max: 100_000, currency: 'USD' },
    });
    const candidate = {
      id: 1,
      country: null,
      universityIds: [],
      universityCountries: [],
      fundingTypes: [],
      normalizedEligibility: normalizeScholarshipEligibility(scholarship()),
      comparableTotalValue: { lowerBound: 82_300, currency: 'USD' },
    };
    const first = evaluate(scholarship({ eligibility: 'Vietnamese citizens only' }));
    const second = evaluate(scholarship({ eligibility: 'Vietnamese citizens only' }));

    expect(matchScholarshipDirectoryFilters(candidate, filters).matches).toBe(true);
    expect(first).toEqual(second);
    expect(first.policyVersion).toBe(SCHOLARSHIP_ELIGIBILITY_POLICY_VERSION);
  });

  it('keeps free-text subject matches in discovery mode and never treats them as eligibility facts', () => {
    const filters = normalizeScholarshipDirectoryFilters({ subject: 'Computer Science' });
    const candidate = {
      id: 1,
      country: null,
      universityIds: [],
      universityCountries: [],
      fundingTypes: [],
      normalizedEligibility: null,
      discoveryText: 'Computer Science scholarship',
      comparableTotalValue: null,
    };

    expect(matchScholarshipDirectoryFilters(candidate, filters)).toEqual({
      matches: false,
      mode: 'unavailable',
    });
    expect(matchScholarshipDirectoryFilters(candidate, filters, { allowDiscoveryText: true })).toEqual({
      matches: true,
      mode: 'discovery',
    });
  });
});
