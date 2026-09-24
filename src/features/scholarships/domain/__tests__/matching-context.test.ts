import { describe, expect, it } from 'vitest';
import type { NormalizedScholarshipBenefits } from '../benefit-types';
import {
  buildScholarshipMatchingContext,
  scholarshipMatchingContextCacheKey,
  SCHOLARSHIP_MATCHING_CONTEXT_VERSION,
  type MatchingContextSources,
  type MatchingProfileSource,
  type MatchingProvenance,
} from '../matching-context';

const source = (sourceKind: MatchingProvenance['sourceKind'], recordId: string | null): MatchingProvenance => ({
  sourceKind,
  recordId,
  sourceUrl: null,
  sourceField: null,
  retrievedAt: null,
});

const read = <T>(value: T, status: 'present' | 'missing' | 'unavailable' = 'present') => ({
  value,
  status,
  message: null,
});

const profile = (overrides: Partial<MatchingProfileSource> = {}): MatchingProfileSource => ({
  id: 'profile-1',
  profileVersion: '7',
  nationality: 'Vietnamese',
  preferredCountries: ['GB'],
  targetSubjects: ['Computer Science'],
  studyLevel: 'undergraduate',
  budgetRange: 'under-20000',
  tuitionBudgetUsd: null,
  fundingPreference: 'need',
  targetIntake: 'autumn-2027',
  applicationCycleYear: 2027,
  preferredCities: ['London'],
  studyMode: 'full-time',
  academicBackground: 'Science high school',
  currentQualification: 'High school diploma',
  gradesSummary: { gpa: '3.8' },
  curriculumGrades: null,
  gpaScale: '4.0',
  gpaValue: 3.8,
  predictedGrades: null,
  postgraduateAcademic: null,
  phdAcademic: null,
  careerInterests: ['software'],
  campusPreferences: 'urban',
  source: source('student-profile', 'profile-1'),
  ...overrides,
});

const benefits: NormalizedScholarshipBenefits = {
  components: [
    {
      type: 'tuition',
      coverage: 'full',
      valueKind: 'coverage',
      amount: null,
      percentage: null,
      period: 'unspecified',
      duration: null,
      scenarioKey: null,
      mutuallyExclusive: false,
      evidence: [{
        sourceType: 'catalogue-field',
        sourceField: 'coverage',
        excerpt: 'Full tuition',
        sourceUrl: 'https://example.test/scholarship',
      }],
      confidence: 'high',
    },
  ],
  scenarios: [],
  classification: {
    label: 'tuition-only',
    tuitionCoverage: 'full',
    fullRideStatus: 'not-claimed',
    fullRideClaimed: false,
    fullyFundedClaimed: false,
    nonTuitionTypes: [],
  },
  raw: {
    coverage: 'Full tuition',
    amountMin: null,
    amountMax: null,
    amountCurrency: null,
    fundingType: [],
    sourceUrl: 'https://example.test/scholarship',
    fields: { coverage: 'Full tuition' },
  },
  warnings: [],
};

function emptySources(overrides: Partial<MatchingContextSources> = {}): MatchingContextSources {
  return {
    profile: read(profile()),
    evidence: read({
      achievements: [],
      activities: [],
      englishTests: [],
      standardizedTests: [],
    }),
    savedUniversities: read([]),
    applications: read([]),
    programmes: read([]),
    universities: read([]),
    scholarships: read([]),
    ...overrides,
  };
}

describe('canonical scholarship matching context', () => {
  it('assembles complete student, application, programme, university, saved, and scholarship facts', () => {
    const context = buildScholarshipMatchingContext(
      {
        userId: 'user-1',
        scholarshipIds: [9],
        applicationId: 'application-1',
      },
      emptySources({
        savedUniversities: read([{
          id: 'saved-1',
          universityId: 42,
          status: 'interested',
          addedAt: '2026-01-01',
          updatedAt: '2026-01-01',
          university: null,
          source: source('saved-university', 'saved-1'),
        }]),
        applications: read([{
          id: 'application-1',
          courseId: 'programme-1',
          universityId: 42,
          universityName: 'Example University',
          courseName: 'BSc Computing',
          courseUrl: 'https://example.test/course',
          degreeLevel: 'undergraduate',
          subject: 'Computer Science',
          studyMode: 'full-time',
          intake: 'autumn-2027',
          country: 'United Kingdom',
          deadline: '2027-01-15',
          status: 'researching',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          source: source('application', 'application-1'),
        }]),
        programmes: read([{
          id: 'programme-1',
          universityId: 42,
          universityName: 'Example University',
          name: 'BSc Computing',
          degreeLevel: 'undergraduate',
          subject: 'Computer Science',
          studyMode: 'full-time',
          intake: 'autumn-2027',
          country: 'United Kingdom',
          city: 'London',
          durationText: '3 years',
          duration: { count: 3, unit: 'year', rawText: '3 years' },
          tuitionText: '£20,000 per year',
          tuitionAmount: { min: 20_000, max: null, currency: 'GBP', currencyStatus: 'known' },
          tuitionPeriod: 'annual',
          source: source('programme', 'programme-1'),
        }]),
        universities: read([{
          id: 42,
          name: 'Example University',
          country: 'United Kingdom',
          city: null,
          type: 'public',
          tuitionText: '£20,000',
          livingCostText: '£1,200/month',
          housingText: 'Included in estimate',
          source: source('university', '42'),
        }]),
        scholarships: read([{
          id: 9,
          name: 'Example Award',
          scope: 'university',
          country: 'United Kingdom',
          provider: 'Example University',
          fundingType: ['merit'],
          coverage: 'Full tuition',
          eligibility: 'High achievement',
          appliesToText: 'Example University',
          conditions: null,
          deadline: '2027-01-01',
          sourceUrl: 'https://example.test/scholarship',
          raw: { coverage: 'Full tuition' },
          universityIds: [42],
          universityCountries: ['United Kingdom'],
          normalizedBenefits: benefits,
          source: source('scholarship-catalogue', '9'),
        }]),
      }),
    );

    expect(context.contextVersion).toBe(SCHOLARSHIP_MATCHING_CONTEXT_VERSION);
    expect(context.student).toMatchObject({
      userId: 'user-1',
      nationality: 'Vietnamese',
      targetSubjects: ['Computer Science'],
      fundingPreference: 'need',
    });
    expect(context.selection.application?.id).toBe('application-1');
    expect(context.selection.programme).toMatchObject({
      id: 'programme-1',
      duration: { count: 3, unit: 'year' },
      tuitionAmount: { min: 20_000, currency: 'GBP' },
    });
    expect(context.selection.university).toMatchObject({ id: 42, country: 'United Kingdom' });
    expect(context.savedUniversities?.[0]?.universityId).toBe(42);
    expect(context.scholarships[0]?.benefits).toEqual(benefits.components);
  });

  it('preserves null and unavailable signals for a partial profile', () => {
    const context = buildScholarshipMatchingContext(
      { userId: 'user-2' },
      emptySources({
        profile: { value: null, status: 'missing', message: null },
        evidence: {
          value: {
            achievements: null,
            activities: null,
            englishTests: null,
            standardizedTests: null,
          },
          status: 'unavailable',
          message: 'evidence read failed',
        },
        savedUniversities: { value: null, status: 'unavailable', message: 'saved read failed' },
      }),
    );

    expect(context.student.nationality).toBeNull();
    expect(context.student.preferredCountries).toBeNull();
    expect(context.academicEvidence.achievements).toBeNull();
    expect(context.savedUniversities).toBeNull();
    expect(context.sourceStatus).toMatchObject({
      profile: 'missing',
      evidence: 'unavailable',
      savedUniversities: 'unavailable',
    });
    expect(context.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'saved-university', status: 'unavailable' }),
    ]));
  });

  it('uses the explicitly selected programme before the application programme', () => {
    const context = buildScholarshipMatchingContext(
      {
        userId: 'user-3',
        applicationId: 'application-1',
        selectedProgrammeId: 'programme-2',
      },
      emptySources({
        applications: read([{
          id: 'application-1',
          courseId: 'programme-1',
          universityId: 1,
          universityName: 'University One',
          courseName: 'Original Course',
          courseUrl: null,
          degreeLevel: 'undergraduate',
          subject: 'History',
          studyMode: null,
          intake: null,
          country: 'Country One',
          deadline: null,
          status: 'researching',
          createdAt: null,
          updatedAt: null,
          source: source('application', 'application-1'),
        }]),
        programmes: read([
          {
            id: 'programme-1', universityId: 1, universityName: 'University One', name: 'Original Course',
            degreeLevel: 'undergraduate', subject: 'History', studyMode: null, intake: null, country: 'Country One', city: null,
            durationText: '3 years', duration: { count: 3, unit: 'year' }, tuitionText: null, tuitionAmount: null,
            tuitionPeriod: 'unspecified', source: source('programme', 'programme-1'),
          },
          {
            id: 'programme-2', universityId: 2, universityName: 'University Two', name: 'Selected Course',
            degreeLevel: 'master', subject: 'Computing', studyMode: 'full-time', intake: 'spring-2028', country: 'Country Two', city: 'City Two',
            durationText: '1 year', duration: { count: 1, unit: 'year' }, tuitionText: '€10,000/year',
            tuitionAmount: { min: 10_000, max: null, currency: 'EUR', currencyStatus: 'known' }, tuitionPeriod: 'annual',
            source: source('programme', 'programme-2'),
          },
        ]),
        universities: read([
          { id: 1, name: 'University One', country: 'Country One', city: null, type: null, tuitionText: null, livingCostText: null, housingText: null, source: source('university', '1') },
          { id: 2, name: 'University Two', country: 'Country Two', city: null, type: null, tuitionText: null, livingCostText: null, housingText: null, source: source('university', '2') },
        ]),
      }),
    );

    expect(context.selection.application?.courseId).toBe('programme-1');
    expect(context.selection.programme?.id).toBe('programme-2');
    expect(context.selection.university?.id).toBe(2);
  });

  it('keeps user cache identities isolated and versioned', () => {
    const left = scholarshipMatchingContextCacheKey({ userId: 'user-a', scholarshipIds: [2, 1] }, '4');
    const right = scholarshipMatchingContextCacheKey({ userId: 'user-b', scholarshipIds: [1, 2] }, '4');

    expect(left).toContain(SCHOLARSHIP_MATCHING_CONTEXT_VERSION);
    expect(left).toContain('user-a');
    expect(left).not.toBe(right);
  });
});
