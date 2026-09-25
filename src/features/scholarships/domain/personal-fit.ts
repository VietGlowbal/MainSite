import { NATIONALITY_CATALOG } from '../../../lib/nationality-catalog';
import type { BenefitAmount } from './benefit-types';
import type {
  EligibilityStatus,
  ScholarshipEligibilityResult,
} from './eligibility';
import {
  canonicalStudyLevel,
  canonicalSubject,
  type NormalizedScholarshipEligibility,
} from './eligibility-normalization';
import type {
  MatchingProgrammeContext,
  MatchingScholarshipContext,
  ScholarshipMatchingContext,
} from './matching-context';
import {
  resolvePersonalFitPolicy,
  type PersonalFitPolicy,
  type PersonalFitPolicyWeights,
} from './personal-fit-policy';

export type PersonalFitStatus = 'SCORED' | 'UNKNOWN' | 'INELIGIBLE';

export type PersonalFitSignal =
  | 'preferred-country'
  | 'university'
  | 'selected-programme'
  | 'subject'
  | 'study-level'
  | 'intake'
  | 'funding-preference'
  | 'budget'
  | 'study-mode'
  | 'academic-evidence'
  | 'profile-completeness'
  | 'eligibility';

type FitScoreSignal = Exclude<
  PersonalFitSignal,
  'academic-evidence' | 'profile-completeness' | 'eligibility'
>;

export type PersonalFitReasonCode =
  | 'preferred-country-match'
  | 'preferred-country-mismatch'
  | 'selected-university-match'
  | 'saved-university-match'
  | 'university-mismatch'
  | 'selected-programme-match'
  | 'selected-programme-discovery-match'
  | 'subject-match'
  | 'subject-discovery-match'
  | 'subject-mismatch'
  | 'study-level-match'
  | 'study-level-discovery-match'
  | 'study-level-mismatch'
  | 'intake-match'
  | 'intake-discovery-match'
  | 'intake-mismatch'
  | 'funding-preference-match'
  | 'funding-preference-mismatch'
  | 'budget-aligned'
  | 'budget-partial'
  | 'budget-misaligned'
  | 'study-mode-match'
  | 'study-mode-discovery-match'
  | 'study-mode-mismatch'
  | 'profile-evidence-complete'
  | 'profile-evidence-partial'
  | 'eligibility-ineligible'
  | 'eligibility-unknown'
  | 'no-fit-signals';

export type PersonalFitWarningCode =
  | 'eligibility-gate'
  | 'eligibility-context-mismatch'
  | 'missing-profile-signal'
  | 'missing-scholarship-signal'
  | 'weak-discovery-evidence'
  | 'budget-currency-unavailable'
  | 'no-fit-signals';

export type PersonalFitWarning = {
  code: PersonalFitWarningCode;
  message: string;
  signal?: PersonalFitSignal;
};

export type PersonalFitValue =
  | string
  | number
  | boolean
  | null
  | readonly (string | number)[]
  | Readonly<Record<string, string | number | boolean | null>>;

export type PersonalFitReasonData = {
  code: PersonalFitReasonCode | null;
  signal: PersonalFitSignal;
  outcome: 'match' | 'weak-match' | 'mismatch' | 'partial' | 'unknown';
  weight: number;
  contribution: number;
  preference: PersonalFitValue;
  candidate: PersonalFitValue;
  evidence: readonly string[];
};

export type PersonalFitResult = {
  scholarshipId: number;
  eligibilityStatus: EligibilityStatus;
  fitStatus: PersonalFitStatus;
  score: number | null;
  confidence: number;
  reasonCodes: readonly PersonalFitReasonCode[];
  reasonData: readonly PersonalFitReasonData[];
  warnings: readonly PersonalFitWarning[];
  missingSignals: readonly PersonalFitSignal[];
  policyVersion: string;
};

export type ScorePersonalFitInput = {
  context: ScholarshipMatchingContext;
  scholarship: MatchingScholarshipContext;
  eligibility: ScholarshipEligibilityResult;
  policy?: PersonalFitPolicy;
};

type SignalOutcome = PersonalFitReasonData['outcome'];

type SignalEvaluation = PersonalFitReasonData & {
  missingSignal: PersonalFitSignal | null;
  warning: PersonalFitWarning | null;
};

type IntakeParts = {
  seasons: readonly string[];
  months: readonly number[];
  years: readonly number[];
};

type BudgetConstraint = {
  min: number | null;
  max: number | null;
  currency: 'USD';
};

const SEASON_MONTHS: Readonly<Record<string, readonly number[]>> = {
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

const WEIGHT_KEYS: Readonly<Record<FitScoreSignal, keyof PersonalFitPolicyWeights>> = {
  'preferred-country': 'preferredCountry',
  university: 'universityPreference',
  'selected-programme': 'selectedProgramme',
  subject: 'subject',
  'study-level': 'studyLevel',
  intake: 'intake',
  'funding-preference': 'fundingPreference',
  budget: 'budget',
  'study-mode': 'studyMode',
};

const FUNDING_ALIASES: Readonly<Record<string, string>> = {
  'financial need': 'need',
  'need based': 'need',
  'need based aid': 'need',
  'merit based': 'merit',
  'academic merit': 'merit',
  'field specific': 'field-specific',
  'full ride': 'full-ride',
  'full tuition': 'full-ride',
  'partially funded': 'partial',
  'partial funding': 'partial',
};

const MODE_ALIASES: Readonly<Record<string, string>> = {
  'full time': 'full-time',
  fulltime: 'full-time',
  'part time': 'part-time',
  parttime: 'part-time',
  distance: 'online',
  'distance learning': 'online',
  remote: 'online',
};

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function normalizedText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cleanString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function canonicalCountry(value: string | null | undefined): string | null {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  const needle = normalizedText(cleaned);
  const entry = NATIONALITY_CATALOG.find((candidate) =>
    [candidate.iso2, candidate.nationality, ...candidate.aliases]
      .some((alias) => normalizedText(alias) === needle),
  );
  return entry?.iso2.toLowerCase() ?? needle;
}

function canonicalFunding(value: string | null | undefined): string | null {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  const key = normalizedText(cleaned);
  return FUNDING_ALIASES[key] ?? key.replace(/\s+/g, '-');
}

function canonicalMode(value: string | null | undefined): string | null {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  const key = normalizedText(cleaned);
  return MODE_ALIASES[key] ?? key.replace(/\s+/g, '-');
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

function intersection(left: readonly number[], right: readonly number[]): boolean {
  return left.some((value) => right.includes(value));
}

function targetProgramme(context: ScholarshipMatchingContext): MatchingProgrammeContext | null {
  return context.selection.programme;
}

function targetProgrammeId(context: ScholarshipMatchingContext): string | null {
  return targetProgramme(context)?.id ?? context.selection.application?.courseId ?? null;
}

function targetProgrammeName(context: ScholarshipMatchingContext): string | null {
  return targetProgramme(context)?.name ?? context.selection.application?.courseName ?? null;
}

function targetDegree(context: ScholarshipMatchingContext): string | null {
  return targetProgramme(context)?.degreeLevel
    ?? context.selection.application?.degreeLevel
    ?? context.student.studyLevel;
}

function targetSubjects(context: ScholarshipMatchingContext): readonly string[] {
  const programmeSubject = targetProgramme(context)?.subject
    ?? context.selection.application?.subject;
  if (programmeSubject) return [programmeSubject];
  return context.student.targetSubjects ?? [];
}

function targetIntake(context: ScholarshipMatchingContext): string | null {
  return targetProgramme(context)?.intake
    ?? context.selection.application?.intake
    ?? context.student.targetIntake;
}

function targetStudyMode(context: ScholarshipMatchingContext): string | null {
  return targetProgramme(context)?.studyMode
    ?? context.selection.application?.studyMode
    ?? context.student.studyMode;
}

function selectedUniversityId(context: ScholarshipMatchingContext): number | null {
  return context.selection.university?.id
    ?? targetProgramme(context)?.universityId
    ?? context.selection.application?.universityId
    ?? null;
}

function activeSavedUniversityIds(
  context: ScholarshipMatchingContext,
): { available: boolean; ids: readonly number[] } {
  if (context.savedUniversities == null) return { available: false, ids: [] };
  const ids = context.savedUniversities
    .filter((saved) => !/^(?:removed|deleted|archived)$/i.test(saved.status ?? ''))
    .map((saved) => saved.universityId)
    .filter((id, index, values) => values.indexOf(id) === index);
  return { available: true, ids };
}

function rawValues(raw: Record<string, unknown>, keys: readonly string[]): unknown[] {
  return keys.flatMap((key) => {
    const value = raw[key];
    return Array.isArray(value) ? value : value == null ? [] : [value];
  });
}

function stringValues(values: readonly unknown[]): string[] {
  return values
    .map((value) => typeof value === 'string' ? cleanString(value) : null)
    .filter((value): value is string => value !== null);
}

function discoveryText(
  scholarship: MatchingScholarshipContext,
  eligibility: NormalizedScholarshipEligibility,
): string {
  const raw = scholarship.raw;
  const rawText = stringValues(rawValues(raw, [
    'subject',
    'subjects',
    'major',
    'majors',
    'best_for',
    'strengths',
    'study_level',
    'degree_level',
    'degree_levels',
    'study_mode',
    'study_modes',
    'mode',
    'intake',
    'intakes',
    'cycle',
    'cycles',
    'programme',
    'program',
    'course',
  ]));
  return [
    scholarship.name,
    scholarship.appliesToText,
    scholarship.conditions,
    ...eligibility.sourceTexts.map((item) => item.excerpt),
    ...rawText,
  ].filter((value): value is string => value !== null).join(' ');
}

function discoveryEvidence(
  text: string,
  value: string,
): readonly string[] {
  const needle = normalizedText(value);
  if (!needle) return [];
  return text
    .split(/(?<=[.!?;])\s+/)
    .filter((excerpt) => normalizedText(excerpt).includes(needle))
    .slice(0, 3);
}

function containsDiscovery(text: string, value: string): boolean {
  const needle = normalizedText(value);
  return Boolean(needle) && normalizedText(text).includes(needle);
}

function scoreWeight(
  policy: PersonalFitPolicy,
  signal: FitScoreSignal,
): number {
  return policy.weights[WEIGHT_KEYS[signal]];
}

function signalEvaluation(
  policy: PersonalFitPolicy,
  signal: FitScoreSignal,
  outcome: SignalOutcome,
  code: PersonalFitReasonCode | null,
  preference: PersonalFitValue,
  candidate: PersonalFitValue,
  evidence: readonly string[],
  options: {
    factor?: number;
    missingSignal?: PersonalFitSignal | null;
    warning?: PersonalFitWarning | null;
  } = {},
): SignalEvaluation {
  const factor = options.factor
    ?? (outcome === 'match'
      ? 1
      : outcome === 'weak-match'
        ? policy.discoveryMultiplier
        : outcome === 'partial'
          ? 0.5
          : 0);
  const weight = scoreWeight(policy, signal);
  return {
    code,
    signal,
    outcome,
    weight,
    contribution: weight * factor,
    preference,
    candidate,
    evidence,
    missingSignal: options.missingSignal ?? null,
    warning: options.warning ?? null,
  };
}

function warning(
  code: PersonalFitWarningCode,
  message: string,
  signal?: PersonalFitSignal,
): PersonalFitWarning {
  return signal == null ? { code, message } : { code, message, signal };
}

function evaluatePreferredCountry(
  context: ScholarshipMatchingContext,
  scholarship: MatchingScholarshipContext,
  policy: PersonalFitPolicy,
): SignalEvaluation {
  const preferences = (context.student.preferredCountries ?? [])
    .filter((value) => !/^open\s+to\s+ideas$/i.test(value))
    .map(canonicalCountry)
    .filter((value): value is string => value !== null);
  if (preferences.length === 0) {
    if (context.student.preferredCountries == null) {
      return signalEvaluation(
        policy,
        'preferred-country',
        'unknown',
        null,
        null,
        null,
        [],
        {
          missingSignal: 'preferred-country',
          warning: warning('missing-profile-signal', 'Preferred-country evidence is missing.', 'preferred-country'),
        },
      );
    }
    return signalEvaluation(policy, 'preferred-country', 'unknown', null, [], [], []);
  }

  const candidates = unique([
    canonicalCountry(scholarship.country),
    ...scholarship.universityCountries.map(canonicalCountry),
  ].filter((value): value is string => value !== null));
  if (candidates.length === 0) {
    return signalEvaluation(
      policy,
      'preferred-country',
      'unknown',
      null,
      preferences,
      null,
      [],
      {
        missingSignal: 'preferred-country',
        warning: warning('missing-scholarship-signal', 'Scholarship country evidence is missing.', 'preferred-country'),
      },
    );
  }

  const matched = preferences.find((value) => candidates.includes(value));
  return matched
    ? signalEvaluation(policy, 'preferred-country', 'match', 'preferred-country-match', preferences, candidates, [])
    : signalEvaluation(policy, 'preferred-country', 'mismatch', 'preferred-country-mismatch', preferences, candidates, []);
}

function evaluateUniversity(
  context: ScholarshipMatchingContext,
  scholarship: MatchingScholarshipContext,
  policy: PersonalFitPolicy,
): SignalEvaluation {
  const candidateIds = unique(scholarship.universityIds);
  const selected = selectedUniversityId(context);
  const saved = activeSavedUniversityIds(context);
  const preferenceIds = unique([
    ...(selected == null ? [] : [selected]),
    ...saved.ids,
  ]);

  if (candidateIds.length === 0) {
    if (preferenceIds.length === 0 && saved.available) {
      return signalEvaluation(policy, 'university', 'unknown', null, [], [], []);
    }
    return signalEvaluation(
      policy,
      'university',
      'unknown',
      null,
      preferenceIds,
      null,
      [],
      {
        missingSignal: 'university',
        warning: warning('missing-scholarship-signal', 'Scholarship university linkage is missing.', 'university'),
      },
    );
  }

  if (selected != null && candidateIds.includes(selected)) {
    return signalEvaluation(
      policy,
      'university',
      'match',
      'selected-university-match',
      [selected],
      candidateIds,
      [],
    );
  }

  const savedMatch = saved.ids.find((id) => candidateIds.includes(id));
  if (savedMatch != null) {
    return signalEvaluation(
      policy,
      'university',
      'match',
      'saved-university-match',
      saved.ids,
      candidateIds,
      [],
    );
  }

  if (preferenceIds.length === 0) {
    if (!saved.available) {
      return signalEvaluation(
        policy,
        'university',
        'unknown',
        null,
        null,
        candidateIds,
        [],
        {
          missingSignal: 'university',
          warning: warning('missing-profile-signal', 'Saved-university evidence is unavailable.', 'university'),
        },
      );
    }
    return signalEvaluation(policy, 'university', 'unknown', null, [], candidateIds, []);
  }

  return signalEvaluation(
    policy,
    'university',
    'mismatch',
    'university-mismatch',
    preferenceIds,
    candidateIds,
    [],
  );
}

function evaluateSelectedProgramme(
  context: ScholarshipMatchingContext,
  normalized: NormalizedScholarshipEligibility,
  policy: PersonalFitPolicy,
  discovery: string,
): SignalEvaluation {
  const programmeId = targetProgrammeId(context);
  const programmeName = targetProgrammeName(context);
  const requirement = normalized.programme;
  if (programmeId == null && programmeName == null) {
    return signalEvaluation(policy, 'selected-programme', 'unknown', null, null, null, [], {
      missingSignal: 'selected-programme',
      warning: warning('missing-profile-signal', 'Selected programme evidence is missing.', 'selected-programme'),
    });
  }
  if (requirement.state === 'absent') {
    return signalEvaluation(policy, 'selected-programme', 'unknown', null, programmeId ?? programmeName, null, []);
  }
  if (programmeId != null && requirement.programmeIds.includes(programmeId)) {
    return signalEvaluation(
      policy,
      'selected-programme',
      'match',
      'selected-programme-match',
      programmeId,
      requirement.programmeIds,
      requirement.evidence.map((item) => item.excerpt),
    );
  }
  if (requirement.programmeIds.length > 0) {
    return signalEvaluation(
      policy,
      'selected-programme',
      'mismatch',
      'selected-programme-match',
      programmeId ?? programmeName,
      requirement.programmeIds,
      requirement.evidence.map((item) => item.excerpt),
    );
  }
  if (programmeName && containsDiscovery(discovery, programmeName)) {
    return signalEvaluation(
      policy,
      'selected-programme',
      'weak-match',
      'selected-programme-discovery-match',
      programmeName,
      requirement.programmeIds,
      discoveryEvidence(discovery, programmeName),
      {
        warning: warning('weak-discovery-evidence', 'Selected-programme alignment uses discovery text only.', 'selected-programme'),
      },
    );
  }
  if (requirement.state === 'ambiguous' || requirement.programmeIds.length === 0) {
    return signalEvaluation(
      policy,
      'selected-programme',
      'unknown',
      null,
      programmeId ?? programmeName,
      requirement.programmeIds,
      requirement.evidence.map((item) => item.excerpt),
      {
        missingSignal: 'selected-programme',
        warning: warning('missing-scholarship-signal', 'Selected-programme applicability is not structured.', 'selected-programme'),
      },
    );
  }
  return signalEvaluation(
    policy,
    'selected-programme',
    'mismatch',
    'university-mismatch',
    programmeId ?? programmeName,
    requirement.programmeIds,
    requirement.evidence.map((item) => item.excerpt),
  );
}

function evaluateSubject(
  context: ScholarshipMatchingContext,
  normalized: NormalizedScholarshipEligibility,
  policy: PersonalFitPolicy,
  discovery: string,
): SignalEvaluation {
  const preferences = unique(
    targetSubjects(context)
      .map((value) => canonicalSubject(value))
      .filter((value): value is string => value !== null),
  );
  const rawPreferences = targetSubjects(context);
  const requirement = normalized.subject;
  if (requirement.state === 'absent' && preferences.length === 0) {
    return signalEvaluation(policy, 'subject', 'unknown', null, null, null, []);
  }
  if (preferences.length === 0) {
    return signalEvaluation(policy, 'subject', 'unknown', null, rawPreferences, null, [], {
      missingSignal: 'subject',
      warning: warning('missing-profile-signal', 'Target-subject evidence is missing.', 'subject'),
    });
  }
  if (requirement.openToAll) {
    return signalEvaluation(policy, 'subject', 'match', 'subject-match', preferences, ['all'], requirement.evidence.map((item) => item.excerpt));
  }
  const matched = preferences.some((value) => requirement.values.includes(value));
  const excluded = preferences.some((value) => requirement.excludedValues.includes(value));
  if (requirement.state === 'parsed' && (matched || excluded || requirement.values.length > 0 || requirement.excludedValues.length > 0)) {
    return matched && !excluded
      ? signalEvaluation(policy, 'subject', 'match', 'subject-match', rawPreferences, requirement.values, requirement.evidence.map((item) => item.excerpt))
      : signalEvaluation(policy, 'subject', 'mismatch', 'subject-mismatch', rawPreferences, requirement.values, requirement.evidence.map((item) => item.excerpt));
  }
  const rawMatch = rawPreferences.find((value) => containsDiscovery(discovery, value));
  if (rawMatch) {
    return signalEvaluation(
      policy,
      'subject',
      'weak-match',
      'subject-discovery-match',
      rawPreferences,
      null,
      discoveryEvidence(discovery, rawMatch),
      { warning: warning('weak-discovery-evidence', 'Subject alignment uses discovery text only.', 'subject') },
    );
  }
  return signalEvaluation(policy, 'subject', 'unknown', null, rawPreferences, null, [], {
    missingSignal: 'subject',
    warning: warning('missing-scholarship-signal', 'Scholarship subject evidence is not structured.', 'subject'),
  });
}

function evaluateStudyLevel(
  context: ScholarshipMatchingContext,
  normalized: NormalizedScholarshipEligibility,
  policy: PersonalFitPolicy,
  discovery: string,
): SignalEvaluation {
  const rawPreference = targetDegree(context);
  const preference = canonicalStudyLevel(rawPreference);
  const requirement = normalized.studyLevel;
  if (requirement.state === 'absent' && preference == null) {
    return signalEvaluation(policy, 'study-level', 'unknown', null, null, null, []);
  }
  if (preference == null) {
    return signalEvaluation(policy, 'study-level', 'unknown', null, rawPreference, null, [], {
      missingSignal: 'study-level',
      warning: warning('missing-profile-signal', 'Study-level evidence is missing or unparseable.', 'study-level'),
    });
  }
  if (requirement.openToAll) {
    return signalEvaluation(policy, 'study-level', 'match', 'study-level-match', preference, ['all'], requirement.evidence.map((item) => item.excerpt));
  }
  if (requirement.state === 'parsed' && (requirement.values.length > 0 || requirement.excludedValues.length > 0)) {
    const matched = requirement.values.includes(preference) && !requirement.excludedValues.includes(preference);
    return matched
      ? signalEvaluation(policy, 'study-level', 'match', 'study-level-match', preference, requirement.values, requirement.evidence.map((item) => item.excerpt))
      : signalEvaluation(policy, 'study-level', 'mismatch', 'study-level-mismatch', preference, requirement.values, requirement.evidence.map((item) => item.excerpt));
  }
  if (rawPreference && containsDiscovery(discovery, rawPreference)) {
    return signalEvaluation(
      policy,
      'study-level',
      'weak-match',
      'study-level-discovery-match',
      rawPreference,
      null,
      discoveryEvidence(discovery, rawPreference),
      { warning: warning('weak-discovery-evidence', 'Study-level alignment uses discovery text only.', 'study-level') },
    );
  }
  return signalEvaluation(policy, 'study-level', 'unknown', null, preference, null, [], {
    missingSignal: 'study-level',
    warning: warning('missing-scholarship-signal', 'Scholarship study-level evidence is not structured.', 'study-level'),
  });
}

function evaluateIntake(
  context: ScholarshipMatchingContext,
  normalized: NormalizedScholarshipEligibility,
  policy: PersonalFitPolicy,
  discovery: string,
): SignalEvaluation {
  const requirement = normalized.intake;
  const target = targetIntake(context);
  const targetParts = parseIntake(target);
  if (requirement.state === 'absent' && !target) {
    return signalEvaluation(policy, 'intake', 'unknown', null, null, null, []);
  }
  if (requirement.state === 'absent') {
    return signalEvaluation(policy, 'intake', 'unknown', null, target, null, [], {
      missingSignal: 'intake',
      warning: warning('missing-scholarship-signal', 'Scholarship intake evidence is missing.', 'intake'),
    });
  }
  if (!target || (
    targetParts.seasons.length === 0
    && targetParts.months.length === 0
    && targetParts.years.length === 0
  )) {
    return signalEvaluation(policy, 'intake', 'unknown', null, target, requirement.years, requirement.evidence.map((item) => item.excerpt), {
      missingSignal: 'intake',
      warning: warning('missing-profile-signal', 'Target intake evidence is missing or unparseable.', 'intake'),
    });
  }
  if (requirement.state === 'ambiguous') {
    if (containsDiscovery(discovery, target)) {
      return signalEvaluation(policy, 'intake', 'weak-match', 'intake-discovery-match', target, null, discoveryEvidence(discovery, target), {
        warning: warning('weak-discovery-evidence', 'Intake alignment uses discovery text only.', 'intake'),
      });
    }
    return signalEvaluation(policy, 'intake', 'unknown', null, target, null, requirement.evidence.map((item) => item.excerpt), {
      missingSignal: 'intake',
      warning: warning('missing-scholarship-signal', 'Scholarship intake evidence is not structured.', 'intake'),
    });
  }

  if (requirement.years.length > 0 && !intersection(requirement.years, targetParts.years)) {
    return signalEvaluation(policy, 'intake', 'mismatch', 'intake-mismatch', target, requirement.years, requirement.evidence.map((item) => item.excerpt));
  }
  const targetMonths = [
    ...targetParts.months,
    ...targetParts.seasons.flatMap((season) => SEASON_MONTHS[season] ?? []),
  ];
  const requiredMonths = [
    ...requirement.months,
    ...requirement.seasons.flatMap((season) => SEASON_MONTHS[season] ?? []),
  ];
  if (requiredMonths.length > 0 && !intersection(requiredMonths, targetMonths)) {
    return signalEvaluation(policy, 'intake', 'mismatch', 'intake-mismatch', target, [...requirement.months], requirement.evidence.map((item) => item.excerpt));
  }
  return signalEvaluation(policy, 'intake', 'match', 'intake-match', target, [...requirement.months, ...requirement.years], requirement.evidence.map((item) => item.excerpt));
}

function evaluateFundingPreference(
  context: ScholarshipMatchingContext,
  scholarship: MatchingScholarshipContext,
  policy: PersonalFitPolicy,
): SignalEvaluation {
  const preference = canonicalFunding(context.student.fundingPreference);
  if (!preference) {
    return signalEvaluation(policy, 'funding-preference', 'unknown', null, context.student.fundingPreference, null, [], context.student.fundingPreference == null ? {
      missingSignal: 'funding-preference',
      warning: warning('missing-profile-signal', 'Funding preference evidence is missing.', 'funding-preference'),
    } : {});
  }
  const candidates = unique(
    scholarship.fundingType
      .map(canonicalFunding)
      .filter((value): value is string => value !== null),
  );
  if (candidates.length === 0) {
    return signalEvaluation(policy, 'funding-preference', 'unknown', null, preference, null, [], {
      missingSignal: 'funding-preference',
      warning: warning('missing-scholarship-signal', 'Scholarship funding-type evidence is missing.', 'funding-preference'),
    });
  }
  return candidates.includes(preference)
    ? signalEvaluation(policy, 'funding-preference', 'match', 'funding-preference-match', preference, candidates, [])
    : signalEvaluation(policy, 'funding-preference', 'mismatch', 'funding-preference-mismatch', preference, candidates, []);
}

function scaledBudgetNumber(value: string): number | null {
  const match = value.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(k|thousand)?/i);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return null;
  return parsed * (match[2] ? 1000 : 1);
}

function budgetConstraint(context: ScholarshipMatchingContext): BudgetConstraint | null {
  const explicit = cleanString(context.student.tuitionBudgetUsd);
  if (explicit) {
    const amount = scaledBudgetNumber(explicit);
    return amount == null ? null : { min: 0, max: amount, currency: 'USD' };
  }

  const range = cleanString(context.student.budgetRange);
  if (!range || !/(?:\$|usd)/i.test(range)) return null;
  const values = [...range.matchAll(/\d+(?:[,.]\d+)?\s*(?:k|thousand)?/gi)]
    .map((match) => scaledBudgetNumber(match[0]))
    .filter((value): value is number => value != null);
  if (values.length === 0) return null;
  const normalized = normalizedText(range);
  if (/\+|above|over|more/.test(normalized)) {
    return { min: values[0]!, max: null, currency: 'USD' };
  }
  if (/under|below|up to|upto|maximum|max/.test(normalized)) {
    return { min: 0, max: values[values.length - 1]!, currency: 'USD' };
  }
  return values.length > 1
    ? { min: values[0]!, max: values[1]!, currency: 'USD' }
    : { min: 0, max: values[0]!, currency: 'USD' };
}

function tuitionAmount(context: ScholarshipMatchingContext): BenefitAmount | null {
  return targetProgramme(context)?.tuitionAmount ?? null;
}

function evaluateBudget(
  context: ScholarshipMatchingContext,
  policy: PersonalFitPolicy,
): SignalEvaluation {
  const budget = budgetConstraint(context);
  if (!budget) {
    return signalEvaluation(policy, 'budget', 'unknown', null, context.student.budgetRange ?? context.student.tuitionBudgetUsd, null, [], {
      missingSignal: 'budget',
      warning: warning('missing-profile-signal', 'A comparable USD budget preference is unavailable.', 'budget'),
    });
  }
  const tuition = tuitionAmount(context);
  if (!tuition || tuition.currencyStatus !== 'known' || tuition.currency !== budget.currency) {
    return signalEvaluation(policy, 'budget', 'unknown', null, budget.max, tuition?.currency ?? null, [], {
      missingSignal: 'budget',
      warning: tuition?.currencyStatus === 'unknown' || (tuition && tuition.currency !== budget.currency)
        ? warning('budget-currency-unavailable', 'Programme tuition cannot be compared to the USD budget without a trusted conversion.', 'budget')
        : warning('missing-scholarship-signal', 'Programme tuition evidence is missing.', 'budget'),
    });
  }

  const candidateMax = tuition.max ?? tuition.min;
  if (budget.max != null && tuition.min > budget.max) {
    return signalEvaluation(policy, 'budget', 'mismatch', 'budget-misaligned', budget.max, { min: tuition.min, max: candidateMax }, []);
  }
  if (budget.max != null && tuition.max != null && candidateMax <= budget.max) {
    return signalEvaluation(policy, 'budget', 'match', 'budget-aligned', budget.max, { min: tuition.min, max: candidateMax }, []);
  }
  return signalEvaluation(policy, 'budget', 'partial', 'budget-partial', budget.max, { min: tuition.min, max: candidateMax }, []);
}

function scholarshipModes(scholarship: MatchingScholarshipContext): {
  strong: readonly string[];
  discovery: readonly string[];
} {
  const strong = unique(
    stringValues(rawValues(scholarship.raw, ['study_mode', 'study_modes', 'mode']))
      .map(canonicalMode)
      .filter((value): value is string => value !== null),
  );
  const discovery = unique(
    ['full-time', 'part-time', 'online', 'hybrid']
      .filter((value) => containsDiscovery(`${scholarship.appliesToText ?? ''} ${scholarship.conditions ?? ''}`, value)),
  );
  return { strong, discovery };
}

function evaluateStudyMode(
  context: ScholarshipMatchingContext,
  scholarship: MatchingScholarshipContext,
  policy: PersonalFitPolicy,
): SignalEvaluation {
  const rawPreference = targetStudyMode(context);
  const preference = canonicalMode(rawPreference);
  if (!preference) {
    return signalEvaluation(policy, 'study-mode', 'unknown', null, rawPreference, null, [], rawPreference == null ? {
      missingSignal: 'study-mode',
      warning: warning('missing-profile-signal', 'Study-mode preference evidence is missing.', 'study-mode'),
    } : {});
  }
  const modes = scholarshipModes(scholarship);
  if (modes.strong.length > 0) {
    return modes.strong.includes(preference)
      ? signalEvaluation(policy, 'study-mode', 'match', 'study-mode-match', rawPreference, modes.strong, [])
      : signalEvaluation(policy, 'study-mode', 'mismatch', 'study-mode-mismatch', rawPreference, modes.strong, []);
  }
  if (modes.discovery.includes(preference)) {
    return signalEvaluation(policy, 'study-mode', 'weak-match', 'study-mode-discovery-match', rawPreference, modes.discovery, [], {
      warning: warning('weak-discovery-evidence', 'Study-mode alignment uses discovery text only.', 'study-mode'),
    });
  }
  return signalEvaluation(policy, 'study-mode', 'unknown', null, rawPreference, null, [], {
    missingSignal: 'study-mode',
    warning: warning('missing-scholarship-signal', 'Scholarship study-mode evidence is missing.', 'study-mode'),
  });
}

function academicEvidencePresent(context: ScholarshipMatchingContext): boolean {
  const evidence = context.academicEvidence;
  return Boolean(
    context.student.gpaValue != null
    || evidence.achievements?.length
    || evidence.activities?.length
    || evidence.englishTests?.length
    || evidence.standardizedTests?.length,
  );
}

function profileCompleteness(context: ScholarshipMatchingContext): {
  ratio: number;
  present: number;
  total: number;
  missing: readonly PersonalFitSignal[];
} {
  const fields: ReadonlyArray<[PersonalFitSignal, boolean]> = [
    ['preferred-country', Boolean(context.student.preferredCountries)],
    ['subject', Boolean(context.student.targetSubjects?.length)],
    ['study-level', context.student.studyLevel != null],
    ['intake', context.student.targetIntake != null || context.student.applicationCycleYear != null],
    ['funding-preference', context.student.fundingPreference != null],
    ['budget', context.student.budgetRange != null || context.student.tuitionBudgetUsd != null],
    ['study-mode', context.student.studyMode != null],
    ['academic-evidence', academicEvidencePresent(context)],
    ['selected-programme', targetProgrammeId(context) != null],
  ];
  const present = fields.filter(([, value]) => value).length;
  const missing = fields.filter(([, value]) => !value).map(([signal]) => signal);
  return {
    ratio: fields.length === 0 ? 0 : present / fields.length,
    present,
    total: fields.length,
    missing,
  };
}

function mapEligibilitySignal(signal: string): PersonalFitSignal {
  switch (signal) {
    case 'nationality':
    case 'residency':
    case 'deadline':
    case 'policy-as-of':
    case 'eligibility-evidence':
      return 'eligibility';
    case 'university':
    case 'programme':
      return signal === 'programme' ? 'selected-programme' : 'university';
    case 'subject':
      return 'subject';
    case 'study-level':
      return 'study-level';
    case 'intake':
      return 'intake';
    case 'academic':
      return 'academic-evidence';
    default:
      return 'eligibility';
  }
}

function uniqueWarnings(values: readonly PersonalFitWarning[]): PersonalFitWarning[] {
  const seen = new Set<string>();
  return values.filter((item) => {
    const key = `${item.code}|${item.signal ?? ''}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function gateResult(
  input: ScorePersonalFitInput,
  policy: PersonalFitPolicy,
  status: PersonalFitStatus,
  eligibilityStatus: EligibilityStatus,
  contextMismatch = false,
): PersonalFitResult {
  const reasonCode = status === 'INELIGIBLE' ? 'eligibility-ineligible' : 'eligibility-unknown';
  const missingSignals = unique([
    ...(status === 'UNKNOWN' ? ['eligibility' as const] : []),
    ...input.eligibility.missingSignals.map(mapEligibilitySignal),
  ]);
  const gateWarning = contextMismatch
    ? warning('eligibility-context-mismatch', 'Eligibility result does not belong to the supplied scholarship.', 'eligibility')
    : warning('eligibility-gate', status === 'INELIGIBLE'
      ? 'Hard eligibility failed; personal fit cannot rescue this scholarship.'
      : 'Hard eligibility is unknown; personal fit is not treated as eligibility.', 'eligibility');
  return {
    scholarshipId: input.scholarship.id,
    eligibilityStatus,
    fitStatus: status,
    score: null,
    confidence: 0,
    reasonCodes: [reasonCode],
    reasonData: [{
      code: reasonCode,
      signal: 'eligibility',
      outcome: status === 'INELIGIBLE' ? 'mismatch' : 'unknown',
      weight: 0,
      contribution: 0,
      preference: null,
      candidate: input.eligibility.reasonCodes,
      evidence: [],
    }],
    warnings: [gateWarning],
    missingSignals,
    policyVersion: policy.version,
  };
}

/**
 * Score soft scholarship fit after hard eligibility has been evaluated.
 *
 * The score is a fixed-denominator weighted score. A missing signal contributes
 * zero rather than a positive default, while confidence reports how much of the
 * policy was actually supported by evidence. Unknown or ineligible hard
 * eligibility is a gate and never produces a rankable fit score.
 */
export function scorePersonalFit(input: ScorePersonalFitInput): PersonalFitResult {
  const policy = resolvePersonalFitPolicy(input.policy);
  if (input.eligibility.scholarshipId !== input.scholarship.id) {
    return gateResult(input, policy, 'UNKNOWN', 'UNKNOWN', true);
  }
  if (input.eligibility.status === 'INELIGIBLE') {
    return gateResult(input, policy, 'INELIGIBLE', input.eligibility.status);
  }
  if (input.eligibility.status === 'UNKNOWN') {
    return gateResult(input, policy, 'UNKNOWN', input.eligibility.status);
  }

  const normalized = input.eligibility.normalized;
  const discovery = discoveryText(input.scholarship, normalized);
  const evaluations: SignalEvaluation[] = [
    evaluatePreferredCountry(input.context, input.scholarship, policy),
    evaluateUniversity(input.context, input.scholarship, policy),
    evaluateSelectedProgramme(input.context, normalized, policy, discovery),
    evaluateSubject(input.context, normalized, policy, discovery),
    evaluateStudyLevel(input.context, normalized, policy, discovery),
    evaluateIntake(input.context, normalized, policy, discovery),
    evaluateFundingPreference(input.context, input.scholarship, policy),
    evaluateBudget(input.context, policy),
    evaluateStudyMode(input.context, input.scholarship, policy),
  ];

  const completeness = profileCompleteness(input.context);
  const completenessCode = completeness.ratio === 1
    ? 'profile-evidence-complete'
    : 'profile-evidence-partial';
  const reasonData: PersonalFitReasonData[] = [
    ...evaluations,
    {
      code: completenessCode,
      signal: 'profile-completeness',
      outcome: 'partial',
      weight: 0,
      contribution: 0,
      preference: `${completeness.present}/${completeness.total}`,
      candidate: null,
      evidence: [],
    },
  ];
  const reasonCodes: PersonalFitReasonCode[] = [completenessCode];
  const warnings: PersonalFitWarning[] = [];
  const missingSignals: PersonalFitSignal[] = [...completeness.missing];
  let activeWeight = 0;
  let totalWeight = 0;
  let contribution = 0;

  for (const item of evaluations) {
    totalWeight += item.weight;
    if (item.outcome !== 'unknown') activeWeight += item.weight;
    contribution += item.contribution;
    if (item.code) reasonCodes.push(item.code);
    if (item.missingSignal) missingSignals.push(item.missingSignal);
    if (item.warning) warnings.push(item.warning);
  }

  if (completeness.ratio < 1) {
    warnings.push(warning('missing-profile-signal', 'Some profile or academic evidence signals are missing.', 'profile-completeness'));
  }
  if (activeWeight === 0) {
    reasonCodes.push('no-fit-signals');
    warnings.push(warning('no-fit-signals', 'No scholarship/profile pairings were supported by comparable evidence.'));
  }

  const score = totalWeight === 0 ? 0 : rounded((contribution / totalWeight) * 100);
  const confidence = totalWeight === 0
    ? 0
    : rounded((activeWeight / totalWeight) * completeness.ratio);

  return {
    scholarshipId: input.scholarship.id,
    eligibilityStatus: 'ELIGIBLE',
    fitStatus: 'SCORED',
    score,
    confidence,
    reasonCodes: unique(reasonCodes),
    reasonData,
    warnings: uniqueWarnings(warnings),
    missingSignals: unique(missingSignals),
    policyVersion: policy.version,
  };
}
