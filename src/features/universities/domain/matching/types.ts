/**
 * Deterministic university-programme matching, model v1.
 *
 * These contracts deliberately keep unavailable evidence separate from a zero
 * score. Database-specific extraction belongs in the API adapter; every
 * function in this folder is pure and can be exercised with fixtures.
 */

export type EvidenceScope = 'student' | 'programme' | 'university';
export type EvidenceReliability =
  | 'structured'
  | 'rule_validated'
  | 'human_verified'
  | 'crawler_extracted'
  | 'proxy';

export type MatchEvidence = {
  source: string;
  scope: EvidenceScope;
  field: string;
  value?: unknown;
  sourceUrl?: string | null;
  reliability: EvidenceReliability;
  note?: string;
};

export type MatchFactorStatus = 'scored' | 'unknown' | 'incompatible' | 'not_applicable';

export type MatchFactorResult = {
  key: string;
  status: MatchFactorStatus;
  score: number | null;
  configuredWeight: number;
  evidence: MatchEvidence[];
  reasons: string[];
  limitations: string[];
};

export type EligibilityCheckStatus = 'met' | 'not_met' | 'unknown' | 'not_applicable';
export type EligibilityStatus = 'eligible' | 'not_eligible' | 'unknown';

export type EligibilityCheck = {
  key: string;
  status: EligibilityCheckStatus;
  mandatory: boolean;
  evidence: MatchEvidence[];
  reason: string;
  limitation?: string;
};

export type EligibilityResult = {
  status: EligibilityStatus;
  checks: EligibilityCheck[];
  reasons: string[];
  unknowns: string[];
};

export type NumericRequirement = {
  minimum: number;
  scale: string;
  typicalLow?: number;
  typicalHigh?: number;
  mandatory: boolean;
  evidence: MatchEvidence;
};

export type TestRequirement = {
  testType: string;
  minimum: number;
  mandatory: boolean;
  evidence: MatchEvidence;
  subscores?: Record<string, number>;
};

export type SubjectPrerequisiteRequirement = {
  requiredSubjects: string[];
  mandatory: boolean;
  evidence: MatchEvidence;
};

export type DegreeRequirement = {
  minimumDegree: string;
  mandatory: boolean;
  evidence: MatchEvidence;
};

export type SelectivityEvidence = {
  score: number;
  evidence: MatchEvidence;
  reason: string;
};

export type MatchingProgrammeCandidate = {
  programmeId: string;
  universityId: number;
  programmeName: string;
  degreeLevel: string | null;
  normalizedField: string | null;
  country: string | null;
  city: string | null;
  characteristics: string[];
  gpaRequirement: NumericRequirement | null;
  minimumDegree?: DegreeRequirement | null;
  testRequirements: TestRequirement[];
  prerequisiteEvidence: MatchEvidence[];
  subjectPrerequisites?: SubjectPrerequisiteRequirement | null;
  selectivity: SelectivityEvidence | null;
  tuition: {
    amount: number;
    currency: string;
    period: 'annual' | 'total' | 'unknown';
    evidence: MatchEvidence;
  } | null;
};

export type StudentMatchingProfile = {
  studyLevel: string | null;
  targetSubjects: string[];
  preferredCountries: string[];
  preferredCities: string[];
  budget: {
    amount: number;
    currency: string;
    period: 'annual';
    evidence: MatchEvidence;
  } | null;
  gpa: {
    value: number;
    scale: string;
    evidence: MatchEvidence;
  } | null;
  englishTests: Array<{ testType: string; score: number; evidence: MatchEvidence; subscores?: Record<string, number> }>;
  standardizedTests: Array<{ testType: string; score: number; evidence: MatchEvidence; subscores?: Record<string, number> }>;
  academicSubjects?: string[];
  priorDegreeLevel?: string | null;
};

export type AdmissionTierV1 = 'strong_chance' | 'target' | 'reach';

export type AdmissionResult = {
  score: number | null;
  coverage: number;
  rankingSignal: number;
  tier: AdmissionTierV1 | null;
  assessmentStatus: 'complete' | 'partial' | 'insufficient_data';
  factors: MatchFactorResult[];
  limitations: string[];
};

export type PreferenceResult = {
  score: number | null;
  coverage: number;
  rankingSignal: number;
  factors: MatchFactorResult[];
  reasons: string[];
  limitations: string[];
};

export type RankedProgrammeMatch = {
  programmeId: string;
  universityId: number;
  programmeName: string;
  degreeLevel: string | null;
  normalizedField: string | null;
  country: string | null;
  eligibility: EligibilityResult;
  admission: AdmissionResult;
  preference: PreferenceResult;
  ranking: { index: number; modelVersion: string };
  whyMatch: string[];
  admissionStrengths: string[];
  watchOuts: string[];
  missingEvidence: string[];
};
