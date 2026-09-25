import type {
  MatchingAcademicEvidence,
  MatchingProgrammeContext,
  MatchingScholarshipContext,
  ScholarshipMatchingContext,
} from './matching-context';
import {
  canonicalNationality,
  canonicalStudyLevel,
  canonicalSubject,
  normalizeScholarshipDirectoryFilters,
  normalizeScholarshipEligibility,
  SCHOLARSHIP_ELIGIBILITY_NORMALIZER_VERSION,
  type DirectoryDeadlineFilter,
  type DirectoryValueFilter,
  type EligibilityEvidence,
  type EligibilityRequirementState,
  type NormalizedScholarshipEligibility,
  type ScholarshipDirectoryFilterInput,
  type ScholarshipDirectoryFilters,
} from './eligibility-normalization';

export const SCHOLARSHIP_ELIGIBILITY_POLICY_VERSION = 'scholarship-eligibility-v1';

export type EligibilityStatus = 'ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN';

export type EligibilitySignal =
  | 'nationality'
  | 'residency'
  | 'study-level'
  | 'subject'
  | 'university'
  | 'programme'
  | 'deadline'
  | 'intake'
  | 'academic'
  | 'eligibility-evidence'
  | 'policy-as-of';

export type EligibilityReasonCode =
  | 'nationality-supported'
  | 'nationality-open'
  | 'nationality-mismatch'
  | 'residency-supported'
  | 'residency-mismatch'
  | 'study-level-supported'
  | 'study-level-mismatch'
  | 'subject-supported'
  | 'subject-mismatch'
  | 'university-supported'
  | 'university-mismatch'
  | 'programme-supported'
  | 'programme-mismatch'
  | 'deadline-open'
  | 'deadline-closed'
  | 'deadline-passed'
  | 'deadline-supported'
  | 'intake-supported'
  | 'intake-mismatch'
  | 'academic-supported'
  | 'academic-mismatch'
  | 'requirement-ambiguous'
  | 'evidence-missing'
  | 'no-verifiable-requirements';

export type EligibilityWarningCode =
  | 'ambiguous-requirement'
  | 'missing-signal'
  | 'free-text-not-verified'
  | 'invalid-policy-date'
  | 'value-not-used-for-eligibility';

export type EligibilityWarning = {
  code: EligibilityWarningCode;
  message: string;
  signal?: EligibilitySignal;
};

export type EligibilityCheckStatus = 'satisfied' | 'failed' | 'unknown' | 'not-applicable';

export type EligibilityCheck = {
  signal: EligibilitySignal;
  status: EligibilityCheckStatus;
  reasonCodes: readonly EligibilityReasonCode[];
  evidence: readonly EligibilityEvidence[];
};

export type ScholarshipEligibilityPolicy = {
  /** Required so deadline evaluation is reproducible in tests and caches. */
  asOf: string;
  version?: string;
};

export type ScholarshipEligibilityResult = {
  scholarshipId: number;
  status: EligibilityStatus;
  reasonCodes: readonly EligibilityReasonCode[];
  warnings: readonly EligibilityWarning[];
  missingSignals: readonly EligibilitySignal[];
  policyVersion: string;
  normalizerVersion: typeof SCHOLARSHIP_ELIGIBILITY_NORMALIZER_VERSION;
  checks: readonly EligibilityCheck[];
  normalized: NormalizedScholarshipEligibility;
};

export type ScholarshipDirectoryCandidate = {
  id: number;
  country: string | null;
  universityIds: readonly number[];
  universityCountries: readonly string[];
  fundingTypes: readonly string[];
  normalizedEligibility: NormalizedScholarshipEligibility | null;
  /** Used only by explicit discovery fallback, never by eligibility checks. */
  discoveryText?: string | null;
  comparableTotalValue?: {
    lowerBound: number;
    currency: string | null;
  } | null;
};

export type ScholarshipDirectoryFilterMatch = {
  matches: boolean;
  mode: 'structured' | 'discovery' | 'unavailable';
};

type IntakeParts = {
  seasons: readonly string[];
  months: readonly number[];
  years: readonly number[];
};

const SEASON_MONTHS: Record<string, readonly number[]> = {
  spring: [1, 2, 3, 4],
  summer: [5, 6, 7, 8],
  autumn: [8, 9, 10, 11],
  winter: [11, 12, 1, 2],
};

const MONTHS: ReadonlyArray<[string, number]> = [
  ['january', 1],
  ['february', 2],
  ['march', 3],
  ['april', 4],
  ['may', 5],
  ['june', 6],
  ['july', 7],
  ['august', 8],
  ['september', 9],
  ['october', 10],
  ['november', 11],
  ['december', 12],
];

const DIRECTORY_MAJOR_SUBJECTS: Readonly<Record<string, readonly string[]>> = {
  business: ['business', 'economics', 'finance', 'marketing'],
  stem: ['computer-science', 'engineering', 'mathematics'],
  arts: ['arts', 'design', 'music', 'humanities'],
  health: ['health', 'medicine', 'nursing', 'pharmacy'],
  law: ['law'],
};

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function pushUnique<T>(target: T[], values: readonly T[]): void {
  for (const value of values) {
    if (!target.includes(value)) target.push(value);
  }
}

function normalizedText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseIntake(value: string | null | undefined): IntakeParts {
  if (!value) return { seasons: [], months: [], years: [] };
  const seasons = ['spring', 'summer', 'autumn', 'winter'].filter((season) =>
    new RegExp(`\\b${season === 'autumn' ? '(?:autumn|fall)' : season}\\b`, 'i').test(value),
  );
  const months = MONTHS
    .filter(([month]) => new RegExp(`\\b${month}\\b`, 'i').test(value))
    .map(([, month]) => month);
  const years = [...value.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  return {
    seasons: unique(seasons),
    months: unique(months),
    years: unique(years),
  };
}

function candidateProgramme(context: ScholarshipMatchingContext): MatchingProgrammeContext | null {
  return context.selection.programme;
}

function candidateDegree(context: ScholarshipMatchingContext): string | null {
  return candidateProgramme(context)?.degreeLevel
    ?? context.selection.application?.degreeLevel
    ?? context.student.studyLevel;
}

function candidateSubjects(context: ScholarshipMatchingContext): readonly string[] {
  const programmeSubject = candidateProgramme(context)?.subject
    ?? context.selection.application?.subject;
  if (programmeSubject) return [programmeSubject];
  return context.student.targetSubjects ?? [];
}

function candidateUniversityId(context: ScholarshipMatchingContext): number | null {
  return context.selection.university?.id
    ?? candidateProgramme(context)?.universityId
    ?? context.selection.application?.universityId
    ?? null;
}

function candidateProgrammeId(context: ScholarshipMatchingContext): string | null {
  return candidateProgramme(context)?.id ?? null;
}

function candidateIntake(context: ScholarshipMatchingContext): IntakeParts {
  const selectedText = candidateProgramme(context)?.intake
    ?? context.selection.application?.intake
    ?? context.student.targetIntake;
  const parsed = parseIntake(selectedText);
  if (context.student.applicationCycleYear != null && parsed.years.length === 0) {
    return { ...parsed, years: [context.student.applicationCycleYear] };
  }
  return parsed;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function numericGrade(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = /^\s*(\d+(?:\.\d+)?)\s*%?\s*$/.exec(value);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function candidatePercentage(context: ScholarshipMatchingContext): number | null {
  const records = [context.student.gradesSummary, context.student.curriculumGrades]
    .map(record)
    .filter((value): value is Record<string, unknown> => value !== null);
  for (const current of records) {
    for (const key of ['percentage', 'average_percentage', 'averagePercentage', 'percent', 'score_percent']) {
      const value = numericGrade(current[key]);
      if (value != null && value >= 0 && value <= 100) return value;
    }
  }
  return null;
}

function testScore(value: string | null): number | null {
  if (!value) return null;
  const match = /\d+(?:\.\d+)?/.exec(value);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function testType(value: string): string {
  return normalizedText(value).replace(/\s+/g, '');
}

function dateOnly(value: string): number | null {
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed) ? null : parsed;
}

function asOfDate(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function addCheck(
  checks: EligibilityCheck[],
  signal: EligibilitySignal,
  status: EligibilityCheckStatus,
  reasonCodes: readonly EligibilityReasonCode[],
  evidence: readonly EligibilityEvidence[] = [],
): void {
  checks.push({ signal, status, reasonCodes, evidence });
}

function evaluateNationality(
  context: ScholarshipMatchingContext,
  normalized: NormalizedScholarshipEligibility,
  checks: EligibilityCheck[],
  reasonCodes: EligibilityReasonCode[],
  missingSignals: EligibilitySignal[],
): void {
  const requirement = normalized.nationality;
  if (requirement.state === 'absent') {
    addCheck(checks, 'nationality', 'not-applicable', []);
  } else if (requirement.state === 'ambiguous') {
    addCheck(checks, 'nationality', 'unknown', ['requirement-ambiguous'], requirement.evidence);
    pushUnique(missingSignals, ['nationality']);
    pushUnique(reasonCodes, ['requirement-ambiguous']);
  } else if (requirement.openToAll && requirement.allowedNationalities.length === 0 && requirement.excludedNationalities.length === 0) {
    addCheck(checks, 'nationality', 'satisfied', ['nationality-open'], requirement.evidence);
    pushUnique(reasonCodes, ['nationality-open']);
  } else {
    const nationality = canonicalNationality(context.student.nationality);
    if (!nationality) {
      addCheck(checks, 'nationality', 'unknown', ['evidence-missing'], requirement.evidence);
      pushUnique(missingSignals, ['nationality']);
      pushUnique(reasonCodes, ['evidence-missing']);
    } else if (
      requirement.excludedNationalities.includes(nationality) ||
      (requirement.allowedNationalities.length > 0 && !requirement.allowedNationalities.includes(nationality))
    ) {
      addCheck(checks, 'nationality', 'failed', ['nationality-mismatch'], requirement.evidence);
      pushUnique(reasonCodes, ['nationality-mismatch']);
    } else {
      addCheck(checks, 'nationality', 'satisfied', ['nationality-supported'], requirement.evidence);
      pushUnique(reasonCodes, ['nationality-supported']);
    }
  }

  if (requirement.residencyState === 'absent') {
    addCheck(checks, 'residency', 'not-applicable', []);
  } else {
    // T3 deliberately carries nationality but not a verified residence field.
    addCheck(checks, 'residency', 'unknown', requirement.residencyState === 'ambiguous'
      ? ['requirement-ambiguous']
      : ['evidence-missing'], requirement.evidence);
    pushUnique(missingSignals, ['residency']);
    pushUnique(reasonCodes, requirement.residencyState === 'ambiguous'
      ? ['requirement-ambiguous']
      : ['evidence-missing']);
  }
}

function evaluateTextRequirement(
  context: ScholarshipMatchingContext,
  requirement: NormalizedScholarshipEligibility['studyLevel'] | NormalizedScholarshipEligibility['subject'],
  signal: 'study-level' | 'subject',
  checks: EligibilityCheck[],
  reasonCodes: EligibilityReasonCode[],
  missingSignals: EligibilitySignal[],
): void {
  if (requirement.state === 'absent') {
    addCheck(checks, signal, 'not-applicable', []);
    return;
  }
  if (requirement.state === 'ambiguous') {
    addCheck(checks, signal, 'unknown', ['requirement-ambiguous'], requirement.evidence);
    pushUnique(reasonCodes, ['requirement-ambiguous']);
    pushUnique(missingSignals, [signal]);
    return;
  }
  if (requirement.openToAll) {
    addCheck(checks, signal, 'satisfied', [], requirement.evidence);
    return;
  }

  const candidates = signal === 'study-level'
    ? [canonicalStudyLevel(candidateDegree(context))].filter((value): value is string => value !== null)
    : candidateSubjects(context)
      .map((value) => canonicalSubject(value))
      .filter((value): value is string => value !== null);
  if (candidates.length === 0) {
    addCheck(checks, signal, 'unknown', ['evidence-missing'], requirement.evidence);
    pushUnique(reasonCodes, ['evidence-missing']);
    pushUnique(missingSignals, [signal]);
    return;
  }

  const excluded = candidates.some((candidate) => requirement.excludedValues.includes(candidate));
  const supported = requirement.values.length === 0 || candidates.some((candidate) => requirement.values.includes(candidate));
  if (excluded || !supported) {
    addCheck(checks, signal, 'failed', [signal === 'study-level' ? 'study-level-mismatch' : 'subject-mismatch'], requirement.evidence);
    pushUnique(reasonCodes, [signal === 'study-level' ? 'study-level-mismatch' : 'subject-mismatch']);
  } else {
    addCheck(checks, signal, 'satisfied', [signal === 'study-level' ? 'study-level-supported' : 'subject-supported'], requirement.evidence);
    pushUnique(reasonCodes, [signal === 'study-level' ? 'study-level-supported' : 'subject-supported']);
  }
}

function evaluateInstitution(
  context: ScholarshipMatchingContext,
  requirement: NormalizedScholarshipEligibility['university'] | NormalizedScholarshipEligibility['programme'],
  signal: 'university' | 'programme',
  checks: EligibilityCheck[],
  reasonCodes: EligibilityReasonCode[],
  missingSignals: EligibilitySignal[],
): void {
  if (requirement.state === 'absent') {
    addCheck(checks, signal, 'not-applicable', []);
    return;
  }
  if (requirement.state === 'ambiguous') {
    addCheck(checks, signal, 'unknown', ['requirement-ambiguous'], requirement.evidence);
    pushUnique(reasonCodes, ['requirement-ambiguous']);
    pushUnique(missingSignals, [signal]);
    return;
  }

  if (signal === 'university') {
    const candidate = candidateUniversityId(context);
    if (candidate == null) {
      addCheck(checks, signal, 'unknown', ['evidence-missing'], requirement.evidence);
      pushUnique(reasonCodes, ['evidence-missing']);
      pushUnique(missingSignals, [signal]);
    } else if (requirement.universityIds.length > 0 && !requirement.universityIds.includes(candidate)) {
      addCheck(checks, signal, 'failed', ['university-mismatch'], requirement.evidence);
      pushUnique(reasonCodes, ['university-mismatch']);
    } else {
      addCheck(checks, signal, 'satisfied', ['university-supported'], requirement.evidence);
      pushUnique(reasonCodes, ['university-supported']);
    }
    return;
  }

  const candidate = candidateProgrammeId(context);
  if (!candidate) {
    addCheck(checks, signal, 'unknown', ['evidence-missing'], requirement.evidence);
    pushUnique(reasonCodes, ['evidence-missing']);
    pushUnique(missingSignals, [signal]);
  } else if (requirement.programmeIds.length > 0 && !requirement.programmeIds.includes(candidate)) {
    addCheck(checks, signal, 'failed', ['programme-mismatch'], requirement.evidence);
    pushUnique(reasonCodes, ['programme-mismatch']);
  } else {
    addCheck(checks, signal, 'satisfied', ['programme-supported'], requirement.evidence);
    pushUnique(reasonCodes, ['programme-supported']);
  }
}

function evaluateDeadline(
  normalized: NormalizedScholarshipEligibility,
  policy: ScholarshipEligibilityPolicy,
  checks: EligibilityCheck[],
  reasonCodes: EligibilityReasonCode[],
  missingSignals: EligibilitySignal[],
  warnings: EligibilityWarning[],
): void {
  const requirement = normalized.deadline;
  if (requirement.state === 'absent') {
    addCheck(checks, 'deadline', 'not-applicable', []);
    return;
  }
  if (requirement.state === 'closed') {
    addCheck(checks, 'deadline', 'failed', ['deadline-closed'], requirement.evidence);
    pushUnique(reasonCodes, ['deadline-closed']);
    return;
  }
  if (requirement.state === 'open') {
    addCheck(checks, 'deadline', 'satisfied', ['deadline-open'], requirement.evidence);
    pushUnique(reasonCodes, ['deadline-open']);
    return;
  }
  if (requirement.state === 'ambiguous' || !requirement.date) {
    addCheck(checks, 'deadline', 'unknown', ['requirement-ambiguous'], requirement.evidence);
    pushUnique(reasonCodes, ['requirement-ambiguous']);
    pushUnique(missingSignals, ['deadline']);
    warnings.push({
      code: 'ambiguous-requirement',
      message: 'The scholarship deadline could not be evaluated deterministically.',
      signal: 'deadline',
    });
    return;
  }
  const asOf = asOfDate(policy.asOf);
  const deadline = dateOnly(requirement.date);
  if (asOf == null) {
    addCheck(checks, 'deadline', 'unknown', ['evidence-missing'], requirement.evidence);
    pushUnique(reasonCodes, ['evidence-missing']);
    pushUnique(missingSignals, ['policy-as-of']);
    warnings.push({ code: 'invalid-policy-date', message: 'The eligibility policy as-of date is invalid.', signal: 'policy-as-of' });
  } else if (deadline == null) {
    addCheck(checks, 'deadline', 'unknown', ['requirement-ambiguous'], requirement.evidence);
    pushUnique(reasonCodes, ['requirement-ambiguous']);
    pushUnique(missingSignals, ['deadline']);
  } else if (deadline < asOf) {
    addCheck(checks, 'deadline', 'failed', ['deadline-passed'], requirement.evidence);
    pushUnique(reasonCodes, ['deadline-passed']);
  } else {
    addCheck(checks, 'deadline', 'satisfied', ['deadline-supported'], requirement.evidence);
    pushUnique(reasonCodes, ['deadline-supported']);
  }
}

function intersection(left: readonly number[], right: readonly number[]): boolean {
  return left.some((value) => right.includes(value));
}

function evaluateIntake(
  context: ScholarshipMatchingContext,
  normalized: NormalizedScholarshipEligibility,
  checks: EligibilityCheck[],
  reasonCodes: EligibilityReasonCode[],
  missingSignals: EligibilitySignal[],
): void {
  const requirement = normalized.intake;
  if (requirement.state === 'absent') {
    addCheck(checks, 'intake', 'not-applicable', []);
    return;
  }
  if (requirement.state === 'ambiguous') {
    addCheck(checks, 'intake', 'unknown', ['requirement-ambiguous'], requirement.evidence);
    pushUnique(reasonCodes, ['requirement-ambiguous']);
    pushUnique(missingSignals, ['intake']);
    return;
  }

  const candidate = candidateIntake(context);
  if (candidate.seasons.length === 0 && candidate.months.length === 0 && candidate.years.length === 0) {
    addCheck(checks, 'intake', 'unknown', ['evidence-missing'], requirement.evidence);
    pushUnique(reasonCodes, ['evidence-missing']);
    pushUnique(missingSignals, ['intake']);
    return;
  }

  if (requirement.years.length > 0) {
    if (candidate.years.length === 0) {
      addCheck(checks, 'intake', 'unknown', ['evidence-missing'], requirement.evidence);
      pushUnique(reasonCodes, ['evidence-missing']);
      pushUnique(missingSignals, ['intake']);
      return;
    }
    if (!intersection(requirement.years, candidate.years)) {
      addCheck(checks, 'intake', 'failed', ['intake-mismatch'], requirement.evidence);
      pushUnique(reasonCodes, ['intake-mismatch']);
      return;
    }
  }

  const candidateMonths = [
    ...candidate.months,
    ...candidate.seasons.flatMap((season) => SEASON_MONTHS[season] ?? []),
  ];
  const requiredMonths = [
    ...requirement.months,
    ...requirement.seasons.flatMap((season) => SEASON_MONTHS[season] ?? []),
  ];
  if (requiredMonths.length > 0 && !intersection(requiredMonths, candidateMonths)) {
    addCheck(checks, 'intake', 'failed', ['intake-mismatch'], requirement.evidence);
    pushUnique(reasonCodes, ['intake-mismatch']);
    return;
  }

  addCheck(checks, 'intake', 'satisfied', ['intake-supported'], requirement.evidence);
  pushUnique(reasonCodes, ['intake-supported']);
}

function evaluateAcademic(
  context: ScholarshipMatchingContext,
  normalized: NormalizedScholarshipEligibility,
  checks: EligibilityCheck[],
  reasonCodes: EligibilityReasonCode[],
  missingSignals: EligibilitySignal[],
): void {
  const requirement = normalized.academic;
  if (requirement.state === 'absent') {
    addCheck(checks, 'academic', 'not-applicable', []);
    return;
  }
  if (requirement.state === 'ambiguous') {
    addCheck(checks, 'academic', 'unknown', ['requirement-ambiguous'], requirement.evidence);
    pushUnique(reasonCodes, ['requirement-ambiguous']);
    pushUnique(missingSignals, ['academic']);
    return;
  }

  let unknown = false;
  const evidence = requirement.evidence;
  if (requirement.gpaMinimum != null) {
    const value = context.student.gpaValue;
    const profileScale = numericGrade(context.student.gpaScale);
    if (value == null || (requirement.gpaScale != null && profileScale == null)) {
      unknown = true;
    } else if (requirement.gpaScale != null && profileScale !== requirement.gpaScale) {
      unknown = true;
    } else if (value < requirement.gpaMinimum) {
      addCheck(checks, 'academic', 'failed', ['academic-mismatch'], evidence);
      pushUnique(reasonCodes, ['academic-mismatch']);
      return;
    }
  }

  if (requirement.percentageMinimum != null) {
    const value = candidatePercentage(context);
    if (value == null) unknown = true;
    else if (value < requirement.percentageMinimum) {
      addCheck(checks, 'academic', 'failed', ['academic-mismatch'], evidence);
      pushUnique(reasonCodes, ['academic-mismatch']);
      return;
    }
  }

  const academicEvidence: MatchingAcademicEvidence = context.academicEvidence;
  for (const required of requirement.tests) {
    const english = academicEvidence.englishTests ?? [];
    const standardized = academicEvidence.standardizedTests ?? [];
    const matchingEnglish = english.filter((test) => testType(test.testType) === required.testType);
    const matchingStandardized = standardized.filter((test) => testType(test.testType) === required.testType);
    const scores = [
      ...matchingEnglish.map((test) => test.overallScore),
      ...matchingStandardized.map((test) => testScore(test.score)),
    ].filter((score): score is number => score != null);
    if (scores.length === 0) unknown = true;
    else if (Math.max(...scores) < required.minimum) {
      addCheck(checks, 'academic', 'failed', ['academic-mismatch'], evidence);
      pushUnique(reasonCodes, ['academic-mismatch']);
      return;
    }
  }

  if (unknown) {
    addCheck(checks, 'academic', 'unknown', ['evidence-missing'], evidence);
    pushUnique(reasonCodes, ['evidence-missing']);
    pushUnique(missingSignals, ['academic']);
  } else {
    addCheck(checks, 'academic', 'satisfied', ['academic-supported'], evidence);
    pushUnique(reasonCodes, ['academic-supported']);
  }
}

function addNormalizationWarnings(
  normalized: NormalizedScholarshipEligibility,
  warnings: EligibilityWarning[],
): void {
  for (const item of normalized.warnings) {
    warnings.push({
      code: 'ambiguous-requirement',
      message: item.message,
    });
  }
}

function findScholarship(
  context: ScholarshipMatchingContext,
  scholarshipId: number,
): MatchingScholarshipContext | null {
  return context.scholarships.find((item) => item.id === scholarshipId) ?? null;
}

export type EvaluateScholarshipEligibilityInput = {
  context: ScholarshipMatchingContext;
  scholarship?: MatchingScholarshipContext;
  scholarshipId?: number;
  policy: ScholarshipEligibilityPolicy;
};

/**
 * Evaluate hard scholarship eligibility only. This function intentionally
 * does not read monetary value, fit scores, LLM output, or recommendation data.
 */
export function evaluateScholarshipEligibility(
  input: EvaluateScholarshipEligibilityInput,
): ScholarshipEligibilityResult {
  const scholarship = input.scholarship
    ?? (input.scholarshipId == null ? null : findScholarship(input.context, input.scholarshipId));
  if (!scholarship) {
    const normalized = {
      normalizerVersion: SCHOLARSHIP_ELIGIBILITY_NORMALIZER_VERSION,
      nationality: { state: 'ambiguous', allowedNationalities: [], excludedNationalities: [], residencyCountries: [], residencyState: 'absent', openToAll: false, evidence: [] },
      studyLevel: { state: 'ambiguous', values: [], excludedValues: [], openToAll: false, evidence: [] },
      subject: { state: 'ambiguous', values: [], excludedValues: [], openToAll: false, evidence: [] },
      university: { state: 'ambiguous', universityIds: [], programmeIds: [], evidence: [] },
      programme: { state: 'ambiguous', universityIds: [], programmeIds: [], evidence: [] },
      deadline: { state: 'absent', date: null, evidence: [] },
      intake: { state: 'absent', seasons: [], months: [], years: [], evidence: [] },
      academic: { state: 'ambiguous', gpaMinimum: null, gpaScale: null, percentageMinimum: null, tests: [], evidence: [] },
      sourceTexts: [],
      hasVerifiableRequirement: false,
      warnings: [],
    } satisfies NormalizedScholarshipEligibility;
    return {
      scholarshipId: input.scholarshipId ?? -1,
      status: 'UNKNOWN',
      reasonCodes: ['evidence-missing'],
      warnings: [{ code: 'missing-signal', message: 'The scholarship was not present in the canonical context.', signal: 'eligibility-evidence' }],
      missingSignals: ['eligibility-evidence'],
      policyVersion: input.policy.version ?? SCHOLARSHIP_ELIGIBILITY_POLICY_VERSION,
      normalizerVersion: SCHOLARSHIP_ELIGIBILITY_NORMALIZER_VERSION,
      checks: [],
      normalized,
    };
  }

  const normalized = normalizeScholarshipEligibility(scholarship);
  const checks: EligibilityCheck[] = [];
  const reasonCodes: EligibilityReasonCode[] = [];
  const missingSignals: EligibilitySignal[] = [];
  const warnings: EligibilityWarning[] = [];

  addNormalizationWarnings(normalized, warnings);
  evaluateNationality(input.context, normalized, checks, reasonCodes, missingSignals);
  evaluateTextRequirement(input.context, normalized.studyLevel, 'study-level', checks, reasonCodes, missingSignals);
  evaluateTextRequirement(input.context, normalized.subject, 'subject', checks, reasonCodes, missingSignals);
  evaluateInstitution(input.context, normalized.university, 'university', checks, reasonCodes, missingSignals);
  evaluateInstitution(input.context, normalized.programme, 'programme', checks, reasonCodes, missingSignals);
  evaluateDeadline(normalized, input.policy, checks, reasonCodes, missingSignals, warnings);
  evaluateIntake(input.context, normalized, checks, reasonCodes, missingSignals);
  evaluateAcademic(input.context, normalized, checks, reasonCodes, missingSignals);

  if (!normalized.hasVerifiableRequirement) {
    pushUnique(reasonCodes, ['no-verifiable-requirements']);
    pushUnique(missingSignals, ['eligibility-evidence']);
    warnings.push({
      code: 'free-text-not-verified',
      message: 'No structured eligibility fact was available; free text was not treated as proof.',
      signal: 'eligibility-evidence',
    });
  }

  if (normalized.deadline.state === 'date' && asOfDate(input.policy.asOf) == null) {
    pushUnique(missingSignals, ['policy-as-of']);
  }

  const hasFailure = checks.some((check) => check.status === 'failed');
  const hasUnknown = checks.some((check) => check.status === 'unknown') || missingSignals.length > 0;
  const status: EligibilityStatus = hasFailure
    ? 'INELIGIBLE'
    : hasUnknown
      ? 'UNKNOWN'
      : 'ELIGIBLE';

  if (hasUnknown) {
    warnings.push({
      code: 'missing-signal',
      message: 'Eligibility could not be fully assessed from the available evidence.',
    });
  }
  warnings.push({
    code: 'value-not-used-for-eligibility',
    message: 'Financial value is intentionally excluded from hard eligibility.',
  });

  const dedupeWarnings = warnings.filter((item, index, all) =>
    all.findIndex((candidate) =>
      candidate.code === item.code && candidate.message === item.message && candidate.signal === item.signal,
    ) === index,
  );

  return {
    scholarshipId: scholarship.id,
    status,
    reasonCodes: unique(reasonCodes),
    warnings: dedupeWarnings,
    missingSignals: unique(missingSignals),
    policyVersion: input.policy.version ?? SCHOLARSHIP_ELIGIBILITY_POLICY_VERSION,
    normalizerVersion: SCHOLARSHIP_ELIGIBILITY_NORMALIZER_VERSION,
    checks,
    normalized,
  };
}

function normalizedCandidateSubjectValues(
  candidate: ScholarshipDirectoryCandidate,
): string[] {
  return candidate.normalizedEligibility?.subject.values.flatMap((value) => [value]) ?? [];
}

function subjectFilterValues(value: string): readonly string[] {
  const key = normalizedText(value);
  return DIRECTORY_MAJOR_SUBJECTS[key]
    ?? [canonicalSubject(value) ?? key];
}

function subjectFilterMatches(
  candidate: ScholarshipDirectoryCandidate,
  value: string,
  options: { allowDiscoveryText?: boolean },
): ScholarshipDirectoryFilterMatch {
  const structured = candidate.normalizedEligibility;
  const values = normalizedCandidateSubjectValues(candidate);
  const requestedValues = subjectFilterValues(value);
  const matches = requestedValues.some((requested) => values.includes(requested));
  if (matches) return { matches: true, mode: 'structured' };
  if (options.allowDiscoveryText && discoveryContains(candidate, value)) {
    return { matches: true, mode: 'discovery' };
  }
  return { matches: false, mode: structured ? 'structured' : 'unavailable' };
}

function discoveryContains(candidate: ScholarshipDirectoryCandidate, value: string): boolean {
  const haystack = normalizedText(candidate.discoveryText ?? '');
  const needle = normalizedText(value);
  return Boolean(needle) && haystack.includes(needle);
}

function deadlineMatches(
  candidate: ScholarshipDirectoryCandidate,
  filter: DirectoryDeadlineFilter,
  asOf: string | undefined,
): boolean {
  if (filter === 'any') return true;
  const state = candidate.normalizedEligibility?.deadline.state;
  if (filter === 'undated') return state === 'absent';
  if (state === 'open') return filter === 'open';
  if (state === 'closed') return filter === 'closed';
  if (state !== 'date' || !candidate.normalizedEligibility?.deadline.date || !asOf) return false;
  const deadline = dateOnly(candidate.normalizedEligibility.deadline.date);
  const reference = asOfDate(asOf);
  if (deadline == null || reference == null) return false;
  return filter === 'open' ? deadline >= reference : deadline < reference;
}

function valueMatches(
  candidate: ScholarshipDirectoryCandidate,
  filter: DirectoryValueFilter | null,
): boolean {
  if (!filter) return true;
  const value = candidate.comparableTotalValue;
  if (!value || !value.currency || !filter.currency || value.currency !== filter.currency) return false;
  if (filter.min != null && value.lowerBound < filter.min) return false;
  if (filter.max != null && value.lowerBound > filter.max) return false;
  return true;
}

/**
 * Apply typed directory filters to already normalized candidates. This helper
 * never turns a discovery text hit into an eligibility fact.
 */
export function matchScholarshipDirectoryFilters(
  candidate: ScholarshipDirectoryCandidate,
  input: ScholarshipDirectoryFilterInput = {},
  options: { allowDiscoveryText?: boolean; asOf?: string } = {},
): ScholarshipDirectoryFilterMatch {
  const filters = normalizeScholarshipDirectoryFilters(input);
  const structured = candidate.normalizedEligibility;
  let matchMode: ScholarshipDirectoryFilterMatch['mode'] = 'structured';
  const candidateCountry = normalizedText(candidate.country ?? '');
  const linkedCountries = candidate.universityCountries.map(normalizedText);
  if (filters.country) {
    const country = normalizedText(filters.country);
    if (candidateCountry !== country && !linkedCountries.includes(country)) {
      return { matches: false, mode: 'structured' };
    }
  }
  if (filters.universityIds.length > 0 && !filters.universityIds.some((id) => candidate.universityIds.includes(id))) {
    return { matches: false, mode: 'structured' };
  }
  if (filters.fundingTypes.length > 0) {
    const funding = candidate.fundingTypes.map((value) => normalizedText(value));
    if (!filters.fundingTypes.some((value) => funding.includes(normalizedText(value)))) {
      return { matches: false, mode: 'structured' };
    }
  }
  if (!deadlineMatches(candidate, filters.deadline, options.asOf)) return { matches: false, mode: 'structured' };
  if (!valueMatches(candidate, filters.value)) return { matches: false, mode: 'structured' };

  if (filters.degree) {
    const required = canonicalStudyLevel(filters.degree) ?? normalizedText(filters.degree);
    const values = structured?.studyLevel.values ?? [];
    const matches = values.includes(required);
    if (!matches && options.allowDiscoveryText && discoveryContains(candidate, filters.degree)) {
      return { matches: true, mode: 'discovery' };
    }
    if (!matches) return { matches: false, mode: structured ? 'structured' : 'unavailable' };
  }
  if (filters.subject) {
    const result = subjectFilterMatches(candidate, filters.subject, options);
    if (!result.matches) return result;
    if (result.mode === 'discovery') matchMode = 'discovery';
  }
  if (filters.major) {
    const result = subjectFilterMatches(candidate, filters.major, options);
    if (!result.matches) return result;
    if (result.mode === 'discovery') matchMode = 'discovery';
  }
  return { matches: true, mode: matchMode };
}

export type {
  DirectoryDeadlineFilter,
  DirectoryValueFilter,
  EligibilityEvidence,
  EligibilityRequirementState,
  ScholarshipDirectoryFilterInput,
  ScholarshipDirectoryFilters,
};
