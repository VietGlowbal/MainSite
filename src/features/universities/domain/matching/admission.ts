import { MATCHING_MODEL_V1 } from './config';
import type {
  AdmissionResult,
  MatchFactorResult,
  MatchingProgrammeCandidate,
  StudentMatchingProfile,
} from './types';

const clamp = (value: number) => Math.min(100, Math.max(0, value));

function scaleMaximum(scale: string, minimum: number): number {
  const values = scale.match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) ?? [];
  const maximum = values.length > 0 ? Math.max(...values) : minimum;
  return maximum > minimum ? maximum : minimum + 1;
}

type StudyLevelKind = 'bachelor' | 'master' | 'phd';

/**
 * Profile and catalogue values use different labels for the same level.
 * Keep this normalization local to the scorer so the raw source values remain
 * available for display and auditing.
 */
function studyLevelKind(value: string): StudyLevelKind | null {
  const normalized = value.trim().toLowerCase().replace(/[’']/g, '');
  if (normalized.includes('undergraduate') || normalized.includes('bachelor')) return 'bachelor';
  if (normalized.includes('postgraduate') || normalized.includes('master')) return 'master';
  if (normalized.includes('phd') || normalized.includes('doctor')) return 'phd';
  return null;
}

function factor(
  key: string, configuredWeight: number, partial: Omit<MatchFactorResult, 'key' | 'configuredWeight'>,
): MatchFactorResult {
  return { key, configuredWeight, ...partial };
}

function gpaFactor(profile: StudentMatchingProfile, candidate: MatchingProgrammeCandidate): MatchFactorResult {
  const requirement = candidate.gpaRequirement;
  if (!requirement) return factor('gpa', MATCHING_MODEL_V1.admission.gpa, { status: 'unknown', score: null, evidence: [], reasons: [], limitations: ['No usable GPA requirement is available.'] });
  if (!profile.gpa) return factor('gpa', MATCHING_MODEL_V1.admission.gpa, { status: 'unknown', score: null, evidence: [requirement.evidence], reasons: [], limitations: ['Your GPA is not available.'] });
  if (profile.gpa.scale !== requirement.scale) return factor('gpa', MATCHING_MODEL_V1.admission.gpa, { status: 'incompatible', score: null, evidence: [profile.gpa.evidence, requirement.evidence], reasons: [], limitations: ['GPA scales are incompatible; GlowBal does not infer conversions.'] });

  const score = profile.gpa.value < requirement.minimum
    ? 0
    : requirement.typicalLow !== undefined
      ? profile.gpa.value >= (requirement.typicalHigh ?? requirement.typicalLow) ? 100 : clamp(60 + ((profile.gpa.value - requirement.minimum) / Math.max(0.01, requirement.typicalLow - requirement.minimum)) * 25)
      : clamp(60 + ((profile.gpa.value - requirement.minimum) / Math.max(0.01, scaleMaximum(requirement.scale, requirement.minimum) - requirement.minimum)) * 40);
  return factor('gpa', MATCHING_MODEL_V1.admission.gpa, {
    status: 'scored', score, evidence: [profile.gpa.evidence, requirement.evidence],
    reasons: [profile.gpa.value >= requirement.minimum ? 'Your GPA meets the available minimum requirement.' : 'Your GPA is below the available minimum requirement.'],
    limitations: requirement.typicalLow === undefined ? ['Only a minimum GPA is available; no typical competitive range was supplied.'] : [],
  });
}

function testFactor(profile: StudentMatchingProfile, candidate: MatchingProgrammeCandidate): MatchFactorResult {
  if (candidate.testRequirements.length === 0) return factor('tests', MATCHING_MODEL_V1.admission.tests, { status: 'unknown', score: null, evidence: [], reasons: [], limitations: ['No usable programme test requirements are available.'] });
  const scores: number[] = [];
  const evidence = [] as MatchFactorResult['evidence'];
  for (const requirement of candidate.testRequirements) {
    const student = [...profile.englishTests, ...profile.standardizedTests].find((test) => test.testType.trim().toLowerCase() === requirement.testType.trim().toLowerCase());
    if (!student) continue;
    evidence.push(student.evidence, requirement.evidence);
    const overallPasses = requirement.minimum <= 0 || student.score >= requirement.minimum;
    const subscoreEntries = Object.entries(requirement.subscores ?? {});
    if (subscoreEntries.some(([key]) => student.subscores?.[key] === undefined)) continue;
    const subscoresPass = subscoreEntries.every(([key, minimum]) => (student.subscores?.[key] ?? Number.NEGATIVE_INFINITY) >= minimum);
    const passes = overallPasses && subscoresPass;
    scores.push(!passes ? 0 : requirement.minimum <= 0 ? 100 : clamp(60 + ((student.score - requirement.minimum) / Math.max(1, requirement.minimum)) * 40));
  }
  if (scores.length === 0) return factor('tests', MATCHING_MODEL_V1.admission.tests, { status: 'unknown', score: null, evidence, reasons: [], limitations: ['No student test result is safely comparable with the available requirements.'] });
  return factor('tests', MATCHING_MODEL_V1.admission.tests, { status: 'scored', score: scores.reduce((sum, value) => sum + value, 0) / scores.length, evidence, reasons: ['Available test scores were compared with stated minima.'], limitations: ['Optional-versus-required semantics may be incomplete in current crawler data.'] });
}

function selectivityFactor(candidate: MatchingProgrammeCandidate): MatchFactorResult {
  if (!candidate.selectivity) return factor('selectivity', MATCHING_MODEL_V1.admission.selectivity, { status: 'unknown', score: null, evidence: [], reasons: [], limitations: ['No programme or university selectivity evidence is available.'] });
  return factor('selectivity', MATCHING_MODEL_V1.admission.selectivity, { status: 'scored', score: candidate.selectivity.score, evidence: [candidate.selectivity.evidence], reasons: [candidate.selectivity.reason], limitations: candidate.selectivity.evidence.scope === 'university' ? ['This is a university-level selectivity proxy, not a programme acceptance rate.'] : [] });
}

function prerequisiteFactor(profile: StudentMatchingProfile, candidate: MatchingProgrammeCandidate): MatchFactorResult {
  const requirement = candidate.subjectPrerequisites;
  if (!requirement) return factor('prerequisites', MATCHING_MODEL_V1.admission.prerequisites, { status: 'unknown', score: null, evidence: candidate.prerequisiteEvidence, reasons: [], limitations: ['No usable normalized prerequisite coverage is available.'] });
  if (!['structured', 'rule_validated', 'human_verified'].includes(requirement.evidence.reliability)) {
    return factor('prerequisites', MATCHING_MODEL_V1.admission.prerequisites, { status: 'unknown', score: null, evidence: [requirement.evidence], reasons: [], limitations: ['Unverified prerequisite evidence remains unknown.'] });
  }
  const studentSubjects = (profile.academicSubjects ?? []).map((value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).filter(Boolean);
  const requiredSubjects = requirement.requiredSubjects.map((value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).filter(Boolean);
  if (studentSubjects.length === 0) return factor('prerequisites', MATCHING_MODEL_V1.admission.prerequisites, { status: 'unknown', score: null, evidence: [requirement.evidence], reasons: [], limitations: ['Your prior subject background is not available.'] });
  if (requiredSubjects.length === 0) return factor('prerequisites', MATCHING_MODEL_V1.admission.prerequisites, { status: 'scored', score: 100, evidence: [requirement.evidence], reasons: ['The verified programme fact states no specific subject prerequisites.'], limitations: [] });
  const matched = requiredSubjects.filter((subject) => studentSubjects.some((item) => item === subject || item.includes(subject) || subject.includes(item)));
  const score = (matched.length / requiredSubjects.length) * 100;
  return factor('prerequisites', MATCHING_MODEL_V1.admission.prerequisites, { status: 'scored', score, evidence: [requirement.evidence], reasons: [`Verified subject prerequisites matched ${matched.length} of ${requiredSubjects.length} stated subjects.`], limitations: matched.length === requiredSubjects.length ? [] : ['Some normalized subject prerequisites are not present in the available student background.'] });
}

function otherFactor(profile: StudentMatchingProfile, candidate: MatchingProgrammeCandidate): MatchFactorResult {
  if (!profile.studyLevel || !candidate.degreeLevel) return factor('other', MATCHING_MODEL_V1.admission.other, { status: 'unknown', score: null, evidence: [], reasons: [], limitations: ['Study-level compatibility cannot be determined.'] });
  const wanted = studyLevelKind(profile.studyLevel);
  const degree = studyLevelKind(candidate.degreeLevel);
  if (!wanted || !degree) return factor('other', MATCHING_MODEL_V1.admission.other, { status: 'unknown', score: null, evidence: [], reasons: [], limitations: ['Study-level labels are not comparable.'] });
  const aligned = wanted === degree;
  return factor('other', MATCHING_MODEL_V1.admission.other, { status: 'scored', score: aligned ? 100 : 0, evidence: [], reasons: [aligned ? 'The programme degree level matches your stated target level.' : 'The programme degree level differs from your stated target level.'], limitations: [] });
}

export function evaluateAdmission(profile: StudentMatchingProfile, candidate: MatchingProgrammeCandidate): AdmissionResult {
  const factors = [gpaFactor(profile, candidate), testFactor(profile, candidate), prerequisiteFactor(profile, candidate), selectivityFactor(candidate), otherFactor(profile, candidate)];
  const availableWeight = factors.filter((item) => item.status === 'scored').reduce((sum, item) => sum + item.configuredWeight, 0);
  const totalWeight = factors.reduce((sum, item) => sum + item.configuredWeight, 0);
  const coverage = availableWeight / totalWeight;
  const score = availableWeight === 0 ? null : factors.filter((item) => item.status === 'scored').reduce((sum, item) => sum + (item.score ?? 0) * item.configuredWeight, 0) / availableWeight;
  const rankingSignal = score === null ? MATCHING_MODEL_V1.ranking.neutralAdmission : MATCHING_MODEL_V1.ranking.neutralAdmission + (score - MATCHING_MODEL_V1.ranking.neutralAdmission) * coverage;
  const tier = score === null || coverage < MATCHING_MODEL_V1.tier.minCoverage ? null : score >= MATCHING_MODEL_V1.tier.strongChanceMin ? 'strong_chance' : score >= MATCHING_MODEL_V1.tier.targetMin ? 'target' : 'reach';
  return { score, coverage, rankingSignal, tier, assessmentStatus: score === null ? 'insufficient_data' : tier ? 'complete' : 'partial', factors, limitations: factors.flatMap((item) => item.limitations) };
}
