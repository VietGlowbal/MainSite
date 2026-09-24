import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeScholarshipBenefits } from '../../domain/benefit-normalization';
import type {
  MatchingAcademicEvidence,
  MatchingApplicationSource,
  MatchingProgrammeSource,
  MatchingProfileSource,
  MatchingProvenance,
  MatchingRead,
  MatchingScholarshipSource,
  MatchingUniversitySource,
  SavedUniversitySource,
} from '../../domain/matching-context';
import {
  loadScholarshipMatchingContext,
  type ScholarshipMatchingContextRepository,
} from '../matching-context-loader';

const source = (sourceKind: MatchingProvenance['sourceKind'], recordId: string | null): MatchingProvenance => ({
  sourceKind,
  recordId,
  sourceUrl: null,
  sourceField: null,
  retrievedAt: null,
});

const present = <T>(value: T): MatchingRead<T> => ({ value, status: 'present', message: null });

const profile: MatchingProfileSource = {
  id: 'profile-1',
  profileVersion: '2',
  nationality: 'Vietnamese',
  preferredCountries: ['GB'],
  targetSubjects: ['Computer Science'],
  studyLevel: 'undergraduate',
  budgetRange: null,
  tuitionBudgetUsd: null,
  fundingPreference: 'need',
  targetIntake: 'autumn-2027',
  applicationCycleYear: 2027,
  preferredCities: null,
  studyMode: null,
  academicBackground: null,
  currentQualification: null,
  gradesSummary: null,
  curriculumGrades: null,
  gpaScale: null,
  gpaValue: null,
  predictedGrades: null,
  postgraduateAcademic: null,
  phdAcademic: null,
  careerInterests: null,
  campusPreferences: null,
  source: source('student-profile', 'profile-1'),
};

const evidence: MatchingAcademicEvidence = {
  achievements: [],
  activities: [],
  englishTests: [],
  standardizedTests: [],
};

const application: MatchingApplicationSource = {
  id: 'application-1',
  courseId: 'programme-1',
  universityId: 7,
  universityName: 'Example University',
  courseName: 'BSc Computing',
  courseUrl: 'https://example.test/course',
  degreeLevel: 'undergraduate',
  subject: 'Computer Science',
  studyMode: 'full-time',
  intake: 'autumn-2027',
  country: 'United Kingdom',
  deadline: '2027-01-01',
  status: 'researching',
  createdAt: null,
  updatedAt: null,
  source: source('application', 'application-1'),
};

const programme: MatchingProgrammeSource = {
  id: 'programme-1',
  universityId: 7,
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
};

const university: MatchingUniversitySource = {
  id: 7,
  name: 'Example University',
  country: 'United Kingdom',
  city: null,
  type: 'public',
  tuitionText: '£20,000',
  livingCostText: null,
  housingText: null,
  source: source('university', '7'),
};

const saved: SavedUniversitySource = {
  id: 'saved-1',
  universityId: 7,
  status: 'interested',
  addedAt: null,
  updatedAt: null,
  university,
  source: source('saved-university', 'saved-1'),
};

const scholarship: MatchingScholarshipSource = {
  id: 11,
  name: 'Example Scholarship',
  scope: 'university',
  country: 'United Kingdom',
  provider: 'Example University',
  fundingType: ['merit'],
  coverage: '50% tuition',
  eligibility: null,
  appliesToText: null,
  conditions: null,
  deadline: null,
  sourceUrl: 'https://example.test/scholarship',
  raw: { coverage: '50% tuition' },
  universityIds: [7],
  universityCountries: ['United Kingdom'],
  normalizedBenefits: normalizeScholarshipBenefits({
    coverage: '50% tuition',
    fundingType: ['merit'],
    sourceUrl: 'https://example.test/scholarship',
    raw: { coverage: '50% tuition' },
  }),
  source: source('scholarship-catalogue', '11'),
};

function repository(): ScholarshipMatchingContextRepository {
  return {
    readProfile: vi.fn(async () => present(profile)),
    readEvidence: vi.fn(async () => present(evidence)),
    readSavedUniversities: vi.fn(async () => present([saved])),
    readApplications: vi.fn(async () => present([application])),
    readProgrammes: vi.fn(async () => present([programme])),
    readUniversities: vi.fn(async () => present([university])),
    readScholarships: vi.fn(async () => present([scholarship])),
  };
}

describe('loadScholarshipMatchingContext', () => {
  it('composes normalized sources into one versioned context', async () => {
    const sources = repository();
    const context = await loadScholarshipMatchingContext({
      supabase: {} as SupabaseClient,
      request: {
        userId: 'user-1',
        scholarshipIds: [11],
        applicationId: 'application-1',
      },
      sources,
    });

    expect(context.student.userId).toBe('user-1');
    expect(context.selection.programme?.tuitionAmount).toEqual(programme.tuitionAmount);
    expect(context.selection.programme?.duration).toEqual(programme.duration);
    expect(context.selection.programme?.city).toBe('London');
    expect(context.selection.university?.country).toBe('United Kingdom');
    expect(context.savedUniversities?.map((row) => row.universityId)).toEqual([7]);
    expect(context.scholarships[0]?.benefits[0]?.percentage?.min).toBe(50);
  });

  it('loads each variable-size source as one batch and does not create per-candidate reads', async () => {
    const sources = repository();
    await loadScholarshipMatchingContext({
      supabase: {} as SupabaseClient,
      request: { userId: 'user-1', scholarshipIds: [11, 12, 13], applicationId: 'application-1' },
      sources,
    });

    expect(sources.readProfile).toHaveBeenCalledTimes(1);
    expect(sources.readEvidence).toHaveBeenCalledTimes(1);
    expect(sources.readSavedUniversities).toHaveBeenCalledTimes(1);
    expect(sources.readApplications).toHaveBeenCalledTimes(1);
    expect(sources.readProgrammes).toHaveBeenCalledTimes(1);
    expect(sources.readUniversities).toHaveBeenCalledTimes(1);
    expect(sources.readScholarships).toHaveBeenCalledTimes(1);
    expect(sources.readScholarships).toHaveBeenCalledWith([11, 12, 13]);
  });

  it('does not infer a selected application when no selector is provided', async () => {
    const sources = repository();
    const context = await loadScholarshipMatchingContext({
      supabase: {} as SupabaseClient,
      request: { userId: 'user-1', scholarshipIds: [11] },
      sources,
    });

    expect(sources.readApplications).toHaveBeenCalledWith({
      userId: 'user-1',
      applicationId: null,
      selectedProgrammeId: null,
    });
    expect(context.selection.application).toBeNull();
    expect(context.selection.programme).toBeNull();
    expect(context.selection.university).toBeNull();
  });
});
