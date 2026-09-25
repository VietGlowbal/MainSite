import { NATIONALITY_CATALOG } from '../../../lib/nationality-catalog';
import type { MatchingScholarshipContext } from './matching-context';

/** Bump when free-text extraction semantics change. */
export const SCHOLARSHIP_ELIGIBILITY_NORMALIZER_VERSION =
  'scholarship-eligibility-normalizer-v1';

export type EligibilityRequirementState = 'absent' | 'parsed' | 'ambiguous';

export type EligibilityEvidenceField =
  | 'eligibility'
  | 'appliesToText'
  | 'conditions'
  | 'raw';

export type EligibilityEvidence = {
  field: EligibilityEvidenceField;
  excerpt: string;
  sourceUrl: string | null;
};

export type NormalizedTextRequirement = {
  state: EligibilityRequirementState;
  values: readonly string[];
  excludedValues: readonly string[];
  openToAll: boolean;
  evidence: readonly EligibilityEvidence[];
};

export type NormalizedNationalityRequirement = {
  state: EligibilityRequirementState;
  allowedNationalities: readonly string[];
  excludedNationalities: readonly string[];
  residencyCountries: readonly string[];
  residencyState: EligibilityRequirementState;
  openToAll: boolean;
  evidence: readonly EligibilityEvidence[];
};

export type NormalizedInstitutionRequirement = {
  state: EligibilityRequirementState;
  universityIds: readonly number[];
  programmeIds: readonly string[];
  evidence: readonly EligibilityEvidence[];
};

export type NormalizedDeadlineRequirement = {
  state: 'absent' | 'open' | 'closed' | 'date' | 'ambiguous';
  date: string | null;
  evidence: readonly EligibilityEvidence[];
};

export type IntakeSeason = 'spring' | 'summer' | 'autumn' | 'winter';

export type NormalizedIntakeRequirement = {
  state: EligibilityRequirementState;
  seasons: readonly IntakeSeason[];
  months: readonly number[];
  years: readonly number[];
  evidence: readonly EligibilityEvidence[];
};

export type NormalizedAcademicTestRequirement = {
  testType: string;
  minimum: number;
  evidence: EligibilityEvidence;
};

export type NormalizedAcademicRequirement = {
  state: EligibilityRequirementState;
  gpaMinimum: number | null;
  gpaScale: number | null;
  percentageMinimum: number | null;
  tests: readonly NormalizedAcademicTestRequirement[];
  evidence: readonly EligibilityEvidence[];
};

export type EligibilityNormalizationWarningCode =
  | 'ambiguous-nationality'
  | 'ambiguous-residency'
  | 'ambiguous-study-level'
  | 'ambiguous-subject'
  | 'ambiguous-university'
  | 'ambiguous-programme'
  | 'ambiguous-deadline'
  | 'ambiguous-intake'
  | 'ambiguous-academic-requirement';

export type EligibilityNormalizationWarning = {
  code: EligibilityNormalizationWarningCode;
  message: string;
};

export type NormalizedScholarshipEligibility = {
  normalizerVersion: typeof SCHOLARSHIP_ELIGIBILITY_NORMALIZER_VERSION;
  nationality: NormalizedNationalityRequirement;
  studyLevel: NormalizedTextRequirement;
  subject: NormalizedTextRequirement;
  university: NormalizedInstitutionRequirement;
  programme: NormalizedInstitutionRequirement;
  deadline: NormalizedDeadlineRequirement;
  intake: NormalizedIntakeRequirement;
  academic: NormalizedAcademicRequirement;
  sourceTexts: readonly EligibilityEvidence[];
  hasVerifiableRequirement: boolean;
  warnings: readonly EligibilityNormalizationWarning[];
};

export type DirectoryDeadlineFilter = 'any' | 'open' | 'closed' | 'undated';

export type DirectoryValueFilter = {
  min: number | null;
  max: number | null;
  currency: string | null;
};

/**
 * Structured directory filters. `subject` and `degree` are verified only when
 * a caller supplies normalized facts. Existing keyword search remains a
 * discovery fallback and is deliberately not represented as eligibility.
 */
export type ScholarshipDirectoryFilters = {
  country: string | null;
  universityIds: readonly number[];
  subject: string | null;
  major: string | null;
  degree: string | null;
  fundingTypes: readonly string[];
  deadline: DirectoryDeadlineFilter;
  value: DirectoryValueFilter | null;
};

export type ScholarshipDirectoryFilterInput = {
  country?: string | null;
  universityIds?: readonly number[] | null;
  subject?: string | null;
  major?: string | null;
  degree?: string | null;
  fundingTypes?: readonly string[] | null;
  deadline?: DirectoryDeadlineFilter | null;
  value?: Partial<DirectoryValueFilter> | null;
};

type SourceSegment = {
  field: EligibilityEvidenceField;
  text: string;
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

const SEASONS: ReadonlyArray<[IntakeSeason, RegExp]> = [
  ['spring', /\bspring\b/i],
  ['summer', /\bsummer\b/i],
  ['autumn', /\b(?:autumn|fall)\b/i],
  ['winter', /\bwinter\b/i],
];

const DEGREE_ALIASES: ReadonlyArray<[string, RegExp]> = [
  ['undergraduate', /\b(?:undergraduate|bachelor(?:'s|s)?|bsc|ba|first[- ]degree)\b/i],
  ['postgraduate', /\b(?:postgraduate|master(?:'s|s)?|msc|ma|mba|graduate)\b/i],
  ['doctoral', /\b(?:doctoral|doctorate|phd|dphil)\b/i],
];

const SUBJECT_GROUPS: ReadonlyArray<{ key: string; aliases: readonly string[] }> = [
  { key: 'computer-science', aliases: ['computer science', 'computing', 'informatics'] },
  { key: 'engineering', aliases: ['engineering', 'engineering sciences'] },
  { key: 'mathematics', aliases: ['mathematics', 'mathematical sciences', 'maths', 'math'] },
  { key: 'business', aliases: ['business', 'business studies', 'management'] },
  { key: 'economics', aliases: ['economics', 'economic studies'] },
  { key: 'finance', aliases: ['finance', 'financial studies'] },
  { key: 'marketing', aliases: ['marketing'] },
  { key: 'law', aliases: ['law', 'legal studies'] },
  { key: 'health', aliases: ['health', 'health sciences', 'public health'] },
  { key: 'medicine', aliases: ['medicine', 'medical sciences'] },
  { key: 'nursing', aliases: ['nursing'] },
  { key: 'pharmacy', aliases: ['pharmacy', 'pharmaceutical sciences'] },
  { key: 'arts', aliases: ['arts', 'fine arts', 'performing arts'] },
  { key: 'design', aliases: ['design'] },
  { key: 'music', aliases: ['music'] },
  { key: 'humanities', aliases: ['humanities'] },
  { key: 'social-sciences', aliases: ['social sciences'] },
  { key: 'education', aliases: ['education', 'teaching'] },
  { key: 'environmental-science', aliases: ['environmental science', 'environmental studies'] },
];

const ACADEMIC_TEST_ALIASES: ReadonlyArray<[string, RegExp]> = [
  ['ielts', /\bielts\b/i],
  ['toefl', /\btoefl\b/i],
  ['pte', /\bpte\b/i],
  ['sat', /\bsat\b/i],
  ['act', /\bact\b/i],
  ['gre', /\bgre\b/i],
  ['gmat', /\bgmat\b/i],
];

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function evidence(
  field: EligibilityEvidenceField,
  excerpt: string,
  sourceUrl: string | null,
): EligibilityEvidence {
  return { field, excerpt: clean(excerpt), sourceUrl };
}

function sourceSegments(scholarship: MatchingScholarshipContext): SourceSegment[] {
  const segments: SourceSegment[] = [];
  const add = (field: EligibilityEvidenceField, value: string | null) => {
    const text = value ? clean(value) : '';
    if (text) segments.push({ field, text });
  };

  add('eligibility', scholarship.eligibility);
  add('appliesToText', scholarship.appliesToText);
  add('conditions', scholarship.conditions);

  const raw = scholarship.raw;
  for (const key of [
    'eligibility',
    'eligibility_text',
    'eligible_nationalities',
    'nationalities',
    'citizenships',
    'residency',
    'residencies',
    'study_level',
    'degree_level',
    'degree_levels',
    'subject',
    'subjects',
    'major',
    'majors',
    'intake',
    'intakes',
    'cycle',
    'cycles',
    'academic_requirements',
    'gpa_requirement',
    'deadline_date',
    'deadline_text',
    'status',
    'closed',
    'is_closed',
  ]) {
    const value = raw[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      add('raw', String(value));
    } else if (Array.isArray(value)) {
      const text = value.filter((item): item is string | number =>
        typeof item === 'string' || typeof item === 'number',
      ).join(', ');
      add('raw', text);
    }
  }

  return segments;
}

function rawValues(raw: Record<string, unknown>, keys: readonly string[]): unknown[] {
  return keys.flatMap((key) => {
    const value = raw[key];
    return Array.isArray(value) ? value : value == null ? [] : [value];
  });
}

function phrasePattern(value: string): RegExp {
  const words = normalized(value).split(' ').filter(Boolean).map((word) =>
    word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  return new RegExp(`(?:^|\\s)${words.join('\\s+')}(?=\\s|$)`, 'i');
}

function containsPhrase(text: string, value: string): boolean {
  return phrasePattern(value).test(normalized(text));
}

function knownNationalityCode(value: string): string | null {
  const needle = normalized(value);
  const entry = NATIONALITY_CATALOG.find((candidate) =>
    [candidate.nationality, candidate.iso2, ...candidate.aliases]
      .some((alias) => normalized(alias) === needle),
  );
  return entry?.iso2 ?? null;
}

function nationalityCodesInText(text: string): string[] {
  const result: string[] = [];
  for (const entry of NATIONALITY_CATALOG) {
    const aliases = [entry.nationality, entry.iso2, ...entry.aliases];
    if (aliases.some((alias) => containsPhrase(text, alias))) result.push(entry.iso2);
  }
  return unique(result);
}

export function canonicalNationality(value: string | null | undefined): string | null {
  if (!value) return null;
  return knownNationalityCode(value);
}

export function canonicalStudyLevel(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = DEGREE_ALIASES.find(([, pattern]) => pattern.test(value));
  return match?.[0] ?? null;
}

export function canonicalSubject(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalizedValue = normalized(value);
  const match = SUBJECT_GROUPS.find(({ aliases }) =>
    aliases.some((alias) => normalized(alias) === normalizedValue),
  );
  return match?.key ?? (normalizedValue ? `phrase:${normalizedValue}` : null);
}

function textRequirement(
  segments: readonly SourceSegment[],
  kind: 'studyLevel' | 'subject',
  sourceUrl: string | null,
): NormalizedTextRequirement {
  const values: string[] = [];
  const excludedValues: string[] = [];
  const matchedEvidence: EligibilityEvidence[] = [];
  let markerFound = false;
  let openToAll = false;

  for (const segment of segments) {
    const text = segment.text;
    const words = normalized(text);
    const marker = kind === 'studyLevel'
      ? /\b(?:degree|level|undergraduate|bachelor|postgraduate|master|graduate|doctoral|doctorate|phd|dphil|mba)\b/i.test(text)
      : /\b(?:subject|major|field|discipline|stud(?:y|ying)\s+in|majoring|programme\s+in|course\s+in)\b/i.test(text);
    const aliases = kind === 'studyLevel'
      ? DEGREE_ALIASES
      : SUBJECT_GROUPS.flatMap(({ key, aliases: subjectAliases }) =>
          subjectAliases.map((alias) => [key, phrasePattern(alias)] as const),
        );

    if (marker) markerFound = true;
    if (
      (kind === 'studyLevel' && /\b(?:all|any)\s+(?:study\s+)?levels?\b/i.test(text)) ||
      (kind === 'subject' && /\b(?:all|any)\s+(?:subjects?|fields?|majors?)\b/i.test(text))
    ) {
      openToAll = true;
      matchedEvidence.push(evidence(segment.field, text, sourceUrl));
    }

    for (const [key, pattern] of aliases) {
      if (!pattern.test(words)) continue;
      const value = key;
      const isExcluded = /\b(?:not|except|excluding|exclude|ineligible)\b/i.test(text);
      (isExcluded ? excludedValues : values).push(value);
      matchedEvidence.push(evidence(segment.field, text, sourceUrl));
    }
  }

  const uniqueValues = unique(values);
  const uniqueExcluded = unique(excludedValues);
  const state: EligibilityRequirementState =
    uniqueValues.length > 0 || uniqueExcluded.length > 0 || openToAll
      ? 'parsed'
      : markerFound
        ? 'ambiguous'
        : 'absent';

  return {
    state,
    values: uniqueValues,
    excludedValues: uniqueExcluded,
    openToAll,
    evidence: uniqueEvidence(matchedEvidence),
  };
}

function uniqueEvidence(values: readonly EligibilityEvidence[]): EligibilityEvidence[] {
  const seen = new Set<string>();
  return values.filter((item) => {
    const key = `${item.field}|${item.excerpt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function nationalityRequirement(
  scholarship: MatchingScholarshipContext,
  segments: readonly SourceSegment[],
): NormalizedNationalityRequirement {
  const allowed: string[] = [];
  const excluded: string[] = [];
  const residency: string[] = [];
  const matchedEvidence: EligibilityEvidence[] = [];
  const raw = scholarship.raw;
  const rawAllowed = rawValues(raw, ['eligible_nationalities', 'nationalities', 'citizenships']);
  const rawResidency = rawValues(raw, ['residency', 'residencies', 'eligible_residencies']);
  let markerFound = false;
  let residencyMarker = false;
  let openToAll = false;

  for (const value of rawAllowed) {
    if (typeof value !== 'string') continue;
    const code = knownNationalityCode(value);
    if (code) allowed.push(code);
  }
  for (const value of rawResidency) {
    if (typeof value !== 'string') continue;
    const code = knownNationalityCode(value);
    if (code) residency.push(code);
  }

  for (const segment of segments) {
    const text = segment.text;
    const isResidency = /\b(?:residen(?:t|cy|ts?)|residing|permanent resident|home students?)\b/i.test(text);
    const codes = nationalityCodesInText(text);
    if (
      /\b(?:citizens?|nationals?|nationality|international students?|domestic students?)\b/i.test(text) ||
      (codes.length > 0 && /\bfrom\b/i.test(text)) ||
      /\bfrom\s+(?:developing|emerging)\s+countries\b/i.test(text)
    ) {
      markerFound = true;
    }
    if (isResidency) {
      residencyMarker = true;
    }
    if (/\b(?:international students?|all nationalities|any nationality)\b/i.test(text)) {
      openToAll = true;
      matchedEvidence.push(evidence(segment.field, text, scholarship.sourceUrl));
    }

    const isExcluded = /\b(?:not|except|excluding|exclude|ineligible)\b/i.test(text);
    if (isResidency) {
      residency.push(...codes);
    } else if (isExcluded) {
      excluded.push(...codes);
    } else {
      allowed.push(...codes);
    }
    if (codes.length > 0 || isExcluded) {
      matchedEvidence.push(evidence(segment.field, text, scholarship.sourceUrl));
    }
  }

  const uniqueAllowed = unique(allowed).filter((value) => !excluded.includes(value));
  const uniqueExcluded = unique(excluded);
  const uniqueResidency = unique(residency);
  const residencyState: EligibilityRequirementState = uniqueResidency.length > 0
    ? 'parsed'
    : residencyMarker || rawResidency.length > 0
      ? 'ambiguous'
      : 'absent';
  const state: EligibilityRequirementState =
    uniqueAllowed.length > 0 || uniqueExcluded.length > 0 || openToAll
      ? 'parsed'
      : markerFound
        ? 'ambiguous'
        : 'absent';

  return {
    state,
    allowedNationalities: uniqueAllowed,
    excludedNationalities: uniqueExcluded,
    residencyCountries: uniqueResidency,
    residencyState,
    openToAll,
    evidence: uniqueEvidence(matchedEvidence),
  };
}

function numericIds(raw: Record<string, unknown>, keys: readonly string[]): number[] {
  return unique(
    rawValues(raw, keys)
      .map((value) => typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN)
      .filter((value) => Number.isSafeInteger(value) && value > 0),
  );
}

function stringIds(raw: Record<string, unknown>, keys: readonly string[]): string[] {
  return unique(
    rawValues(raw, keys)
      .map((value) => typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '')
      .filter(Boolean),
  );
}

function institutionRequirement(
  scholarship: MatchingScholarshipContext,
  segments: readonly SourceSegment[],
  kind: 'university' | 'programme',
): NormalizedInstitutionRequirement {
  const raw = scholarship.raw;
  const universityIds = numericIds(raw, ['university_ids', 'eligible_university_ids']);
  const programmeIds = stringIds(raw, ['programme_ids', 'program_ids', 'course_ids', 'eligible_programme_ids']);
  if (kind === 'university') universityIds.push(...scholarship.universityIds);

  const matchedEvidence: EligibilityEvidence[] = [];
  const text = segments
    .filter((segment) => kind === 'university'
      ? segment.field === 'appliesToText' || /\buniversity|college|institution|school\b/i.test(segment.text)
      : segment.field === 'appliesToText' || /\b(?:programme|program|course|major|faculty)\b/i.test(segment.text))
    .map((segment) => {
      matchedEvidence.push(evidence(segment.field, segment.text, scholarship.sourceUrl));
      return segment.text;
    })
    .join(' ');

  const hasTextRestriction = kind === 'university'
    ? /\b(?:university|college|institution|school)\b/i.test(text)
    : /\b(?:programme|program|course|major|faculty)\b/i.test(text);
  const scopeRestriction = kind === 'university' && scholarship.scope === 'university';
  const idsPresent = kind === 'university' ? universityIds.length > 0 : programmeIds.length > 0;
  const state: EligibilityRequirementState = idsPresent
    ? 'parsed'
    : hasTextRestriction || scopeRestriction
      ? 'ambiguous'
      : 'absent';

  return {
    state,
    universityIds: unique(universityIds),
    programmeIds: unique(programmeIds),
    evidence: uniqueEvidence(matchedEvidence),
  };
}

function parseCalendarDate(value: string): string | null {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(value);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  if (!/[a-z]/i.test(value)) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10);
}

function deadlineRequirement(
  scholarship: MatchingScholarshipContext,
  segments: readonly SourceSegment[],
): NormalizedDeadlineRequirement {
  const raw = scholarship.raw;
  const rawClosed = raw['closed'] ?? raw['is_closed'];
  const rawStatus = typeof raw['status'] === 'string' ? raw['status'] : null;
  const directDeadline = scholarship.deadline ? clean(scholarship.deadline) : '';
  const directEvidence = directDeadline
    ? [evidence('raw', directDeadline, scholarship.sourceUrl)]
    : [];

  const closedFlag = rawClosed === true || (typeof rawClosed === 'string' && /^true$/i.test(rawClosed));
  if (closedFlag || /^(?:closed|expired|archived)$/i.test(rawStatus ?? '')) {
    return { state: 'closed', date: null, evidence: directEvidence };
  }

  if (directDeadline) {
    const directDate = parseCalendarDate(directDeadline);
    if (directDate) return { state: 'date', date: directDate, evidence: directEvidence };
    if (/\b(?:closed|expired|no longer accepting|applications? (?:have )?closed)\b/i.test(directDeadline)) {
      return { state: 'closed', date: null, evidence: directEvidence };
    }
    if (/\b(?:rolling|ongoing|no deadline|open(?: now)?|year[- ]round)\b/i.test(directDeadline)) {
      return { state: 'open', date: null, evidence: directEvidence };
    }
    return { state: 'ambiguous', date: null, evidence: directEvidence };
  }

  const text = segments
    .filter((segment) => /\b(?:deadline|closed|expired|rolling|ongoing|application)\b/i.test(segment.text))
    .map((segment) => segment.text)
    .filter((value): value is string => Boolean(value))
    .join(' ');
  const matchedEvidence = text ? [evidence('raw', text, scholarship.sourceUrl)] : [];

  if (
    closedFlag ||
    /\b(?:closed|expired|no longer accepting|applications? (?:have )?closed)\b/i.test(text) ||
    /^(?:closed|expired|archived)$/i.test(rawStatus ?? '')
  ) {
    return { state: 'closed', date: null, evidence: uniqueEvidence(matchedEvidence) };
  }
  if (
    /\b(?:rolling|ongoing|no deadline|open(?: now)?|year[- ]round)\b/i.test(text) ||
    rawStatus === 'open'
  ) {
    return { state: 'open', date: null, evidence: uniqueEvidence(matchedEvidence) };
  }
  if (!text) return { state: 'absent', date: null, evidence: [] };
  const date = parseCalendarDate(text);
  if (date) return { state: 'date', date, evidence: uniqueEvidence(matchedEvidence) };
  return { state: 'ambiguous', date: null, evidence: uniqueEvidence(matchedEvidence) };
}

function intakeRequirement(
  scholarship: MatchingScholarshipContext,
  segments: readonly SourceSegment[],
): NormalizedIntakeRequirement {
  const raw = scholarship.raw;
  const rawValuesForIntake = rawValues(raw, ['intake', 'intakes', 'cycle', 'cycles', 'academic_year']);
  const intakeText = [
    ...rawValuesForIntake.filter((value): value is string | number =>
      typeof value === 'string' || typeof value === 'number',
    ).map(String),
    ...segments
      .filter((segment) => /\b(?:intake|cycle|cohort|commenc|start|entry|academic year)\b/i.test(segment.text))
      .map((segment) => segment.text),
  ].join(' ');
  if (!intakeText) return { state: 'absent', seasons: [], months: [], years: [], evidence: [] };

  const seasons = SEASONS.filter(([, pattern]) => pattern.test(intakeText)).map(([season]) => season);
  const months = MONTHS
    .filter(([month]) => new RegExp(`\\b${month}\\b`, 'i').test(intakeText))
    .map(([, month]) => month);
  const years = [...intakeText.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  const source = evidence('raw', intakeText, scholarship.sourceUrl);
  const state: EligibilityRequirementState =
    seasons.length > 0 || months.length > 0 || years.length > 0 ? 'parsed' : 'ambiguous';
  return {
    state,
    seasons: unique(seasons),
    months: unique(months),
    years: unique(years),
    evidence: [source],
  };
}

function academicRequirement(
  scholarship: MatchingScholarshipContext,
  segments: readonly SourceSegment[],
): NormalizedAcademicRequirement {
  const text = segments
    .filter((segment) => segment.field !== 'appliesToText')
    .map((segment) => segment.text)
    .join(' ');
  const matchedEvidence: EligibilityEvidence[] = [];
  let gpaMinimum: number | null = null;
  let gpaScale: number | null = null;
  let percentageMinimum: number | null = null;
  const tests: NormalizedAcademicTestRequirement[] = [];

  for (const match of text.matchAll(
    /\b(?:gpa|grade\s+point\s+average)\s*(?:of|is|at\s+least|>=|:)?\s*(\d+(?:\.\d+)?)\s*(?:(?:\/|out\s+of)\s*(\d+(?:\.\d+)?))?/gi,
  )) {
    const minimum = Number(match[1]);
    if (!Number.isFinite(minimum)) continue;
    gpaMinimum = gpaMinimum == null ? minimum : Math.max(gpaMinimum, minimum);
    const scale = match[2] ? Number(match[2]) : null;
    if (scale != null && Number.isFinite(scale)) gpaScale = scale;
    matchedEvidence.push(evidence('eligibility', match[0], scholarship.sourceUrl));
  }

  for (const match of text.matchAll(
    /\b(?:minimum|at\s+least|required|average|academic|grade(?:s)?|mark(?:s)?)\b[^.;]{0,45}?(\d{2,3}(?:\.\d+)?)\s*%/gi,
  )) {
    const minimum = Number(match[1]);
    if (minimum >= 0 && minimum <= 100) {
      percentageMinimum = percentageMinimum == null ? minimum : Math.max(percentageMinimum, minimum);
      matchedEvidence.push(evidence('eligibility', match[0], scholarship.sourceUrl));
    }
  }

  for (const [testType, pattern] of ACADEMIC_TEST_ALIASES) {
    const expression = new RegExp(`${pattern.source}[^.;]{0,35}?(?:score\\s*(?:of|is|at\\s+least|:)?\\s*)?(\\d+(?:\\.\\d+)?)`, 'i');
    const match = expression.exec(text);
    if (!match?.[1]) continue;
    const minimum = Number(match[1]);
    if (!Number.isFinite(minimum)) continue;
    const item = {
      testType,
      minimum,
      evidence: evidence('eligibility', match[0], scholarship.sourceUrl),
    };
    tests.push(item);
    matchedEvidence.push(item.evidence);
  }

  const academicMarker = /\b(?:academic|gpa|grade|mark|score|ielts|toefl|pte|sat|act|gre|gmat|minimum requirement|first[- ]class|honou?rs?)\b/i.test(text);
  const state: EligibilityRequirementState =
    gpaMinimum != null || percentageMinimum != null || tests.length > 0
      ? 'parsed'
      : academicMarker
        ? 'ambiguous'
        : 'absent';
  return {
    state,
    gpaMinimum,
    gpaScale,
    percentageMinimum,
    tests,
    evidence: uniqueEvidence(matchedEvidence),
  };
}

function warning(
  code: EligibilityNormalizationWarningCode,
  message: string,
): EligibilityNormalizationWarning {
  return { code, message };
}

/**
 * Normalize only explicit, deterministic eligibility facts. Unparseable prose
 * is retained as an ambiguous requirement so the evaluator can fail closed.
 */
export function normalizeScholarshipEligibility(
  scholarship: MatchingScholarshipContext,
): NormalizedScholarshipEligibility {
  const segments = sourceSegments(scholarship);
  const nationality = nationalityRequirement(scholarship, segments);
  const studyLevel = textRequirement(segments, 'studyLevel', scholarship.sourceUrl);
  const subject = textRequirement(segments, 'subject', scholarship.sourceUrl);
  const university = institutionRequirement(scholarship, segments, 'university');
  const programme = institutionRequirement(scholarship, segments, 'programme');
  const deadline = deadlineRequirement(scholarship, segments);
  const intake = intakeRequirement(scholarship, segments);
  const academic = academicRequirement(scholarship, segments);

  const warnings: EligibilityNormalizationWarning[] = [];
  if (nationality.state === 'ambiguous') warnings.push(warning('ambiguous-nationality', 'Nationality eligibility could not be parsed into supported countries.'));
  if (nationality.residencyState === 'ambiguous') warnings.push(warning('ambiguous-residency', 'Residency eligibility was stated but the country or required signal was not parseable.'));
  if (studyLevel.state === 'ambiguous') warnings.push(warning('ambiguous-study-level', 'Study-level eligibility was stated but not parseable.'));
  if (subject.state === 'ambiguous') warnings.push(warning('ambiguous-subject', 'Subject eligibility was stated but not parseable.'));
  if (university.state === 'ambiguous') warnings.push(warning('ambiguous-university', 'University eligibility was stated without a verifiable structured university id.'));
  if (programme.state === 'ambiguous') warnings.push(warning('ambiguous-programme', 'Programme eligibility was stated without a verifiable structured programme id.'));
  if (deadline.state === 'ambiguous') warnings.push(warning('ambiguous-deadline', 'The deadline text was present but not parseable as open, closed, or a date.'));
  if (intake.state === 'ambiguous') warnings.push(warning('ambiguous-intake', 'The intake or cycle text was present but not parseable.'));
  if (academic.state === 'ambiguous') warnings.push(warning('ambiguous-academic-requirement', 'Academic requirements were stated but not parseable into supported thresholds.'));

  const sourceTexts = uniqueEvidence(segments.map((segment) => evidence(segment.field, segment.text, scholarship.sourceUrl)));
  const hasVerifiableRequirement =
    nationality.state === 'parsed' ||
    studyLevel.state === 'parsed' ||
    subject.state === 'parsed' ||
    university.state === 'parsed' ||
    programme.state === 'parsed' ||
    deadline.state !== 'absent' ||
    intake.state === 'parsed' ||
    academic.state === 'parsed';

  return {
    normalizerVersion: SCHOLARSHIP_ELIGIBILITY_NORMALIZER_VERSION,
    nationality,
    studyLevel,
    subject,
    university,
    programme,
    deadline,
    intake,
    academic,
    sourceTexts,
    hasVerifiableRequirement,
    warnings,
  };
}

function finiteNonNegative(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Normalize the public/query-layer filter shape without inferring facts. */
export function normalizeScholarshipDirectoryFilters(
  input: ScholarshipDirectoryFilterInput = {},
): ScholarshipDirectoryFilters {
  const min = finiteNonNegative(input.value?.min);
  const max = finiteNonNegative(input.value?.max);
  const value = min == null && max == null
    ? null
    : {
        min,
        max: max != null && min != null && max < min ? min : max,
        currency: input.value?.currency?.trim().toUpperCase() || null,
      };
  const universityIds = unique(
    (input.universityIds ?? [])
      .filter((value): value is number => Number.isSafeInteger(value) && value > 0),
  ).sort((left, right) => left - right);
  const country = input.country?.trim() || null;
  const subject = input.subject?.trim() || null;
  const major = input.major?.trim() || null;
  const degree = input.degree?.trim() || null;
  return {
    country: country === 'all' ? null : country,
    universityIds,
    subject,
    major: major === 'all' ? null : major,
    degree: degree === 'all' ? null : degree,
    fundingTypes: unique(
      (input.fundingTypes ?? [])
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ).sort(),
    deadline: input.deadline ?? 'any',
    value,
  };
}
