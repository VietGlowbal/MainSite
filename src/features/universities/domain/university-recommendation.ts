import type { StudentProfile, University } from '@/lib/types';
import { RECOMMENDATION_CONFIG, type RecommendationConfig } from './university-recommendation-config';

export type { RecommendationConfig } from './university-recommendation-config';

export type RecommendationDimension = keyof typeof RECOMMENDATION_CONFIG.weights;

export type EvidenceState = 'present' | 'missing' | 'conflict' | 'stale';

export type MatchReasonCode =
  | 'PROGRAMME_FOUND'
  | 'SUBJECT_MATCH'
  | 'DESTINATION_MATCH'
  | 'STUDY_LEVEL_MATCH'
  | 'BUDGET_COMPATIBLE'
  | 'CAMPUS_MATCH'
  | 'SUBJECT_SIGNAL_FOUND';

export type MatchWarningCode =
  | 'PROGRAMME_NOT_VERIFIED'
  | 'PROGRAMME_DATA_MISSING'
  | 'NO_MATCHING_PROGRAMME_FOUND'
  | 'TUITION_DATA_MISSING'
  | 'COST_NEEDS_VERIFICATION'
  | 'SCHOLARSHIP_DEPENDENT_BUDGET'
  | 'STUDY_LEVEL_NOT_CONFIRMED'
  | 'MATCHING_STUDY_LEVEL_NOT_FOUND'
  | 'CONFLICTING_DATA'
  | 'STALE_SOURCE'
  | 'SOURCE_FRESHNESS_UNKNOWN';

export interface DimensionEvaluation {
  score: number | null;
  state: EvidenceState;
  reasonCodes: MatchReasonCode[];
  warningCodes: MatchWarningCode[];
}

export interface RecommendationReason {
  code: MatchReasonCode;
  value?: string;
}

export interface MatchWarning {
  code: MatchWarningCode;
  value?: string;
}

export type DataQuality = 'high' | 'medium' | 'low';

export type RecommendationBand = 'top_pick' | 'good_fit' | 'worth_exploring';

export type SelectivityContext = 'highly_selective' | 'selective' | 'lower_selectivity' | 'not_assessed';

export type CanonicalStudyLevel =
  | 'secondary'
  | 'foundation'
  | 'undergraduate'
  | 'postgraduate'
  | 'phd'
  | 'other';

export interface NormalizedBudget {
  currency: string | null;
  minAnnual: number | null;
  maxAnnual: number | null;
  flexible: boolean;
}

export interface RecommendationProfile {
  studyLevel: CanonicalStudyLevel | null;
  subjects: string[];
  countries: string[];
  budget: NormalizedBudget | null;
  fundingPreference: {
    scholarshipDependent: boolean;
  } | null;
  campusPreference: string | null;
  activeDimensions: RecommendationDimension[];
}

/** The public reference fields used by the pure recommendation domain. */
export type RecommendationUniversity = Omit<Pick<University,
  | 'id'
  | 'name'
  | 'country'
  | 'strengths'
  | 'best_for'
  | 'international_environment'
  | 'housing'
  | 'teaching_style'
  | 'tuition_usd'
  | 'accept_rate'
>, 'country'> & {
  country: string | null;
};

export interface RecommendationProgramme {
  id: string;
  universityId: number;
  name: string;
  degreeLevel: string | null;
  normalizedSubject: string | null;
  officialUrl: string | null;
  verificationStatus: string | null;
  retrievedAt: string | null;
}

export interface ProgrammeMatch {
  programmeId: string;
  programmeName: string;
  degreeLevel: string | null;
  normalizedSubject: string | null;
  officialUrl: string | null;
  verificationStatus: string | null;
  retrievedAt: string | null;
  subjectScore: number;
}

export interface RecommendationResult {
  universityId: number;
  universityName: string;
  country: string | null;
  recommendationRank: number;
  recommendationBand: RecommendationBand;
  selectivityContext: SelectivityContext;
  programmeMatches: ProgrammeMatch[];
  positiveEvidence: number;
  negativeEvidence: number;
  evidenceCoverage: number;
  rankingScoreInternal: number | null;
  dataQuality: DataQuality;
  reasons: RecommendationReason[];
  warnings: MatchWarning[];
  algorithmVersion: string;
}

export interface RecommendationBandInput {
  result: Pick<RecommendationResult,
    | 'positiveEvidence'
    | 'negativeEvidence'
    | 'rankingScoreInternal'
  >;
  activeDimensionCount: number;
}

type CandidateRecommendationResult = Omit<RecommendationResult,
  | 'recommendationRank'
  | 'recommendationBand'
> & {
  recommendationBand: RecommendationBand | null;
};

export type RecommendationStatus = 'success' | 'incomplete_profile' | 'empty' | 'error';

export interface RecommendationResponse {
  status: RecommendationStatus;
  results: RecommendationResult[];
  algorithmVersion: string;
  generatedAt: string;
}

export interface RecommendationOptions {
  config?: RecommendationConfig;
  asOf?: string;
}

type ProfileInput = Pick<StudentProfile,
  | 'study_level'
  | 'target_subjects'
  | 'preferred_countries'
  | 'budget_range'
  | 'campus_preferences'
>;

const TRUSTED_PROGRAMME_STATUSES = new Set(['RULE_VALIDATED', 'HUMAN_VERIFIED']);
const REVIEW_PROGRAMME_STATUSES = new Set(['NEEDS_REVIEW', 'PENDING_REVIEW']);

export type ProgrammeVerificationConfidence = 'trusted' | 'review' | 'unknown';

export function programmeVerificationConfidence(status: string | null): ProgrammeVerificationConfidence {
  if (status && TRUSTED_PROGRAMME_STATUSES.has(status)) return 'trusted';
  if (status && REVIEW_PROGRAMME_STATUSES.has(status)) return 'review';
  return 'unknown';
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const result = value.trim();
  return result.length > 0 ? result : null;
}

function cleanArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(clean)
    .filter((item): item is string => item !== null);
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(value: string): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function currencyFromText(value: string): string | null {
  const normalized = normalizeText(value);
  if (/\busd\b|\$/.test(normalized)) return 'USD';
  if (/\bgbp\b|£/.test(value.toLowerCase())) return 'GBP';
  if (/\beur\b|€/.test(value.toLowerCase())) return 'EUR';
  if (/\bcad\b/.test(normalized)) return 'CAD';
  if (/\baud\b/.test(normalized)) return 'AUD';
  if (/\bvnd\b|₫|đ/.test(value.toLowerCase())) return 'VND';
  return null;
}

function parseAmount(value: string): number | null {
  const compact = value.replace(/,/g, '').trim().toLowerCase();
  const match = /(?:\d+(?:\.\d+)?)(?:\s*(k|m))?/.exec(compact);
  if (!match?.[0]) return null;
  const amount = Number.parseFloat(match[0].replace(/\s*(k|m)$/, ''));
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (match[1] === 'k') return amount * 1_000;
  if (match[1] === 'm') return amount * 1_000_000;
  return amount;
}

function parseAmountList(value: string): number[] {
  return [...value.matchAll(/\d[\d,]*(?:\.\d+)?\s*[km]?/gi)]
    .map((match) => parseAmount(match[0]))
    .filter((amount): amount is number => amount !== null);
}

export function normalizeBudget(value: string | null | undefined): NormalizedBudget | null {
  const raw = clean(value);
  if (!raw) return null;
  const flexible = /flexible|scholarship/i.test(raw);
  const amounts = parseAmountList(raw);
  if (amounts.length === 0) return flexible ? { currency: null, minAnnual: null, maxAnnual: null, flexible: true } : null;

  const currency = currencyFromText(raw) ?? (raw.includes('$') ? 'USD' : null);
  const minimum = Math.min(...amounts);
  const maximum = Math.max(...amounts);
  if (/under|below|less than|up to|maximum|upto/i.test(raw)) {
    return { currency, minAnnual: null, maxAnnual: maximum, flexible };
  }
  if (/over|above|more than|at least/i.test(raw)
    || /\d\s*(?:k|m)?\s*\+/i.test(raw)
    || /^[a-z]{3}:\s*\d[\d,]*(?:\.\d+)?\s*-\s*$/i.test(raw)) {
    return { currency, minAnnual: minimum, maxAnnual: null, flexible };
  }
  return {
    currency,
    minAnnual: amounts.length > 1 ? minimum : minimum,
    maxAnnual: amounts.length > 1 ? maximum : maximum,
    flexible,
  };
}

export function normalizeStudyLevel(value: string | null | undefined): CanonicalStudyLevel | null {
  const normalized = normalizeText(value ?? '');
  if (!normalized) return null;
  if (normalized.includes('secondary') || normalized.includes('high school')) return 'secondary';
  if (normalized.includes('foundation')) return 'foundation';
  if (normalized.includes('phd') || normalized.includes('doctorate') || normalized.includes('doctoral')) return 'phd';
  if (normalized.includes('master') || normalized.includes('postgraduate') || normalized === 'mba') return 'postgraduate';
  if (normalized.includes('bachelor') || normalized.includes('undergraduate')) return 'undergraduate';
  if (normalized === 'other') return 'other';
  return null;
}

export function normalizeRecommendationProfile(input: ProfileInput): RecommendationProfile {
  const subjects = cleanArray(input.target_subjects);
  const countries = cleanArray(input.preferred_countries);
  const studyLevel = normalizeStudyLevel(input.study_level);
  const normalizedBudget = normalizeBudget(input.budget_range);
  const fundingPreference = normalizedBudget?.flexible
    ? { scholarshipDependent: true }
    : null;
  const budget = normalizedBudget?.flexible
    && normalizedBudget.minAnnual === null
    && normalizedBudget.maxAnnual === null
    ? null
    : normalizedBudget;
  const campusPreference = clean(input.campus_preferences);
  const activeDimensions: RecommendationDimension[] = [];

  if (subjects.length > 0) activeDimensions.push('subject');
  if (countries.length > 0) activeDimensions.push('destination');
  if (studyLevel) activeDimensions.push('studyLevel');
  if (budget && (budget.minAnnual !== null || budget.maxAnnual !== null)) activeDimensions.push('budget');
  if (campusPreference) activeDimensions.push('campus');

  return { studyLevel, subjects, countries, budget, fundingPreference, campusPreference, activeDimensions };
}

function programmeLevel(value: string | null): CanonicalStudyLevel | null {
  return normalizeStudyLevel(value);
}

type SourceFreshness = 'fresh' | 'stale' | 'unknown';

function sourceFreshness(retrievedAt: string | null, asOf: string, config: RecommendationConfig): SourceFreshness {
  if (!retrievedAt) return 'unknown';
  const retrieved = Date.parse(retrievedAt);
  const current = Date.parse(asOf);
  if (!Number.isFinite(retrieved) || !Number.isFinite(current)) return 'unknown';
  if (config.staleAfterDays === null) return 'fresh';
  return current - retrieved > config.staleAfterDays * 24 * 60 * 60 * 1000 ? 'stale' : 'fresh';
}

function containsNormalizedPhrase(corpus: string, phrase: string): boolean {
  const normalizedCorpus = normalizeText(corpus);
  const normalizedPhrase = normalizeText(phrase);
  return normalizedCorpus.length > 0
    && normalizedPhrase.length > 0
    && ` ${normalizedCorpus} `.includes(` ${normalizedPhrase} `);
}

function subjectScore(subjects: string[], corpus: string): { score: number; subject: string } | null {
  const normalizedCorpus = normalizeText(corpus);
  if (!normalizedCorpus) return null;
  let best: { score: number; subject: string } | null = null;

  for (const subject of subjects) {
    const normalizedSubject = normalizeText(subject);
    if (!normalizedSubject) continue;
    // Product subjects are explicit taxonomy labels. Boundary-only phrase
    // matching avoids inventing a relation such as Art -> Artificial Intelligence.
    if (containsNormalizedPhrase(corpus, subject)) {
      if (!best || best.score < 1) best = { score: 1, subject };
    }
  }
  return best;
}

function programmeQuality(status: string | null): number {
  if (status && TRUSTED_PROGRAMME_STATUSES.has(status)) return 3;
  if (status && REVIEW_PROGRAMME_STATUSES.has(status)) return 2;
  return 1;
}

function programmeEvidenceMultiplier(status: string | null, config: RecommendationConfig): number {
  if (status && TRUSTED_PROGRAMME_STATUSES.has(status)) return config.programmeEvidenceMultipliers.trusted;
  if (status && REVIEW_PROGRAMME_STATUSES.has(status)) return config.programmeEvidenceMultipliers.review;
  return config.programmeEvidenceMultipliers.unknown;
}

interface SubjectProgrammeEvidence {
  programme: RecommendationProgramme;
  subjectScore: number;
  matchedSubject: string;
  freshness: SourceFreshness;
}

interface SubjectProgrammeResult {
  matches: ProgrammeMatch[];
  relevantProgrammes: RecommendationProgramme[];
  evaluation: DimensionEvaluation;
}

function programmeMatchesFor(
  profile: RecommendationProfile,
  university: RecommendationUniversity,
  programmes: RecommendationProgramme[],
  asOf: string,
  config: RecommendationConfig,
): SubjectProgrammeResult {
  const usableProgrammes = programmes.filter((programme) => programme.verificationStatus !== 'REJECTED');
  const matches: SubjectProgrammeEvidence[] = usableProgrammes.flatMap((programme) => {
    const subject = subjectScore(profile.subjects, [programme.normalizedSubject, programme.name].filter(Boolean).join(' '));
    if (!subject) return [];
    const freshness = sourceFreshness(programme.retrievedAt, asOf, config);
    return [{
      programme,
      subjectScore: subject.score,
      matchedSubject: programme.normalizedSubject ?? subject.subject,
      freshness,
    }];
  });

  const sorted = [...matches].sort((left, right) =>
    right.subjectScore - left.subjectScore
    || programmeQuality(right.programme.verificationStatus) - programmeQuality(left.programme.verificationStatus)
    || left.programme.name.localeCompare(right.programme.name)
    || left.programme.id.localeCompare(right.programme.id),
  );

  const top = sorted.slice(0, config.maxProgrammeMatches);
  const best = sorted[0];
  if (best) {
    const warningCodes: MatchWarningCode[] = [];
    if (!TRUSTED_PROGRAMME_STATUSES.has(best.programme.verificationStatus ?? '')) warningCodes.push('PROGRAMME_NOT_VERIFIED');
    if (best.freshness === 'stale') warningCodes.push('STALE_SOURCE');
    if (best.freshness === 'unknown') warningCodes.push('SOURCE_FRESHNESS_UNKNOWN');
    const state: EvidenceState = best.freshness === 'stale' ? 'stale' : 'present';
    const bestSubjectScore = best.subjectScore * programmeEvidenceMultiplier(best.programme.verificationStatus, config);
    return {
      matches: top.map(({ programme, subjectScore: score, matchedSubject }) => ({
        programmeId: programme.id,
        programmeName: programme.name,
        degreeLevel: programmeLevel(programme.degreeLevel),
        normalizedSubject: matchedSubject,
        officialUrl: programme.officialUrl,
        verificationStatus: programme.verificationStatus,
        retrievedAt: programme.retrievedAt,
        subjectScore: score,
      })),
      relevantProgrammes: sorted.map(({ programme }) => programme),
      evaluation: {
        score: state === 'present' ? bestSubjectScore : null,
        state,
        reasonCodes: ['PROGRAMME_FOUND', 'SUBJECT_MATCH'],
        warningCodes,
      },
    };
  }

  const textSubject = subjectScore(
    profile.subjects,
    [university.strengths, university.best_for].filter(Boolean).join(' '),
  );
  if (textSubject) {
    return {
      matches: [],
      relevantProgrammes: [],
      evaluation: {
        score: textSubject.score * 0.5,
        state: 'present',
        reasonCodes: ['SUBJECT_SIGNAL_FOUND'],
        warningCodes: [
          'PROGRAMME_NOT_VERIFIED',
          ...(usableProgrammes.length > 0 ? ['NO_MATCHING_PROGRAMME_FOUND'] as const : []),
        ],
      },
    };
  }

  if (usableProgrammes.length > 0) {
    return {
      matches: [],
      relevantProgrammes: [],
      evaluation: {
        score: null,
        state: 'missing',
        reasonCodes: [],
        warningCodes: ['NO_MATCHING_PROGRAMME_FOUND'],
      },
    };
  }

  return {
    matches: [],
    relevantProgrammes: [],
    evaluation: {
      score: null,
      state: 'missing',
      reasonCodes: [],
      warningCodes: ['PROGRAMME_DATA_MISSING'],
    },
  };
}

function evaluateDestination(profile: RecommendationProfile, university: RecommendationUniversity): DimensionEvaluation {
  const country = clean(university.country);
  if (!country) return { score: null, state: 'missing', reasonCodes: [], warningCodes: [] };
  const match = profile.countries.some((preferred) => normalizeText(preferred) === normalizeText(country));
  return {
    score: match ? 1 : 0,
    state: 'present',
    reasonCodes: match ? ['DESTINATION_MATCH'] : [],
    warningCodes: [],
  };
}

function evaluateStudyLevel(
  profile: RecommendationProfile,
  university: RecommendationUniversity,
  programmes: RecommendationProgramme[],
  subjectRelevantProgrammes: RecommendationProgramme[],
): DimensionEvaluation {
  if (!profile.studyLevel) return { score: null, state: 'missing', reasonCodes: [], warningCodes: [] };
  const levelProgrammes = profile.subjects.length > 0
    ? subjectRelevantProgrammes
    : programmes.filter((programme) => programme.verificationStatus !== 'REJECTED');
  const knownLevels = levelProgrammes
    .map((programme) => programmeLevel(programme.degreeLevel))
    .filter(Boolean);
  if (knownLevels.length > 0) {
    const match = knownLevels.includes(profile.studyLevel);
    if (!match) {
      // A catalogue row at another level proves only that row's level. Without
      // inventory-completeness metadata it cannot prove the requested
      // subject-and-level combination does not exist at this university.
      return {
        score: null,
        state: 'missing',
        reasonCodes: [],
        warningCodes: ['MATCHING_STUDY_LEVEL_NOT_FOUND'],
      };
    }
    return {
      score: 1,
      state: 'present',
      reasonCodes: ['STUDY_LEVEL_MATCH'],
      warningCodes: [],
    };
  }

  // With an active subject preference, university-level marketing copy cannot
  // establish that this specific subject is offered at the requested level.
  if (profile.subjects.length > 0) {
    return { score: null, state: 'missing', reasonCodes: [], warningCodes: ['STUDY_LEVEL_NOT_CONFIRMED'] };
  }

  const text = [university.best_for, university.strengths, university.teaching_style].filter(Boolean).join(' ');
  const textLevel = normalizeStudyLevel(text);
  if (textLevel) {
    if (textLevel !== profile.studyLevel) {
      return {
        score: null,
        state: 'missing',
        reasonCodes: [],
        warningCodes: ['MATCHING_STUDY_LEVEL_NOT_FOUND'],
      };
    }
    return {
      score: 0.5,
      state: 'present',
      reasonCodes: ['STUDY_LEVEL_MATCH'],
      warningCodes: ['PROGRAMME_NOT_VERIFIED'],
    };
  }
  return { score: null, state: 'missing', reasonCodes: [], warningCodes: ['STUDY_LEVEL_NOT_CONFIRMED'] };
}

function parseTuition(value: string | null | undefined): { currency: string | null; min: number; max: number } | null {
  const raw = clean(value);
  if (!raw || /month|monthly/i.test(raw) || !/year|annual|annum/i.test(raw)) return null;
  const amounts = parseAmountList(raw);
  if (amounts.length === 0) return null;
  return {
    currency: currencyFromText(raw) ?? 'USD',
    min: Math.min(...amounts),
    max: Math.max(...amounts),
  };
}

function evaluateBudget(profile: RecommendationProfile, university: RecommendationUniversity): DimensionEvaluation {
  if (!profile.budget) {
    return { score: null, state: 'missing', reasonCodes: [], warningCodes: [] };
  }
  if (profile.budget.flexible && profile.budget.minAnnual === null && profile.budget.maxAnnual === null) {
    return {
      score: null,
      state: 'missing',
      reasonCodes: [],
      warningCodes: ['SCHOLARSHIP_DEPENDENT_BUDGET', 'COST_NEEDS_VERIFICATION'],
    };
  }
  // Profile ranges represent what the student can afford, not the price they
  // want to pay. A cap is therefore required before we can score affordability.
  if (!profile.budget.currency || profile.budget.maxAnnual === null) {
    return { score: null, state: 'missing', reasonCodes: [], warningCodes: ['COST_NEEDS_VERIFICATION'] };
  }
  const tuition = parseTuition(university.tuition_usd);
  if (!tuition) {
    return { score: null, state: 'missing', reasonCodes: [], warningCodes: ['TUITION_DATA_MISSING', 'COST_NEEDS_VERIFICATION'] };
  }
  if (profile.budget.currency && tuition.currency && profile.budget.currency !== tuition.currency) {
    return { score: null, state: 'conflict', reasonCodes: [], warningCodes: ['CONFLICTING_DATA', 'COST_NEEDS_VERIFICATION'] };
  }

  const profileMax = profile.budget.maxAnnual;
  const isAffordable = tuition.max <= profileMax;
  const crossesAffordabilityCap = tuition.min <= profileMax && tuition.max > profileMax;
  return {
    score: isAffordable ? 1 : crossesAffordabilityCap ? 0.5 : 0,
    state: 'present',
    reasonCodes: isAffordable || crossesAffordabilityCap ? ['BUDGET_COMPATIBLE'] : [],
    warningCodes: crossesAffordabilityCap ? ['COST_NEEDS_VERIFICATION'] : [],
  };
}

function evaluateCampus(profile: RecommendationProfile, university: RecommendationUniversity): DimensionEvaluation {
  if (!profile.campusPreference) return { score: null, state: 'missing', reasonCodes: [], warningCodes: [] };
  const text = [university.international_environment, university.housing, university.teaching_style]
    .filter(Boolean)
    .join(' ');
  if (!clean(text)) return { score: null, state: 'missing', reasonCodes: [], warningCodes: [] };
  const exact = normalizeText(text).includes(normalizeText(profile.campusPreference));
  const overlap = tokens(profile.campusPreference).some((token) => tokens(text).includes(token));
  return {
    score: exact ? 1 : overlap ? 0.5 : 0,
    state: 'present',
    reasonCodes: exact || overlap ? ['CAMPUS_MATCH'] : [],
    warningCodes: [],
  };
}

function dataQuality(coverage: number, config: RecommendationConfig): DataQuality {
  if (coverage >= config.dataQuality.high) return 'high';
  if (coverage >= config.dataQuality.medium) return 'medium';
  return 'low';
}

/**
 * Maps already-computed evidence onto a stable product label. These thresholds
 * are presentation heuristics, never admission probabilities or percentiles.
 */
export function deriveRecommendationBand(
  { result, activeDimensionCount }: RecommendationBandInput,
  config: RecommendationConfig = RECOMMENDATION_CONFIG,
): RecommendationBand | null {
  if (result.positiveEvidence <= 0) return null;

  const { topPick, goodFit, worthExploring } = config.recommendationBands;
  if (
    activeDimensionCount >= topPick.minActiveDimensions
    && result.rankingScoreInternal !== null
    && result.rankingScoreInternal >= topPick.minRankingScore
    && result.positiveEvidence >= topPick.minPositiveEvidence
    && result.negativeEvidence <= topPick.maxNegativeEvidence
  ) {
    return 'top_pick';
  }
  if (
    activeDimensionCount >= goodFit.minActiveDimensions
    && result.rankingScoreInternal !== null
    && result.rankingScoreInternal >= goodFit.minRankingScore
    && result.positiveEvidence >= goodFit.minPositiveEvidence
    && result.negativeEvidence <= goodFit.maxNegativeEvidence
  ) {
    return 'good_fit';
  }
  if (
    activeDimensionCount >= worthExploring.minActiveDimensions
    && result.positiveEvidence >= worthExploring.minPositiveEvidence
    && result.negativeEvidence <= worthExploring.maxNegativeEvidence
  ) {
    return 'worth_exploring';
  }
  return null;
}

/** A result is presentable only when the product band policy can support it. */
export function isMeaningfulRecommendation(
  input: RecommendationBandInput,
  config: RecommendationConfig = RECOMMENDATION_CONFIG,
): boolean {
  return input.result.positiveEvidence > 0 && deriveRecommendationBand(input, config) !== null;
}

/**
 * Parse only a general acceptance rate: a standalone percentage/range or a
 * leading percentage explicitly labelled "overall". Programme-specific and
 * unstructured prose stays unassessed rather than being over-interpreted.
 */
function generalAcceptanceRate(value: string | null | undefined): number | null {
  const match = value?.trim().match(
    /^~?\s*(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?\s*%\s*(?:$|overall\b)/i,
  );
  if (!match?.[1]) return null;
  const lower = Number.parseFloat(match[1]);
  const upper = match[2] ? Number.parseFloat(match[2]) : lower;
  return Number.isFinite(upper) && upper >= 0 && upper <= 100 ? upper : null;
}

/**
 * General-admissions context derived only from conservatively parsed acceptance
 * rates. Ranking/prestige and unstructured difficulty notes are intentionally
 * excluded because neither is defensible selectivity evidence here.
 */
export function deriveSelectivityContext(
  university: Pick<RecommendationUniversity, 'accept_rate'>,
  config: RecommendationConfig = RECOMMENDATION_CONFIG,
): SelectivityContext {
  const rate = generalAcceptanceRate(university.accept_rate);
  if (rate === null) return 'not_assessed';
  if (rate <= config.selectivity.highlySelectiveMaxAcceptanceRate) return 'highly_selective';
  if (rate <= config.selectivity.selectiveMaxAcceptanceRate) return 'selective';
  return 'lower_selectivity';
}

function uniqueReasons(evaluations: DimensionEvaluation[]): MatchReasonCode[] {
  return [...new Set(evaluations.flatMap((evaluation) => evaluation.reasonCodes))];
}

function uniqueWarnings(evaluations: DimensionEvaluation[]): MatchWarningCode[] {
  return [...new Set(evaluations.flatMap((evaluation) => evaluation.warningCodes))];
}

function reasonValue(code: MatchReasonCode, profile: RecommendationProfile, programmes: ProgrammeMatch[]): string | undefined {
  if (code === 'PROGRAMME_FOUND') return programmes[0]?.programmeName;
  if (code === 'SUBJECT_MATCH' || code === 'SUBJECT_SIGNAL_FOUND') return profile.subjects.join(', ');
  if (code === 'DESTINATION_MATCH') return profile.countries.join(', ');
  if (code === 'STUDY_LEVEL_MATCH') return profile.studyLevel ?? undefined;
  if (code === 'CAMPUS_MATCH') return profile.campusPreference ?? undefined;
  return undefined;
}

function warningValue(code: MatchWarningCode, programmes: ProgrammeMatch[]): string | undefined {
  if (code === 'PROGRAMME_NOT_VERIFIED') return programmes[0]?.programmeName;
  return undefined;
}

function activeWeight(profile: RecommendationProfile, config: RecommendationConfig): number {
  return profile.activeDimensions.reduce((total, dimension) => total + config.weights[dimension], 0);
}

function evaluateUniversity(
  profile: RecommendationProfile,
  university: RecommendationUniversity,
  programmes: RecommendationProgramme[],
  options: Required<RecommendationOptions>,
): CandidateRecommendationResult {
  const subject = programmeMatchesFor(profile, university, programmes, options.asOf, options.config);
  const evaluations: Record<RecommendationDimension, DimensionEvaluation> = {
    subject: subject.evaluation,
    destination: evaluateDestination(profile, university),
    studyLevel: evaluateStudyLevel(profile, university, programmes, subject.relevantProgrammes),
    budget: evaluateBudget(profile, university),
    campus: evaluateCampus(profile, university),
  };
  const denominator = activeWeight(profile, options.config);
  const scored = profile.activeDimensions.map((dimension) => ({
    evaluation: evaluations[dimension],
    weight: options.config.weights[dimension],
  }));
  const matchedPoints = scored.reduce(
    (total, { evaluation, weight }) => total + (evaluation.state === 'present' && evaluation.score !== null
      ? evaluation.score * weight
      : 0),
    0,
  );
  const negativePoints = scored.reduce(
    (total, { evaluation, weight }) => total + (evaluation.state === 'present' && evaluation.score !== null
      ? (1 - evaluation.score) * weight
      : 0),
    0,
  );
  const evidenceWeight = profile.activeDimensions.reduce(
    (total, dimension) => total + (evaluations[dimension].state === 'present' ? options.config.weights[dimension] : 0),
    0,
  );
  const coverage = denominator > 0 ? evidenceWeight / denominator : 0;
  const positiveEvidence = denominator > 0 ? matchedPoints / denominator : 0;
  const negativeEvidence = denominator > 0 ? negativePoints / denominator : 0;
  // Confidence-aware fit: positive fit is discounted by the share of active
  // preference weight that is verified negative. This lets broad compatible
  // evidence beat a sparse perfect field, while keeping unknown evidence
  // neutral rather than treating it as a mismatch.
  const rankingScoreInternal = denominator > 0
    ? positiveEvidence * (1 - negativeEvidence)
    : null;
  const reasons: RecommendationReason[] = uniqueReasons(scored.map(({ evaluation }) => evaluation)).map((code) => {
    const value = reasonValue(code, profile, subject.matches);
    return value === undefined ? { code } : { code, value };
  });
  const fundingWarnings: MatchWarningCode[] = profile.fundingPreference?.scholarshipDependent
    ? ['SCHOLARSHIP_DEPENDENT_BUDGET']
    : [];
  const warnings: MatchWarning[] = uniqueWarnings([
    ...scored.map(({ evaluation }) => evaluation),
    { score: null, state: 'missing', reasonCodes: [], warningCodes: fundingWarnings },
  ]).map((code) => {
    const value = warningValue(code, subject.matches);
    return value === undefined ? { code } : { code, value };
  });

  const candidate = {
    universityId: university.id,
    universityName: university.name,
    country: university.country ?? null,
    programmeMatches: subject.matches,
    positiveEvidence,
    negativeEvidence,
    evidenceCoverage: coverage,
    rankingScoreInternal,
    dataQuality: dataQuality(coverage, options.config),
    reasons,
    warnings,
    algorithmVersion: options.config.version,
  };
  return {
    ...candidate,
    recommendationBand: deriveRecommendationBand({
      result: candidate,
      activeDimensionCount: profile.activeDimensions.length,
    }, options.config),
    selectivityContext: deriveSelectivityContext(university, options.config),
  };
}

export function rankUniversityRecommendations(
  input: ProfileInput,
  universities: RecommendationUniversity[],
  programmesByUniversityId: ReadonlyMap<number, RecommendationProgramme[]> = new Map(),
  options: RecommendationOptions = {},
): RecommendationResponse {
  const config = options.config ?? RECOMMENDATION_CONFIG;
  const asOf = options.asOf ?? new Date().toISOString();
  const profile = normalizeRecommendationProfile(input);
  const base = {
    algorithmVersion: config.version,
    generatedAt: asOf,
  };
  if (profile.activeDimensions.length === 0) return { status: 'incomplete_profile', results: [], ...base };

  const bestProgrammeQuality = (result: Pick<CandidateRecommendationResult, 'programmeMatches'>): number => {
    return result.programmeMatches.reduce(
      (best, programme) => Math.max(best, programmeQuality(programme.verificationStatus)),
      0,
    );
  };

  const candidates = universities
    .map((university) => evaluateUniversity(profile, university, programmesByUniversityId.get(university.id) ?? [], { config, asOf }))
    .sort((left, right) => {
      return (right.rankingScoreInternal ?? -1) - (left.rankingScoreInternal ?? -1)
        || left.negativeEvidence - right.negativeEvidence
        || right.positiveEvidence - left.positiveEvidence
        || right.evidenceCoverage - left.evidenceCoverage
        || bestProgrammeQuality(right) - bestProgrammeQuality(left)
        || left.universityId - right.universityId;
    });
  const meaningfulCandidates = candidates.filter((candidate) =>
    isMeaningfulRecommendation({
      result: candidate,
      activeDimensionCount: profile.activeDimensions.length,
    }, config) && candidate.recommendationBand !== null,
  );
  const results: RecommendationResult[] = meaningfulCandidates.map((candidate, index) => ({
      ...candidate,
      recommendationRank: index + 1,
      recommendationBand: candidate.recommendationBand!,
    }));

  return {
    status: results.length > 0 ? 'success' : 'empty',
    results,
    ...base,
  };
}

export function recommendationProfileHasPreferences(input: ProfileInput): boolean {
  return normalizeRecommendationProfile(input).activeDimensions.length > 0;
}
