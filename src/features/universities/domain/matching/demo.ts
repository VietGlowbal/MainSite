import { rankProgrammeMatches } from './ranking';
import type { MatchEvidence, MatchingProgrammeCandidate, StudentMatchingProfile } from './types';

const studentEvidence: MatchEvidence = {
  source: 'demo_student_profile',
  scope: 'student',
  field: 'profile_fixture',
  reliability: 'structured',
};

const verifiedProgrammeEvidence: MatchEvidence = {
  source: 'demo_normalized_catalogue_v2',
  scope: 'programme',
  field: 'normalized_fact',
  reliability: 'human_verified',
  note: 'Fixed fixture for the deterministic matching demo.',
};

const unverifiedProgrammeEvidence: MatchEvidence = {
  source: 'demo_normalized_catalogue_v2',
  scope: 'programme',
  field: 'source_excerpt',
  reliability: 'crawler_extracted',
  note: 'Source-excerpt fixture: informative only, never a hard eligibility failure.',
};

const demoProfile: StudentMatchingProfile = {
  studyLevel: 'Postgraduate (Masters)',
  targetSubjects: ['Computer Science'],
  preferredCountries: ['Canada'],
  preferredCities: ['Toronto'],
  budget: {
    amount: 30_000,
    currency: 'USD',
    period: 'annual',
    evidence: { ...studentEvidence, field: 'tuition_budget_usd', value: 30_000 },
  },
  gpa: {
    value: 3.8,
    scale: '4.0 scale',
    evidence: { ...studentEvidence, field: 'gpa_value', value: 3.8 },
  },
  englishTests: [{
    testType: 'ielts',
    score: 7,
    subscores: { listening: 7, reading: 7, writing: 6.5, speaking: 7 },
    evidence: { ...studentEvidence, field: 'ielts_overall', value: 7 },
  }],
  standardizedTests: [],
  academicSubjects: ['Calculus', 'Programming'],
  priorDegreeLevel: 'Bachelor',
};

const demoCandidates: MatchingProgrammeCandidate[] = [
  {
    programmeId: 'demo-verified-computer-science',
    universityId: 9001,
    programmeName: 'MSc Computer Science — Verified Fact Example',
    degreeLevel: 'master',
    normalizedField: 'computer_science',
    country: 'Canada',
    city: 'Toronto',
    characteristics: ['Research-led', 'International environment'],
    gpaRequirement: {
      minimum: 3.5,
      scale: '4.0 scale',
      mandatory: true,
      evidence: { ...verifiedProgrammeEvidence, field: 'minimum_gpa', value: 3.5 },
    },
    testRequirements: [{
      testType: 'ielts',
      minimum: 6.5,
      mandatory: true,
      evidence: { ...verifiedProgrammeEvidence, field: 'ielts_overall', value: 6.5 },
      subscores: { listening: 6, reading: 6, writing: 6, speaking: 6 },
    }],
    prerequisiteEvidence: [{ ...verifiedProgrammeEvidence, field: 'subject_prerequisites' }],
    subjectPrerequisites: {
      requiredSubjects: ['Calculus', 'Programming'],
      mandatory: true,
      evidence: { ...verifiedProgrammeEvidence, field: 'subject_prerequisites', value: ['Calculus', 'Programming'] },
    },
    selectivity: {
      score: 70,
      evidence: { ...verifiedProgrammeEvidence, field: 'admission_difficulty', value: 70 },
      reason: 'Programme-level normalized selectivity fact is verified.',
    },
    tuition: {
      amount: 25_000,
      currency: 'USD',
      period: 'annual',
      evidence: { ...verifiedProgrammeEvidence, field: 'tuition', value: 25_000 },
    },
  },
  {
    programmeId: 'demo-known-gap-data-science',
    universityId: 9002,
    programmeName: 'MSc Data Science — Known Eligibility Gap Example',
    degreeLevel: 'master',
    normalizedField: 'data_science',
    country: 'Canada',
    city: 'Vancouver',
    characteristics: ['Applied research'],
    gpaRequirement: {
      minimum: 4,
      scale: '4.0 scale',
      mandatory: true,
      evidence: { ...verifiedProgrammeEvidence, field: 'minimum_gpa', value: 4 },
    },
    testRequirements: [{
      testType: 'ielts',
      minimum: 7.5,
      mandatory: true,
      evidence: { ...verifiedProgrammeEvidence, field: 'ielts_overall', value: 7.5 },
    }],
    prerequisiteEvidence: [{ ...verifiedProgrammeEvidence, field: 'subject_prerequisites' }],
    subjectPrerequisites: {
      requiredSubjects: ['Physics'],
      mandatory: true,
      evidence: { ...verifiedProgrammeEvidence, field: 'subject_prerequisites', value: ['Physics'] },
    },
    selectivity: {
      score: 35,
      evidence: { ...verifiedProgrammeEvidence, field: 'admission_difficulty', value: 35 },
      reason: 'Programme-level normalized selectivity fact is verified.',
    },
    tuition: {
      amount: 45_000,
      currency: 'USD',
      period: 'annual',
      evidence: { ...verifiedProgrammeEvidence, field: 'tuition', value: 45_000 },
    },
  },
  {
    programmeId: 'demo-unknown-software-engineering',
    universityId: 9003,
    programmeName: 'MSc Software Engineering — Unknown Evidence Example',
    degreeLevel: 'master',
    normalizedField: 'software_engineering',
    country: 'United Kingdom',
    city: 'London',
    characteristics: [],
    gpaRequirement: null,
    testRequirements: [{
      testType: 'ielts',
      minimum: 8,
      mandatory: true,
      evidence: { ...unverifiedProgrammeEvidence, field: 'ielts_overall', value: 8 },
    }],
    prerequisiteEvidence: [{ ...unverifiedProgrammeEvidence, field: 'subject_prerequisites' }],
    subjectPrerequisites: null,
    selectivity: null,
    tuition: null,
  },
];

export function demoProgrammeMatches() {
  return rankProgrammeMatches(demoProfile, demoCandidates);
}
