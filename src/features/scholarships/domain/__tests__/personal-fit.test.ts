import { describe, expect, it } from 'vitest';
import type {
  MatchingAcademicEvidence,
  MatchingApplicationContext,
  MatchingProgrammeContext,
  MatchingProvenance,
  MatchingScholarshipContext,
  MatchingStudentContext,
  MatchingUniversityContext,
  ScholarshipMatchingContext,
  SavedUniversitySource,
} from '../matching-context';
import {
  evaluateScholarshipEligibility,
  type ScholarshipEligibilityResult,
} from '../eligibility';
import {
  DEFAULT_PERSONAL_FIT_POLICY,
  type PersonalFitPolicy,
} from '../personal-fit-policy';
import {
  scorePersonalFit,
  type PersonalFitResult,
} from '../personal-fit';
import type { NormalizedScholarshipBenefits } from '../benefit-types';

const source = (
  sourceKind: MatchingProvenance['sourceKind'],
  recordId: string | null,
): MatchingProvenance => ({
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

const academicEvidence: MatchingAcademicEvidence = {
  achievements: [],
  activities: [],
  englishTests: [],
  standardizedTests: [],
};

const programme = (): MatchingProgrammeContext => ({
  id: 'programme-1',
  universityId: 42,
  universityName: 'Example University',
  name: 'Computer Science BSc',
  degreeLevel: 'undergraduate',
  subject: 'Computer Science',
  studyMode: 'full-time',
  intake: 'September 2027',
  country: 'United Kingdom',
  city: 'London',
  durationText: '3 years',
  duration: null,
  tuitionText: '$12,000/year',
  tuitionAmount: {
    min: 12_000,
    max: 12_000,
    currency: 'USD',
    currencyStatus: 'known',
  },
  tuitionPeriod: 'annual',
  source: source('programme', 'programme-1'),
});

const university = (): MatchingUniversityContext => ({
  id: 42,
  name: 'Example University',
  country: 'United Kingdom',
  city: 'London',
  type: null,
  tuitionText: '$12,000/year',
  livingCostText: null,
  housingText: null,
  source: source('university', '42'),
});

const application = (): MatchingApplicationContext => ({
  id: 'application-1',
  courseId: 'programme-1',
  universityId: 42,
  universityName: 'Example University',
  courseName: 'Computer Science BSc',
  courseUrl: null,
  degreeLevel: 'undergraduate',
  subject: 'Computer Science',
  studyMode: 'full-time',
  intake: 'September 2027',
  country: 'United Kingdom',
  deadline: null,
  status: 'draft',
  createdAt: null,
  updatedAt: null,
  source: source('application', 'application-1'),
});

const student = (
  overrides: Partial<MatchingStudentContext> = {},
): MatchingStudentContext => ({
  userId: 'user-1',
  profileId: 'profile-1',
  profileVersion: '1',
  nationality: 'Vietnamese',
  preferredCountries: ['United Kingdom'],
  targetSubjects: ['Computer Science'],
  studyLevel: 'undergraduate',
  budgetRange: null,
  tuitionBudgetUsd: '20000',
  fundingPreference: 'need',
  targetIntake: 'September 2027',
  applicationCycleYear: 2027,
  preferredCities: ['London'],
  studyMode: 'full-time',
  academicBackground: 'Science',
  currentQualification: 'High school diploma',
  gradesSummary: null,
  curriculumGrades: null,
  gpaScale: '4.0',
  gpaValue: 3.5,
  predictedGrades: null,
  postgraduateAcademic: null,
  phdAcademic: null,
  careerInterests: ['software'],
  campusPreferences: 'urban',
  ...overrides,
});

const scholarship = (
  overrides: Partial<MatchingScholarshipContext> = {},
): MatchingScholarshipContext => ({
  id: 1,
  name: 'Computer Science Scholarship',
  scope: 'provider',
  country: 'United Kingdom',
  provider: 'Test Provider',
  fundingType: ['need'],
  coverage: 'Tuition support',
  eligibility: 'Vietnamese citizens; students majoring in Computer Science; undergraduate students',
  appliesToText: null,
  conditions: null,
  deadline: 'rolling',
  sourceUrl: 'https://example.test/scholarship',
  raw: {
    programme_ids: ['programme-1'],
    intake: 'September 2027',
    study_mode: 'full-time',
  },
  universityIds: [42],
  universityCountries: ['United Kingdom'],
  normalizedBenefits: benefits,
  source: source('scholarship-catalogue', '1'),
  benefits: [],
  ...overrides,
});

const selection = (
  overrides: Partial<ScholarshipMatchingContext['selection']> = {},
): ScholarshipMatchingContext['selection'] => ({
  requestedApplicationId: null,
  requestedProgrammeId: 'programme-1',
  requestedUniversityId: 42,
  application: application(),
  programme: programme(),
  university: university(),
  ...overrides,
});

function savedUniversity(universityId: number): SavedUniversitySource {
  return {
    id: `saved-${universityId}`,
    universityId,
    status: 'active',
    addedAt: '2027-01-01T00:00:00.000Z',
    updatedAt: '2027-01-01T00:00:00.000Z',
    university: universityId === 42 ? university() : null,
    source: source('saved-university', `saved-${universityId}`),
  };
}

function context(
  studentOverrides: Partial<MatchingStudentContext> = {},
  scholarshipOverrides: Partial<MatchingScholarshipContext> = {},
  selectionOverrides: Partial<ScholarshipMatchingContext['selection']> = {},
  savedUniversities: readonly SavedUniversitySource[] | null = [],
): ScholarshipMatchingContext {
  const currentScholarship = scholarship(scholarshipOverrides);
  return {
    contextVersion: 'scholarship-matching-context-v2',
    cache: {
      scope: 'user',
      key: 'user-fit-test',
      userId: 'user-1',
      profileVersion: '1',
    },
    student: student(studentOverrides),
    academicEvidence,
    savedUniversities,
    selection: selection(selectionOverrides),
    scholarships: [currentScholarship],
    sourceStatus: {
      profile: 'present',
      evidence: 'present',
      savedUniversities: savedUniversities == null ? 'unavailable' : 'present',
      applications: 'present',
      programmes: 'present',
      universities: 'present',
      scholarships: 'present',
    },
    diagnostics: [],
  };
}

function eligibilityFor(
  currentContext: ScholarshipMatchingContext,
): ScholarshipEligibilityResult {
  const currentScholarship = currentContext.scholarships[0]!;
  return evaluateScholarshipEligibility({
    context: currentContext,
    scholarship: currentScholarship,
    policy: { asOf: '2027-01-15T00:00:00.000Z' },
  });
}

function fitFor(
  studentOverrides: Partial<MatchingStudentContext> = {},
  scholarshipOverrides: Partial<MatchingScholarshipContext> = {},
  selectionOverrides: Partial<ScholarshipMatchingContext['selection']> = {},
  savedUniversities: readonly SavedUniversitySource[] | null = [],
  policy?: PersonalFitPolicy,
): PersonalFitResult {
  const currentContext = context(
    studentOverrides,
    scholarshipOverrides,
    selectionOverrides,
    savedUniversities,
  );
  const currentScholarship = currentContext.scholarships[0]!;
  return scorePersonalFit({
    context: currentContext,
    scholarship: currentScholarship,
    eligibility: eligibilityFor(currentContext),
    ...(policy ? { policy } : {}),
  });
}

describe('deterministic scholarship personal fit', () => {
  it('returns the same result for the same context and policy', () => {
    const first = fitFor();
    const second = fitFor();

    expect(first).toEqual(second);
    expect(first.fitStatus).toBe('SCORED');
    expect(first.score).not.toBeNull();
  });

  it('rewards a preferred-country match and explains a contradiction', () => {
    const match = fitFor();
    const mismatch = fitFor({}, { country: 'Canada', universityCountries: ['Canada'] });

    expect(match.score!).toBeGreaterThan(mismatch.score!);
    expect(match.reasonCodes).toContain('preferred-country-match');
    expect(mismatch.reasonCodes).toContain('preferred-country-mismatch');
  });

  it('uses one selected-or-saved university signal without requiring both', () => {
    const selected = fitFor({}, { scope: 'provider' });
    const noUniversityFact = fitFor({}, { scope: 'provider', universityIds: [] });

    expect(selected.score!).toBeGreaterThan(noUniversityFact.score!);
    expect(selected.reasonCodes).toContain('selected-university-match');
    expect(noUniversityFact.reasonCodes).not.toContain('selected-university-match');
  });

  it('rewards structured subject and study-level alignment', () => {
    const subjectMatch = fitFor();
    const subjectUnknown = fitFor({}, {
      eligibility: 'Vietnamese citizens; undergraduate students',
    });
    const degreeMatch = fitFor();
    const degreeUnknown = fitFor({}, {
      eligibility: 'Vietnamese citizens; students majoring in Computer Science',
    });

    expect(subjectMatch.score!).toBeGreaterThan(subjectUnknown.score!);
    expect(subjectMatch.reasonCodes).toContain('subject-match');
    expect(degreeMatch.score!).toBeGreaterThan(degreeUnknown.score!);
    expect(degreeMatch.reasonCodes).toContain('study-level-match');
  });

  it('rewards intake alignment when the scholarship publishes a structured cycle', () => {
    const match = fitFor();
    const missing = fitFor({}, {
      raw: { study_mode: 'full-time' },
    });

    expect(match.score!).toBeGreaterThan(missing.score!);
    expect(match.reasonCodes).toContain('intake-match');
    expect(missing.missingSignals).toContain('intake');
  });

  it('scores funding preference and budget alignment independently', () => {
    const fundingMatch = fitFor();
    const fundingMismatch = fitFor({}, { fundingType: ['merit'] });
    const budgetMatch = fitFor();
    const budgetMismatch = fitFor({}, {}, {
      programme: {
        ...programme(),
        tuitionAmount: {
          min: 50_000,
          max: 50_000,
          currency: 'USD',
          currencyStatus: 'known',
        },
      },
    });

    expect(fundingMatch.score!).toBeGreaterThan(fundingMismatch.score!);
    expect(fundingMismatch.reasonCodes).toContain('funding-preference-mismatch');
    expect(budgetMatch.score!).toBeGreaterThan(budgetMismatch.score!);
    expect(budgetMismatch.reasonCodes).toContain('budget-misaligned');
  });

  it('keeps full tuition separate from a full-ride funding preference', () => {
    const tuitionOnlyBenefits: NormalizedScholarshipBenefits = {
      ...benefits,
      classification: {
        ...benefits.classification,
        label: 'tuition-only',
        tuitionCoverage: 'full',
      },
    };
    const fullRidePreference = fitFor(
      { fundingPreference: 'full-ride' },
      { fundingType: ['full-ride'], normalizedBenefits: tuitionOnlyBenefits },
    );
    const fullTuitionPreference = fitFor(
      { fundingPreference: 'full-tuition' },
      { fundingType: ['full tuition'], normalizedBenefits: tuitionOnlyBenefits },
    );

    expect(fullRidePreference.reasonCodes).toContain('funding-preference-mismatch');
    expect(fullRidePreference.reasonCodes).not.toContain('funding-preference-match');
    expect(fullTuitionPreference.reasonCodes).toContain('funding-preference-match');
  });

  it('uses the selected programme before profile subject and degree preferences', () => {
    const result = fitFor({
      targetSubjects: ['History'],
      studyLevel: 'postgraduate',
    });
    const subjectReason = result.reasonData.find((item) => item.signal === 'subject');
    const degreeReason = result.reasonData.find((item) => item.signal === 'study-level');

    expect(result.fitStatus).toBe('SCORED');
    expect(result.reasonCodes).toContain('subject-match');
    expect(result.reasonCodes).toContain('study-level-match');
    expect(subjectReason?.preference).toEqual(['Computer Science']);
    expect(degreeReason?.preference).toBe('undergraduate');
  });

  it('does not manufacture positive matches from missing profile signals', () => {
    const result = fitFor(
      {
        preferredCountries: null,
        targetSubjects: null,
        studyLevel: null,
        budgetRange: null,
        tuitionBudgetUsd: null,
        fundingPreference: null,
        targetIntake: null,
        applicationCycleYear: null,
        studyMode: null,
        gpaValue: null,
      },
      {
        scope: 'provider',
        universityIds: [],
        eligibility: 'International students',
        raw: {},
      },
      {
        requestedApplicationId: null,
        requestedProgrammeId: null,
        requestedUniversityId: null,
        application: null,
        programme: null,
        university: null,
      },
    );

    expect(result.fitStatus).toBe('SCORED');
    expect(result.score).toBe(0);
    expect(result.reasonCodes).not.toContain('preferred-country-match');
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'missing-profile-signal' }));
  });

  it('keeps contradictory preferences as soft mismatches', () => {
    const result = fitFor({
      preferredCountries: ['Canada'],
      fundingPreference: 'merit',
    });

    expect(result.fitStatus).toBe('SCORED');
    expect(result.reasonCodes).toContain('preferred-country-mismatch');
    expect(result.reasonCodes).toContain('funding-preference-mismatch');
  });

  it('does not double-count a selected university that is also saved', () => {
    const selectedOnly = fitFor();
    const selectedAndSaved = fitFor({}, {}, {}, [savedUniversity(42)]);

    expect(selectedAndSaved.score).toBe(selectedOnly.score);
    expect(selectedAndSaved.reasonCodes).toContain('selected-university-match');
    expect(selectedAndSaved.reasonCodes).not.toContain('saved-university-match');
  });

  it('cannot promote an ineligible scholarship with a perfect soft fit', () => {
    const result = fitFor({}, {
      eligibility: 'Canadian citizens only; students majoring in Computer Science; undergraduate students',
    });

    expect(result.eligibilityStatus).toBe('INELIGIBLE');
    expect(result.fitStatus).toBe('INELIGIBLE');
    expect(result.score).toBeNull();
    expect(result.reasonCodes).toEqual(['eligibility-ineligible']);
  });

  it('keeps UNKNOWN eligibility explicitly uncertain', () => {
    const result = fitFor({ nationality: null }, {
      eligibility: 'Vietnamese citizens only; students majoring in Computer Science; undergraduate students',
    });

    expect(result.eligibilityStatus).toBe('UNKNOWN');
    expect(result.fitStatus).toBe('UNKNOWN');
    expect(result.score).toBeNull();
    expect(result.missingSignals).toContain('eligibility');
  });

  it('changes scores only through the supplied versioned policy weights', () => {
    const candidate = { country: 'Canada', universityCountries: ['Canada'] };
    const baseline = fitFor({}, candidate);
    const policy: PersonalFitPolicy = {
      ...DEFAULT_PERSONAL_FIT_POLICY,
      version: 'scholarship-personal-fit-test-v2',
      weights: {
        ...DEFAULT_PERSONAL_FIT_POLICY.weights,
        preferredCountry: 30,
      },
    };
    const changed = fitFor({}, candidate, {}, [], policy);

    expect(changed.policyVersion).toBe('scholarship-personal-fit-test-v2');
    expect(changed.score!).toBeLessThan(baseline.score!);
  });

  it('ignores an injected LLM score and uses only deterministic inputs', () => {
    const currentContext = context();
    const currentScholarship = currentContext.scholarships[0]!;
    const input = {
      context: currentContext,
      scholarship: currentScholarship,
      eligibility: eligibilityFor(currentContext),
    };
    const baseline = scorePersonalFit(input);
    const withLlm = scorePersonalFit({
      ...input,
      llmScore: 100,
    } as typeof input);

    expect(withLlm).toEqual(baseline);
  });
});
