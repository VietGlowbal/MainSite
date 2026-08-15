export { MATCHING_MODEL_V1, MATCHING_MODEL_VERSION } from './config';
export { evaluateEligibility } from './eligibility';
export { evaluateAdmission } from './admission';
export { evaluatePreference } from './preference';
export { evaluateProgrammeMatch, rankProgrammeMatches } from './ranking';
export { demoProgrammeMatches } from './demo';
export type {
  AdmissionResult,
  AdmissionTierV1,
  EligibilityResult,
  EligibilityStatus,
  MatchEvidence,
  MatchFactorResult,
  MatchingProgrammeCandidate,
  DegreeRequirement,
  PreferenceResult,
  RankedProgrammeMatch,
  SubjectPrerequisiteRequirement,
  TestRequirement,
  StudentMatchingProfile,
} from './types';
