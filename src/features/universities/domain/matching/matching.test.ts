import { describe, expect, it } from 'vitest';
import { evaluateAdmission, evaluateEligibility, evaluatePreference, MATCHING_MODEL_V1, rankProgrammeMatches } from '.';
import type { MatchEvidence, MatchingProgrammeCandidate, StudentMatchingProfile } from './types';

const studentEvidence: MatchEvidence = { source: 'fixture', scope: 'student', field: 'value', reliability: 'structured' };
const programmeEvidence: MatchEvidence = { source: 'fixture', scope: 'programme', field: 'requirement', reliability: 'structured' };

function profile(overrides: Partial<StudentMatchingProfile> = {}): StudentMatchingProfile {
  return {
    studyLevel: 'undergraduate', targetSubjects: ['Computer Science'], preferredCountries: ['Canada'], preferredCities: ['Toronto'],
    budget: { amount: 30000, currency: 'USD', period: 'annual', evidence: studentEvidence },
    gpa: { value: 3.8, scale: '4.0 scale', evidence: studentEvidence },
    englishTests: [{ testType: 'ielts', score: 7, evidence: studentEvidence }], standardizedTests: [], ...overrides,
  };
}

function candidate(overrides: Partial<MatchingProgrammeCandidate> = {}): MatchingProgrammeCandidate {
  return {
    programmeId: 'programme-a', universityId: 1, programmeName: 'Computer Science', degreeLevel: 'bachelor', normalizedField: 'computer_science', country: 'Canada', city: 'Toronto', characteristics: [],
    gpaRequirement: { minimum: 3.5, scale: '4.0 scale', mandatory: true, evidence: programmeEvidence },
    testRequirements: [{ testType: 'ielts', minimum: 6.5, mandatory: true, evidence: programmeEvidence }],
    prerequisiteEvidence: [], selectivity: { score: 60, evidence: { ...programmeEvidence, scope: 'university', reliability: 'proxy' }, reason: 'University proxy.' },
    tuition: { amount: 25000, currency: 'USD', period: 'annual', evidence: programmeEvidence }, ...overrides,
  };
}

describe('deterministic programme matching v1', () => {
  it('marks a known mandatory GPA failure not eligible', () => {
    expect(evaluateEligibility(profile({ gpa: { value: 3.2, scale: '4.0 scale', evidence: studentEvidence } }), candidate()).status).toBe('not_eligible');
  });

  it('marks a known mandatory test failure not eligible', () => {
    expect(evaluateEligibility(profile({ englishTests: [{ testType: 'ielts', score: 6, evidence: studentEvidence }] }), candidate({ gpaRequirement: null })).status).toBe('not_eligible');
  });

  it('keeps missing requirements and student evidence unknown', () => {
    expect(evaluateEligibility(profile({ gpa: null }), candidate({ gpaRequirement: null, testRequirements: [] })).status).toBe('unknown');
  });

  it('does not turn crawler-extracted requirement failure into a hard exclusion', () => {
    const extracted = { ...programmeEvidence, reliability: 'crawler_extracted' as const };
    expect(evaluateEligibility(profile({ gpa: { value: 3, scale: '4.0 scale', evidence: studentEvidence } }), candidate({ gpaRequirement: { minimum: 3.5, scale: '4.0 scale', mandatory: true, evidence: extracted } })).status).toBe('unknown');
  });

  it('keeps an absent optional test unknown rather than failing', () => {
    const result = evaluateEligibility(profile({ englishTests: [] }), candidate({ gpaRequirement: null, testRequirements: [{ testType: 'ielts', minimum: 6.5, mandatory: false, evidence: programmeEvidence }] }));
    expect(result.status).toBe('unknown');
    expect(result.checks[1]?.status).toBe('unknown');
  });

  it('does not compare incompatible GPA scales', () => {
    const result = evaluateAdmission(profile({ gpa: { value: 8.7, scale: '10.0 scale', evidence: studentEvidence } }), candidate());
    expect(result.factors.find((item) => item.key === 'gpa')?.status).toBe('incompatible');
  });

  it('normalizes the profile study-level labels used by onboarding', () => {
    const postgraduate = evaluateAdmission(
      profile({ studyLevel: 'Postgraduate (Masters)', gpa: null, englishTests: [] }),
      candidate({ degreeLevel: "Master's", gpaRequirement: null, testRequirements: [], selectivity: null }),
    );
    const doctorate = evaluateAdmission(
      profile({ studyLevel: 'PhD / Doctorate', gpa: null, englishTests: [] }),
      candidate({ degreeLevel: 'doctorate', gpaRequirement: null, testRequirements: [], selectivity: null }),
    );
    expect(postgraduate.factors.find((item) => item.key === 'other')?.score).toBe(100);
    expect(doctorate.factors.find((item) => item.key === 'other')?.score).toBe(100);
  });

  it('uses available factor weights only and preserves coverage', () => {
    const result = evaluateAdmission(profile({ englishTests: [], studyLevel: null }), candidate({ gpaRequirement: null, testRequirements: [], selectivity: { score: 95, evidence: programmeEvidence, reason: 'Fixture.' }, tuition: null }));
    expect(result.score).toBe(95);
    expect(result.coverage).toBe(0.15);
    expect(result.rankingSignal).toBeCloseTo(65.25);
    expect(result.tier).toBeNull();
    expect(result.assessmentStatus).toBe('partial');
  });

  it('returns no admission score when no factor is available', () => {
    const result = evaluateAdmission(profile({ gpa: null, englishTests: [], studyLevel: null }), candidate({ gpaRequirement: null, testRequirements: [], selectivity: null }));
    expect(result.score).toBeNull();
    expect(result.coverage).toBe(0);
    expect(result.rankingSignal).toBe(60);
  });

  it('scores country, exact normalized field, comparable budget and city separately', () => {
    const result = evaluatePreference(profile(), candidate());
    expect(result.score).toBe(100);
    expect(result.coverage).toBe(0.8);
  });

  it('marks open destinations and incompatible currency without fake scores', () => {
    const result = evaluatePreference(profile({ preferredCountries: ['Open to ideas'] }), candidate({ tuition: { amount: 25000, currency: 'GBP', period: 'annual', evidence: programmeEvidence } }));
    expect(result.factors.find((item) => item.key === 'country')?.status).toBe('not_applicable');
    expect(result.factors.find((item) => item.key === 'budget')?.status).toBe('incompatible');
  });

  it('applies tier boundaries only at sufficient coverage', () => {
    expect(evaluateAdmission(profile(), candidate({ selectivity: null, tuition: null })).tier).toBe('strong_chance');
    expect(evaluateAdmission(profile({ gpa: { value: 3.5, scale: '4.0 scale', evidence: studentEvidence } }), candidate({ selectivity: null, tuition: null })).tier).toBe('target');
  });

  it('uses the configured v1 weights and exact tier cutoffs', () => {
    expect(MATCHING_MODEL_V1.admission).toEqual({ gpa: 30, tests: 15, prerequisites: 15, selectivity: 15, other: 25 });
    expect(MATCHING_MODEL_V1.preference).toEqual({ country: 10, programme: 15, budget: 10, city: 5, characteristics: 10 });
    const boundaryProfile = profile({ studyLevel: 'undergraduate', gpa: { value: 3.5, scale: '4.0 scale', evidence: studentEvidence }, englishTests: [{ testType: 'ielts', score: 6.5, evidence: studentEvidence }] });
    const atStrongChance = evaluateAdmission(boundaryProfile, candidate({ selectivity: { score: 78.34, evidence: programmeEvidence, reason: 'Fixture.' } }));
    const belowStrongChance = evaluateAdmission(boundaryProfile, candidate({ selectivity: { score: 78.276, evidence: programmeEvidence, reason: 'Fixture.' } }));
    const targetProfile = profile({ studyLevel: null, gpa: { value: 3.5, scale: '4.0 scale', evidence: studentEvidence }, englishTests: [{ testType: 'ielts', score: 6, evidence: studentEvidence }] });
    const atTarget = evaluateAdmission(targetProfile, candidate({ selectivity: { score: 100, evidence: programmeEvidence, reason: 'Fixture.' } }));
    const belowTarget = evaluateAdmission(targetProfile, candidate({ selectivity: { score: 99.96, evidence: programmeEvidence, reason: 'Fixture.' } }));
    expect(atStrongChance.score).toBeGreaterThanOrEqual(75);
    expect(atStrongChance.tier).toBe('strong_chance');
    expect(belowStrongChance.score).toBeLessThan(75);
    expect(belowStrongChance.tier).toBe('target');
    expect(atTarget.score).toBe(55);
    expect(atTarget.tier).toBe('target');
    expect(belowTarget.score).toBeLessThan(55);
    expect(belowTarget.tier).toBe('reach');
  });

  it('sorts deterministically, puts known failures last, and lets preference lead ranking', () => {
    const matches = rankProgrammeMatches(profile(), [
      candidate({ programmeId: 'failed', gpaRequirement: { minimum: 3.9, scale: '4.0 scale', mandatory: true, evidence: programmeEvidence } }),
      candidate({ programmeId: 'low-preference', normalizedField: 'business', country: 'United Kingdom', city: 'London', selectivity: { score: 90, evidence: programmeEvidence, reason: 'Fixture.' } }),
      candidate({ programmeId: 'best-preference', selectivity: { score: 55, evidence: programmeEvidence, reason: 'Fixture.' } }),
    ]);
    expect(matches.map((match) => match.programmeId)).toEqual(['best-preference', 'low-preference', 'failed']);
  });
});
