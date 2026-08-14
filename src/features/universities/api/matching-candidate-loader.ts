import type { SupabaseClient } from '@supabase/supabase-js';
import { rankProgrammeMatches, type DegreeRequirement, type MatchEvidence, type MatchingProgrammeCandidate, type RankedProgrammeMatch, type StudentMatchingProfile, type SubjectPrerequisiteRequirement, type TestRequirement } from '../domain/matching';
import type { CatalogueFieldValue, CatalogueProgrammeMatchingRecord } from './programme-queries';
import type { UniversityListItem } from './university-queries';
import { getProgrammeQueries, getUniversityQueries } from './index';

const RELIABILITY = (status: string | null): MatchEvidence['reliability'] =>
  status === 'HUMAN_VERIFIED' ? 'human_verified' : status === 'RULE_VALIDATED' ? 'rule_validated' : 'crawler_extracted';

const TRUSTED_STATUSES = new Set(['HUMAN_VERIFIED', 'RULE_VALIDATED']);
const VERIFICATION_RANK: Record<string, number> = {
  HUMAN_VERIFIED: 5,
  RULE_VALIDATED: 4,
  AI_EXTRACTED: 3,
  FETCHED: 2,
  DISCOVERED: 1,
};
const NORMALIZED_MATCHING_FIELDS = new Set([
  'minimum_degree', 'minimum_gpa', 'gpa_scale', 'subject_prerequisites',
  'admission_difficulty', 'ielts_overall', 'ielts_subscores', 'toefl',
  'duolingo', 'standardized_tests', 'tuition',
]);

type MatchingContext = {
  audience?: string | null;
  academicCycle?: string | null;
};

function evidence(
  source: string,
  scope: MatchEvidence['scope'],
  field: string,
  value: unknown,
  reliability: MatchEvidence['reliability'],
  sourceUrl?: string | null,
  note?: string,
): MatchEvidence {
  return { source, scope, field, value, reliability, ...(sourceUrl ? { sourceUrl } : {}), ...(note ? { note } : {}) };
}

function canonicalTestType(value: string): string {
  const normalised = value.toLowerCase();
  if (normalised.includes('ielts')) return 'ielts';
  if (normalised.includes('toefl')) return 'toefl';
  if (normalised.includes('pte')) return 'pte';
  if (normalised.includes('duolingo')) return 'duolingo';
  if (normalised.includes('cambridge')) return 'cambridge';
  return normalised.replace(/[^a-z0-9]+/g, '');
}

function canonicalGpaScale(value: string): string {
  const match = value.match(/\d+(?:\.\d+)?/);
  if (!match) return value.trim().toLowerCase();
  const scale = Number(match[0]);
  return Number.isInteger(scale) ? `${scale}.0 scale` : `${scale} scale`;
}

function jsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text.startsWith('{') && !text.startsWith('[')) return value;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return value;
  }
}

function recordValue(value: unknown): Record<string, unknown> | null {
  const parsed = jsonValue(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function firstNumber(value: unknown, keys: string[]): number | null {
  const object = recordValue(value);
  if (object) {
    for (const key of keys) {
      const number = finiteNumber(object[key]);
      if (number !== null) return number;
    }
  }
  return finiteNumber(value);
}

function firstString(value: unknown, keys: string[]): string | null {
  const object = recordValue(value);
  if (object) {
    for (const key of keys) {
      if (typeof object[key] === 'string' && object[key].trim()) return object[key].trim();
    }
  }
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstScalarString(value: unknown, keys: string[]): string | null {
  const object = recordValue(value);
  if (object) {
    for (const key of keys) {
      if (typeof object[key] === 'string' && object[key].trim()) return object[key].trim();
      const number = finiteNumber(object[key]);
      if (number !== null) return String(number);
    }
  }
  if (typeof value === 'string' && value.trim()) return value.trim();
  const number = finiteNumber(value);
  return number === null ? null : String(number);
}

function yearTokens(value: string | null | undefined): string[] {
  return (value ?? '').match(/\d{4}/g) ?? [];
}

function cycleMatches(factCycle: string | null, requestedCycle: string | null | undefined): boolean {
  if (!factCycle || !requestedCycle) return true;
  const factYears = yearTokens(factCycle);
  const requestedYears = yearTokens(requestedCycle);
  if (factYears.length === 0 || requestedYears.length === 0) return factCycle.trim().toLowerCase() === requestedCycle.trim().toLowerCase();
  return factYears.some((year) => requestedYears.includes(year));
}

function audienceMatches(factAudience: string | null, requestedAudience: string): boolean {
  const audience = factAudience?.trim().toLowerCase();
  if (!audience || ['all', 'any', 'global', 'international'].includes(audience)) return true;
  return audience === requestedAudience.trim().toLowerCase();
}

function applicableFacts(record: CatalogueProgrammeMatchingRecord, fieldName: string, context: MatchingContext): CatalogueFieldValue[] {
  if (!NORMALIZED_MATCHING_FIELDS.has(fieldName)) return [];
  const requestedAudience = context.audience ?? 'international';
  return (record.normalizedFacts ?? [])
    .filter((fact) => fact.fieldName === fieldName && fact.scope?.trim().toLowerCase() === 'programme')
    .filter((fact) => audienceMatches(fact.audience, requestedAudience))
    .filter((fact) => cycleMatches(fact.academicCycle, context.academicCycle))
    .sort((left, right) => {
      const verification = (VERIFICATION_RANK[right.verificationStatus] ?? 0) - (VERIFICATION_RANK[left.verificationStatus] ?? 0);
      if (verification !== 0) return verification;
      const audience = Number((right.audience ?? '').trim().toLowerCase() === requestedAudience.toLowerCase()) - Number((left.audience ?? '').trim().toLowerCase() === requestedAudience.toLowerCase());
      if (audience !== 0) return audience;
      const cycle = Number(Boolean(right.academicCycle)) - Number(Boolean(left.academicCycle));
      if (cycle !== 0) return cycle;
      const retrieved = Date.parse(right.retrievedAt) - Date.parse(left.retrievedAt);
      if (Number.isFinite(retrieved) && retrieved !== 0) return retrieved;
      return (right.confidence ?? 0) - (left.confidence ?? 0) || right.id.localeCompare(left.id);
    });
}

function normalizedFact(record: CatalogueProgrammeMatchingRecord, fieldName: string, context: MatchingContext): CatalogueFieldValue | null {
  return applicableFacts(record, fieldName, context)[0] ?? null;
}

function normalizedFactEvidence(fact: CatalogueFieldValue): MatchEvidence {
  const note = [
    fact.useForEligibility ? 'Eligible for hard eligibility when the structured verification contract is satisfied.' : 'Not marked for hard eligibility.',
    fact.audience ? `Audience: ${fact.audience}.` : undefined,
    fact.academicCycle ? `Academic cycle: ${fact.academicCycle}.` : undefined,
    fact.nullReason ? `Null reason: ${fact.nullReason}.` : undefined,
  ].filter(Boolean).join(' ');
  const reliability = fact.displayMode === 'structured' && TRUSTED_STATUSES.has(fact.verificationStatus) && fact.nullReason === null && (fact.validationErrors ?? []).length === 0
    ? RELIABILITY(fact.verificationStatus)
    : 'crawler_extracted';
  return evidence('course_current_field_values', 'programme', fact.fieldName, fact.valueJson, reliability, fact.sourceUrl, note);
}

function usableNormalizedFact(fact: CatalogueFieldValue | null): fact is CatalogueFieldValue {
  return Boolean(fact && TRUSTED_STATUSES.has(fact.verificationStatus) && fact.displayMode === 'structured' && fact.valueJson !== null && fact.nullReason === null && (fact.validationErrors ?? []).length === 0);
}

function hardRequirement(fact: CatalogueFieldValue): boolean {
  return fact.useForEligibility === true;
}

export function annualUsdBudget(
  value: string | null,
  field = 'budget_range',
  periodIsImplicit = false,
): StudentMatchingProfile['budget'] {
  if (!value || (!periodIsImplicit && !/year/i.test(value)) || !/\$|usd/i.test(value)) return null;
  // An open-ended band has no safe upper bound for a tuition comparison.
  if (/over|more than|above|\+/i.test(value)) return null;
  const amounts = [...value.matchAll(/(?:\$|usd\s*)?(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?/gi)]
    .map((match) => {
      const amount = Number(match[1]?.replace(/,/g, ''));
      const multiplier = match[2]?.toLowerCase() === 'k' ? 1000 : match[2]?.toLowerCase() === 'thousand' ? 1000 : 1;
      return amount * multiplier;
    })
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  const amount = amounts.length > 0 ? Math.max(...amounts) : null;
  if (amount === null) return null;
  return {
    amount,
    currency: 'USD',
    period: 'annual',
    evidence: evidence('student_profiles', 'student', field, value, 'structured', null, amounts.length > 1 ? 'Upper bound of the stated annual budget band.' : undefined),
  };
}

function parseLegacyGpaRequirement(value: string | null | undefined, university: UniversityListItem): MatchingProgrammeCandidate['gpaRequirement'] {
  if (!value) return null;
  const match = /(?:gpa\s*)?(\d(?:\.\d+)?)\s*(?:\+|or higher|minimum|minimum of|at least)?\s*\/\s*(\d+(?:\.\d+)?)/i.exec(value);
  if (!match?.[1] || !match[2]) return null;
  const minimum = Number(match[1]);
  const scale = Number(match[2]);
  if (!Number.isFinite(minimum) || !Number.isFinite(scale) || minimum < 0 || scale <= minimum) return null;
  return {
    minimum,
    scale: canonicalGpaScale(String(scale)),
    // University free text is a fallback and deliberately cannot make a hard failure.
    mandatory: false,
    evidence: evidence('universities', 'university', 'gpa_range', value, 'crawler_extracted', null, `University-level fallback for ${university.name}.`),
  };
}

function parseNormalizedGpaRequirement(
  record: CatalogueProgrammeMatchingRecord,
  context: MatchingContext,
): { requirement: MatchingProgrammeCandidate['gpaRequirement']; factPresent: boolean } {
  const minimumFact = normalizedFact(record, 'minimum_gpa', context);
  const scaleFact = normalizedFact(record, 'gpa_scale', context);
  if (!minimumFact) return { requirement: null, factPresent: Boolean(scaleFact) };
  if (!usableNormalizedFact(minimumFact)) return { requirement: null, factPresent: true };
  if (scaleFact && !usableNormalizedFact(scaleFact)) return { requirement: null, factPresent: true };
  const minimum = firstNumber(minimumFact.valueJson, ['minimum', 'minimum_gpa', 'gpa', 'value', 'score']);
  const scaleValue = (recordValue(minimumFact.valueJson) ? firstScalarString(minimumFact.valueJson, ['scale', 'gpa_scale', 'denominator']) : null)
    ?? (scaleFact ? firstScalarString(scaleFact.valueJson, ['scale', 'gpa_scale', 'denominator', 'value', 'maximum']) : null);
  const scaleNumber = scaleValue ? finiteNumber(scaleValue) : null;
  if (minimum === null || minimum < 0 || !scaleValue || scaleNumber === null || scaleNumber <= minimum) return { requirement: null, factPresent: true };
  const object = recordValue(minimumFact.valueJson);
  const typicalLow = object ? firstNumber(object.typical_low ?? object.typicalLow, ['value']) : null;
  const typicalHigh = object ? firstNumber(object.typical_high ?? object.typicalHigh, ['value']) : null;
  return {
    factPresent: true,
    requirement: {
      minimum,
      scale: canonicalGpaScale(scaleValue),
      ...(typicalLow !== null ? { typicalLow } : {}),
      ...(typicalHigh !== null ? { typicalHigh } : {}),
      mandatory: hardRequirement(minimumFact) && (!scaleFact || hardRequirement(scaleFact)),
      evidence: normalizedFactEvidence(minimumFact),
    },
  };
}

function parseScoreValue(value: unknown): number | null {
  return firstNumber(value, ['minimum', 'minimum_score', 'overall', 'overall_score', 'score', 'value', 'required']);
}

function parseSubscores(value: unknown): Record<string, number> {
  const object = recordValue(value);
  if (!object) {
    const number = finiteNumber(value);
    return number === null ? {} : { listening: number, reading: number, writing: number, speaking: number };
  }
  const scores: Record<string, number> = {};
  for (const [key, raw] of Object.entries(object)) {
    const score = finiteNumber(raw) ?? (recordValue(raw) ? parseScoreValue(raw) : null);
    if (score !== null && ['listening', 'reading', 'writing', 'speaking', 'minimum'].some((part) => key.toLowerCase().includes(part))) {
      if (key.toLowerCase().includes('minimum')) {
        for (const part of ['listening', 'reading', 'writing', 'speaking']) scores[part] = score;
      } else {
        scores[key.toLowerCase().replace(/[^a-z]+/g, '_')] = score;
      }
    }
  }
  return scores;
}

function testRequirement(
  testType: string,
  minimum: number,
  fact: CatalogueFieldValue,
  subscores?: Record<string, number>,
): TestRequirement {
  return {
    testType,
    minimum,
    ...(subscores && Object.keys(subscores).length > 0 ? { subscores } : {}),
    mandatory: hardRequirement(fact),
    evidence: normalizedFactEvidence(fact),
  };
}

function parseStandardizedTestRequirements(fact: CatalogueFieldValue): TestRequirement[] {
  const parsed = jsonValue(fact.valueJson);
  const entries: Array<{ type: string; value: unknown }> = [];
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const object = recordValue(item);
      const type = object ? firstString(object, ['test_type', 'testType', 'name', 'type']) : null;
      if (type) entries.push({ type, value: object });
    }
  } else {
    const object = recordValue(parsed);
    const tests = object?.tests;
    if (Array.isArray(tests)) {
      for (const item of tests) {
        const test = recordValue(item);
        const type = test ? firstString(test, ['test_type', 'testType', 'name', 'type']) : null;
        if (type) entries.push({ type, value: test });
      }
    } else if (object) {
      for (const [type, value] of Object.entries(object)) {
        if (!['audience', 'academic_cycle', 'required', 'notes'].includes(type.toLowerCase())) entries.push({ type, value });
      }
    }
  }
  return entries.flatMap(({ type, value }) => {
    const minimum = parseScoreValue(value);
    return minimum === null ? [] : [testRequirement(canonicalTestType(type), minimum, fact)];
  });
}

function parseNormalizedEnglishTests(record: CatalogueProgrammeMatchingRecord, context: MatchingContext): { requirements: TestRequirement[]; factPresent: boolean } {
  const requirements: TestRequirement[] = [];
  const ieltsOverall = normalizedFact(record, 'ielts_overall', context);
  const ieltsSubscores = normalizedFact(record, 'ielts_subscores', context);
  const toefl = normalizedFact(record, 'toefl', context);
  const duolingo = normalizedFact(record, 'duolingo', context);
  const standardized = normalizedFact(record, 'standardized_tests', context);
  if (ieltsOverall && usableNormalizedFact(ieltsOverall)) {
    const minimum = parseScoreValue(ieltsOverall.valueJson);
    if (minimum !== null) requirements.push(testRequirement('ielts', minimum, ieltsOverall));
  }
  if (ieltsSubscores && usableNormalizedFact(ieltsSubscores)) {
    const subscores = parseSubscores(ieltsSubscores.valueJson);
    if (Object.keys(subscores).length > 0) {
      const existing = requirements.find((item) => item.testType === 'ielts');
      if (existing) existing.subscores = subscores;
      else requirements.push(testRequirement('ielts', 0, ieltsSubscores, subscores));
    }
  }
  for (const [type, fact] of [['toefl', toefl], ['duolingo', duolingo]] as const) {
    if (!fact || !usableNormalizedFact(fact)) continue;
    const minimum = parseScoreValue(fact.valueJson);
    if (minimum !== null) requirements.push(testRequirement(type, minimum, fact));
  }
  if (standardized && usableNormalizedFact(standardized)) requirements.push(...parseStandardizedTestRequirements(standardized));
  return {
    requirements,
    factPresent: Boolean(ieltsOverall || ieltsSubscores || toefl || duolingo || standardized),
  };
}

function parseLegacyEnglishTests(record: CatalogueProgrammeMatchingRecord): MatchingProgrammeCandidate['testRequirements'] {
  const text = record.course?.englishRequirementsSummary;
  if (!text) return [];
  const patterns: Array<{ pattern: RegExp; testType: string }> = [
    { pattern: /IELTS\s*(?:Academic\s*)?(\d(?:\.\d+)?)/i, testType: 'ielts' },
    { pattern: /TOEFL(?:\s+iBT)?\s*(\d{2,3})/i, testType: 'toefl' },
    { pattern: /PTE(?:\s+Academic)?\s*(\d{2})/i, testType: 'pte' },
    { pattern: /Duolingo(?:\s+English\s+Test)?\s*(\d{2,3})/i, testType: 'duolingo' },
    { pattern: /Cambridge(?:\s+English)?\s*(\d{2,3})/i, testType: 'cambridge' },
  ];
  const parsed = patterns.flatMap(({ pattern, testType }) => {
    const match = pattern.exec(text);
    const minimum = match?.[1] ? Number(match[1]) : NaN;
    if (!Number.isFinite(minimum)) return [];
    return [{
      testType, minimum,
      mandatory: false,
      evidence: evidence('courses', 'programme', 'english_requirements_summary', text, 'proxy', record.officialUrl, 'Legacy course free-text fallback; not a normalized catalogue fact.'),
    }];
  });
  return parsed;
}

function difficultyScore(value: unknown): number | null {
  const object = recordValue(value);
  const numeric = object ? firstNumber(object, ['score', 'selectivity_score', 'acceptance_rate']) : finiteNumber(value);
  if (numeric !== null && numeric >= 0 && numeric <= 100) return numeric;
  const text = (object ? firstString(object, ['difficulty', 'level', 'value']) : typeof value === 'string' ? value : null)?.toLowerCase() ?? '';
  return /extremely|highly|fiercely/.test(text) ? 20 : /very competitive|hard to get/.test(text) ? 35 : /competitive|selective/.test(text) ? 50 : /moderate|average/.test(text) ? 65 : /accessible|less competitive|high acceptance/.test(text) ? 75 : null;
}

function selectivity(record: CatalogueProgrammeMatchingRecord, university: UniversityListItem, context: MatchingContext): MatchingProgrammeCandidate['selectivity'] {
  const normalized = normalizedFact(record, 'admission_difficulty', context);
  if (normalized) {
    const score = usableNormalizedFact(normalized) ? difficultyScore(normalized.valueJson) : null;
    return score === null ? null : {
      score,
      evidence: normalizedFactEvidence(normalized),
      reason: 'Programme-level normalized admission-difficulty evidence is available.',
    };
  }
  const rate = university.accept_rate?.match(/(\d+(?:\.\d+)?)\s*%/);
  if (rate?.[1]) {
    const acceptance = Number(rate[1]);
    if (Number.isFinite(acceptance)) return {
      score: Math.min(100, Math.max(0, acceptance)),
      evidence: evidence('universities', 'university', 'accept_rate', university.accept_rate, 'proxy', null, 'University-level proxy; not a programme acceptance rate.'),
      reason: 'University-level acceptance-rate proxy is available.',
    };
  }
  const difficulty = university.admission_difficulty?.toLowerCase() ?? '';
  const score = /extremely|highly|fiercely/.test(difficulty) ? 20 : /very competitive|hard to get/.test(difficulty) ? 35 : /competitive|selective/.test(difficulty) ? 50 : /moderate|average/.test(difficulty) ? 65 : /accessible|less competitive|high acceptance/.test(difficulty) ? 75 : null;
  return score === null ? null : {
    score,
    evidence: evidence('universities', 'university', 'admission_difficulty', university.admission_difficulty, 'proxy', null, 'University-level selectivity proxy; not programme-specific.'),
    reason: 'University-level admission-difficulty proxy is available.',
  };
}

function parseMinimumDegree(fact: CatalogueFieldValue | null): DegreeRequirement | null {
  if (!usableNormalizedFact(fact)) return null;
  const minimumDegree = firstString(fact.valueJson, ['minimum_degree', 'degree', 'level', 'minimum', 'value']);
  return minimumDegree ? { minimumDegree, mandatory: hardRequirement(fact), evidence: normalizedFactEvidence(fact) } : null;
}

function parseSubjectPrerequisites(fact: CatalogueFieldValue | null): SubjectPrerequisiteRequirement | null {
  if (!usableNormalizedFact(fact)) return null;
  const parsed = jsonValue(fact.valueJson);
  const object = recordValue(parsed);
  const raw = Array.isArray(parsed) ? parsed : object?.required_subjects ?? object?.subjects ?? object?.prerequisites ?? object?.required ?? object?.items;
  const subjects = (Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]).flatMap((item) => {
    if (typeof item === 'string') return item.trim() ? [item.trim()] : [];
    const itemObject = recordValue(item);
    const name = itemObject ? firstString(itemObject, ['subject', 'name', 'label', 'value']) : null;
    return name ? [name] : [];
  });
  return { requiredSubjects: subjects, mandatory: hardRequirement(fact), evidence: normalizedFactEvidence(fact) };
}

function parseNormalizedTuition(fact: CatalogueFieldValue | null): MatchingProgrammeCandidate['tuition'] {
  if (!usableNormalizedFact(fact)) return null;
  const object = recordValue(fact.valueJson);
  const amount = firstNumber(fact.valueJson, ['amount', 'minimum', 'value']);
  const currency = object ? firstString(object, ['currency']) : null;
  const periodValue = object ? firstString(object, ['fee_period', 'period', 'frequency'])?.toLowerCase() : null;
  if (amount === null || amount <= 0 || !currency) return null;
  const period = periodValue && /year|annual/.test(periodValue) ? 'annual' : periodValue && /total|programme/.test(periodValue) ? 'total' : 'unknown';
  return { amount, currency: currency.toUpperCase(), period, evidence: normalizedFactEvidence(fact) };
}

function parseLegacyTuition(record: CatalogueProgrammeMatchingRecord): MatchingProgrammeCandidate['tuition'] {
  const course = record.course;
  return course?.tuitionFeeMin != null && course.tuitionFeeMin > 0 && course.tuitionCurrency && /per\s+year|\/year|annual/i.test(course.tuitionFeeText ?? '')
    ? {
      amount: course.tuitionFeeMin, currency: course.tuitionCurrency, period: 'annual' as const,
      evidence: evidence('courses', 'programme', 'tuition_fee_min', course.tuitionFeeMin, 'proxy', record.officialUrl, 'Legacy course field fallback; used only because no applicable normalized tuition fact exists.'),
    }
    : null;
}

export function candidateFrom(record: CatalogueProgrammeMatchingRecord, university: UniversityListItem, context: MatchingContext = {}): MatchingProgrammeCandidate {
  const gpa = parseNormalizedGpaRequirement(record, context);
  const normalizedEnglish = parseNormalizedEnglishTests(record, context);
  const prerequisiteFact = normalizedFact(record, 'subject_prerequisites', context);
  const minimumDegreeFact = normalizedFact(record, 'minimum_degree', context);
  const normalizedTuitionFact = normalizedFact(record, 'tuition', context);
  const normalizedTuition = normalizedTuitionFact ? parseNormalizedTuition(normalizedTuitionFact) : null;
  const tests = normalizedEnglish.factPresent ? normalizedEnglish.requirements : parseLegacyEnglishTests(record);
  return {
    programmeId: record.id, universityId: record.universityId, programmeName: record.name,
    degreeLevel: record.degreeLevel, normalizedField: record.normalizedField,
    country: university.country, city: null,
    characteristics: [university.teaching_style, university.international_environment, university.best_for].filter((value): value is string => Boolean(value?.trim())),
    gpaRequirement: gpa.factPresent ? gpa.requirement : parseLegacyGpaRequirement(university.gpa_range, university),
    ...(minimumDegreeFact ? { minimumDegree: parseMinimumDegree(minimumDegreeFact) } : {}),
    testRequirements: tests,
    prerequisiteEvidence: prerequisiteFact ? [normalizedFactEvidence(prerequisiteFact)] : [],
    subjectPrerequisites: prerequisiteFact ? parseSubjectPrerequisites(prerequisiteFact) : null,
    selectivity: selectivity(record, university, context),
    tuition: normalizedTuitionFact ? normalizedTuition : parseLegacyTuition(record),
  };
}

function numericStandardizedTests(rows: Array<{ test_type: string | null; score: string | number | null }>): StudentMatchingProfile['standardizedTests'] {
  return rows.flatMap((row) => {
    const score = Number(row.score);
    if (!row.test_type || !Number.isFinite(score)) return [];
    return [{ testType: canonicalTestType(row.test_type), score, evidence: evidence('standardized_test_scores', 'student', 'score', row.score, 'structured') }];
  });
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
  const parsed = jsonValue(value);
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()) : [];
}

export async function loadRankedProgrammeMatches(
  supabase: SupabaseClient,
  userId: string,
): Promise<RankedProgrammeMatch[]> {
  const [profileResult, englishResult, standardizedResult, programmes] = await Promise.all([
    supabase.from('student_profiles').select('study_level,target_subjects,preferred_countries,preferred_cities,budget_range,tuition_budget_usd,gpa_scale,gpa_value,current_subjects,current_qualification,target_intake,application_cycle_year').eq('user_id', userId).maybeSingle(),
    supabase.from('english_test_scores').select('test_type,overall_score,listening_score,reading_score,writing_score,speaking_score').eq('user_id', userId),
    supabase.from('standardized_test_scores').select('test_type,score').eq('user_id', userId),
    getProgrammeQueries().allForMatching(),
  ]);
  if (profileResult.error || englishResult.error || standardizedResult.error) {
    console.error('loadRankedProgrammeMatches profile read failed:', profileResult.error?.message ?? englishResult.error?.message ?? standardizedResult.error?.message);
    return [];
  }
  const universityIds = [...new Set(programmes.map((programme) => programme.universityId))];
  const universities = await getUniversityQueries().getByIds(universityIds);
  const byUniversityId = new Map(universities.map((university) => [university.id, university]));
  const profile = profileResult.data;
  const academicCycle = profile?.application_cycle_year != null ? String(profile.application_cycle_year) : typeof profile?.target_intake === 'string' ? profile.target_intake : null;
  const matchingProfile: StudentMatchingProfile = {
    studyLevel: profile?.study_level ?? null,
    targetSubjects: Array.isArray(profile?.target_subjects) ? profile.target_subjects.filter((value): value is string => typeof value === 'string') : [],
    preferredCountries: Array.isArray(profile?.preferred_countries) ? profile.preferred_countries.filter((value): value is string => typeof value === 'string') : [],
    preferredCities: Array.isArray(profile?.preferred_cities) ? profile.preferred_cities.filter((value): value is string => typeof value === 'string') : [],
    budget: annualUsdBudget(profile?.tuition_budget_usd ?? null, 'tuition_budget_usd', true) ?? annualUsdBudget(profile?.budget_range ?? null),
    gpa: profile?.gpa_value != null && profile.gpa_scale && Number.isFinite(Number(profile.gpa_value)) ? { value: Number(profile.gpa_value), scale: canonicalGpaScale(profile.gpa_scale), evidence: evidence('student_profiles', 'student', 'gpa_value', profile.gpa_value, 'structured') } : null,
    englishTests: (englishResult.data ?? []).flatMap((row) => {
      const score = Number(row.overall_score);
      if (!row.test_type || !Number.isFinite(score)) return [];
      const subscores = Object.fromEntries(
        ([['listening', row.listening_score], ['reading', row.reading_score], ['writing', row.writing_score], ['speaking', row.speaking_score]] as const)
          .flatMap(([key, value]) => Number.isFinite(Number(value)) ? [[key, Number(value)] as const] : []),
      );
      return [{ testType: canonicalTestType(row.test_type), score, ...(Object.keys(subscores).length > 0 ? { subscores } : {}), evidence: evidence('english_test_scores', 'student', 'overall_score', row.overall_score, 'structured') }];
    }),
    standardizedTests: numericStandardizedTests(standardizedResult.data ?? []),
    academicSubjects: stringArray(profile?.current_subjects),
    priorDegreeLevel: profile?.current_qualification ?? null,
  };
  const candidates = programmes.flatMap((programme) => {
    const university = byUniversityId.get(programme.universityId);
    return university ? [candidateFrom(programme, university, { audience: 'international', academicCycle })] : [];
  });
  return rankProgrammeMatches(matchingProfile, candidates);
}
