import { MATCHING_MODEL_V1, MATCHING_MODEL_VERSION } from './config';
import { evaluateAdmission } from './admission';
import { evaluateEligibility } from './eligibility';
import { evaluatePreference } from './preference';
import type { MatchingProgrammeCandidate, RankedProgrammeMatch, StudentMatchingProfile } from './types';

export function evaluateProgrammeMatch(profile: StudentMatchingProfile, candidate: MatchingProgrammeCandidate): RankedProgrammeMatch {
  const eligibility = evaluateEligibility(profile, candidate);
  const admission = evaluateAdmission(profile, candidate);
  const preference = evaluatePreference(profile, candidate);
  const index = MATCHING_MODEL_V1.ranking.preferenceWeight * preference.rankingSignal + MATCHING_MODEL_V1.ranking.admissionWeight * admission.rankingSignal;
  const missingEvidence = [...eligibility.unknowns, ...admission.limitations, ...preference.limitations];
  return {
    programmeId: candidate.programmeId, universityId: candidate.universityId, programmeName: candidate.programmeName,
    degreeLevel: candidate.degreeLevel, normalizedField: candidate.normalizedField, country: candidate.country,
    eligibility, admission, preference,
    ranking: { index, modelVersion: MATCHING_MODEL_VERSION },
    whyMatch: preference.factors
      .filter((item) => item.status === 'scored' && (item.score ?? 0) > 0)
      .flatMap((item) => item.reasons),
    admissionStrengths: admission.factors
      .filter((item) => item.status === 'scored' && (item.score ?? 0) >= 60)
      .flatMap((item) => item.reasons),
    watchOuts: [
      ...eligibility.checks.filter((item) => item.status === 'not_met').map((item) => item.reason),
      ...admission.factors.filter((item) => item.status === 'incompatible' || (item.status === 'scored' && item.score === 0)).flatMap((item) => [...item.reasons, ...item.limitations]),
      ...preference.factors.filter((item) => item.status === 'incompatible' || (item.status === 'scored' && item.score === 0)).flatMap((item) => [...item.reasons, ...item.limitations]),
    ],
    missingEvidence,
  };
}

function eligibilityRank(status: RankedProgrammeMatch['eligibility']['status']): number {
  return status === 'eligible' ? 0 : status === 'unknown' ? 1 : 2;
}

export function rankProgrammeMatches(profile: StudentMatchingProfile, candidates: MatchingProgrammeCandidate[]): RankedProgrammeMatch[] {
  return candidates.map((candidate) => evaluateProgrammeMatch(profile, candidate)).sort((left, right) =>
    eligibilityRank(left.eligibility.status) - eligibilityRank(right.eligibility.status)
    || right.ranking.index - left.ranking.index
    || (right.preference.score ?? -1) - (left.preference.score ?? -1)
    || right.admission.coverage - left.admission.coverage
    || (right.admission.score ?? -1) - (left.admission.score ?? -1)
    || left.programmeId.localeCompare(right.programmeId),
  );
}
