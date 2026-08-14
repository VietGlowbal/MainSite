import type {
  EligibilityCheck,
  EligibilityResult,
  MatchingProgrammeCandidate,
  StudentMatchingProfile,
  TestRequirement,
} from './types';

const HARD_REQUIREMENT_RELIABILITY = new Set(['structured', 'rule_validated', 'human_verified']);

type StudyLevelKind = 'bachelor' | 'master' | 'phd';

function studyLevelKind(value: string): StudyLevelKind | null {
  const normalized = value.trim().toLowerCase().replace(/[â€™']/g, '');
  if (normalized.includes('undergraduate') || normalized.includes('bachelor')) return 'bachelor';
  if (normalized.includes('postgraduate') || normalized.includes('master')) return 'master';
  if (normalized.includes('phd') || normalized.includes('doctor')) return 'phd';
  return null;
}

function comparableGpa(
  profile: StudentMatchingProfile,
  candidate: MatchingProgrammeCandidate,
): EligibilityCheck {
  const requirement = candidate.gpaRequirement;
  if (!requirement) {
    return { key: 'gpa', status: 'unknown', mandatory: false, evidence: [], reason: 'No usable GPA requirement is available.' };
  }
  if (!profile.gpa) {
    return {
      key: 'gpa', status: 'unknown', mandatory: requirement.mandatory,
      evidence: [requirement.evidence], reason: 'Your GPA is not available for comparison.',
    };
  }
  if (profile.gpa.scale !== requirement.scale) {
    return {
      key: 'gpa', status: 'unknown', mandatory: requirement.mandatory,
      evidence: [profile.gpa.evidence, requirement.evidence],
      reason: 'Your GPA and this requirement use incompatible scales.',
      limitation: 'GlowBal does not infer GPA conversions.',
    };
  }
  const passed = profile.gpa.value >= requirement.minimum;
  const trustworthy = HARD_REQUIREMENT_RELIABILITY.has(requirement.evidence.reliability);
  return {
    key: 'gpa',
    status: !passed && requirement.mandatory && trustworthy ? 'not_met' : passed ? 'met' : 'unknown',
    mandatory: requirement.mandatory,
    evidence: [profile.gpa.evidence, requirement.evidence],
    reason: passed
      ? `Your GPA meets the stated minimum of ${requirement.minimum}/${requirement.scale}.`
      : trustworthy
        ? `Your GPA is below the stated minimum of ${requirement.minimum}/${requirement.scale}.`
        : 'Your GPA is below crawler-extracted evidence that needs verification.',
    ...(!passed && !trustworthy ? { limitation: 'Unverified crawler evidence cannot create a hard eligibility failure.' } : {}),
  };
}

function findTest(profile: StudentMatchingProfile, requirement: TestRequirement) {
  const wanted = requirement.testType.trim().toLowerCase();
  return [...profile.englishTests, ...profile.standardizedTests].find(
    (test) => test.testType.trim().toLowerCase() === wanted,
  );
}

function testCheck(profile: StudentMatchingProfile, requirement: TestRequirement): EligibilityCheck {
  const student = findTest(profile, requirement);
  if (!student) {
    return {
      key: `test:${requirement.testType}`, status: 'unknown', mandatory: requirement.mandatory,
      evidence: [requirement.evidence], reason: `No ${requirement.testType} result is available for comparison.`,
    };
  }
  const overallPassed = requirement.minimum <= 0 || student.score >= requirement.minimum;
  const subscoreEntries = Object.entries(requirement.subscores ?? {});
  const subscoresAvailable = subscoreEntries.every(([key]) => student.subscores?.[key] !== undefined);
  const subscoresPassed = subscoreEntries.every(([key, minimum]) => (student.subscores?.[key] ?? Number.NEGATIVE_INFINITY) >= minimum);
  const passed = overallPassed && (!subscoreEntries.length || (subscoresAvailable && subscoresPassed));
  const comparable = !subscoreEntries.length || subscoresAvailable;
  const trustworthy = HARD_REQUIREMENT_RELIABILITY.has(requirement.evidence.reliability);
  return {
    key: `test:${requirement.testType}`,
    status: !comparable ? 'unknown' : !passed && requirement.mandatory && trustworthy ? 'not_met' : passed ? 'met' : 'unknown',
    mandatory: requirement.mandatory,
    evidence: [student.evidence, requirement.evidence],
    reason: !comparable
      ? `Your ${requirement.testType} subscores are not available for comparison.`
      : passed
      ? `Your ${requirement.testType} score meets the stated minimum.`
      : trustworthy
        ? `Your ${requirement.testType} score is below the stated minimum.`
        : `${requirement.testType} evidence needs verification before it can create a hard failure.`,
    ...(!passed && !trustworthy ? { limitation: 'Unverified crawler evidence cannot create a hard eligibility failure.' } : {}),
  };
}

function minimumDegreeCheck(profile: StudentMatchingProfile, candidate: MatchingProgrammeCandidate): EligibilityCheck | null {
  if (!('minimumDegree' in candidate)) return null;
  const requirement = candidate.minimumDegree;
  if (!requirement) {
    return {
      key: 'minimum_degree', status: 'unknown', mandatory: false, evidence: [],
      reason: 'No usable normalized minimum-degree requirement is available.',
    };
  }
  if (!profile.priorDegreeLevel) {
    return {
      key: 'minimum_degree', status: 'unknown', mandatory: requirement.mandatory,
      evidence: [requirement.evidence], reason: 'Your prior degree level is not available for comparison.',
    };
  }
  const wanted = studyLevelKind(profile.priorDegreeLevel);
  const minimum = studyLevelKind(requirement.minimumDegree);
  if (!wanted || !minimum) {
    return {
      key: 'minimum_degree', status: 'unknown', mandatory: requirement.mandatory,
      evidence: [requirement.evidence], reason: 'The prior degree and minimum-degree labels are not comparable.',
      limitation: 'GlowBal does not infer degree equivalencies from unrecognized labels.',
    };
  }
  const order: Record<StudyLevelKind, number> = { bachelor: 1, master: 2, phd: 3 };
  const passed = order[wanted] >= order[minimum];
  const trustworthy = HARD_REQUIREMENT_RELIABILITY.has(requirement.evidence.reliability);
  return {
    key: 'minimum_degree',
    status: !passed && requirement.mandatory && trustworthy ? 'not_met' : passed ? 'met' : 'unknown',
    mandatory: requirement.mandatory,
    evidence: [requirement.evidence],
    reason: passed ? 'Your prior degree meets the normalized minimum-degree requirement.' : trustworthy ? 'Your prior degree is below the normalized minimum-degree requirement.' : 'The minimum-degree evidence needs verification before it can create a hard failure.',
    ...(!passed && !trustworthy ? { limitation: 'Unverified normalized evidence cannot create a hard eligibility failure.' } : {}),
  };
}

function normalizedSubject(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function prerequisiteCheck(profile: StudentMatchingProfile, candidate: MatchingProgrammeCandidate): EligibilityCheck | null {
  if (!('subjectPrerequisites' in candidate)) return null;
  const requirement = candidate.subjectPrerequisites;
  if (!requirement) {
    return {
      key: 'subject_prerequisites', status: 'unknown', mandatory: false,
      evidence: candidate.prerequisiteEvidence,
      reason: 'No usable normalized subject-prerequisite fact is available.',
    };
  }
  const studentSubjects = (profile.academicSubjects ?? []).map(normalizedSubject).filter(Boolean);
  if (studentSubjects.length === 0) {
    return {
      key: 'subject_prerequisites', status: 'unknown', mandatory: requirement.mandatory,
      evidence: [requirement.evidence], reason: 'Your prior subject background is not available for comparison.',
    };
  }
  const required = requirement.requiredSubjects.map(normalizedSubject).filter(Boolean);
  const matched = required.filter((subject) => studentSubjects.some((item) => item === subject || item.includes(subject) || subject.includes(item)));
  const passed = matched.length === required.length;
  const trustworthy = HARD_REQUIREMENT_RELIABILITY.has(requirement.evidence.reliability);
  return {
    key: 'subject_prerequisites',
    status: !passed && requirement.mandatory && trustworthy ? 'not_met' : passed ? 'met' : 'unknown',
    mandatory: requirement.mandatory,
    evidence: [requirement.evidence],
    reason: passed ? 'Your prior subjects cover the normalized prerequisites.' : trustworthy ? 'Your prior subjects do not cover all normalized prerequisites.' : 'The subject-prerequisite evidence needs verification before it can create a hard failure.',
    ...(!passed && !trustworthy ? { limitation: 'Unverified normalized evidence cannot create a hard eligibility failure.' } : {}),
  };
}

export function evaluateEligibility(
  profile: StudentMatchingProfile,
  candidate: MatchingProgrammeCandidate,
): EligibilityResult {
  const checks = [
    comparableGpa(profile, candidate),
    ...candidate.testRequirements.map((r) => testCheck(profile, r)),
    ...[minimumDegreeCheck(profile, candidate), prerequisiteCheck(profile, candidate)].filter((check): check is EligibilityCheck => check !== null),
  ];
  const failed = checks.filter((check) => check.status === 'not_met');
  const unknowns = checks.filter((check) => check.status === 'unknown').map((check) => check.reason);
  return {
    status: failed.length > 0 ? 'not_eligible' : unknowns.length > 0 ? 'unknown' : 'eligible',
    checks,
    reasons: checks.filter((check) => check.status === 'met' || check.status === 'not_met').map((check) => check.reason),
    unknowns,
  };
}
