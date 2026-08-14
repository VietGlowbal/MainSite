import { MATCHING_MODEL_V1 } from './config';
import type { MatchFactorResult, MatchingProgrammeCandidate, PreferenceResult, StudentMatchingProfile } from './types';

function factor(key: string, configuredWeight: number, partial: Omit<MatchFactorResult, 'key' | 'configuredWeight'>): MatchFactorResult {
  return { key, configuredWeight, ...partial };
}

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

const RELATED_FIELDS: Record<string, string[]> = {
  computer_science: ['data_science', 'artificial_intelligence', 'information_science', 'electrical_computer_engineering'],
  data_science: ['computer_science', 'artificial_intelligence', 'statistics', 'mathematics'],
  artificial_intelligence: ['computer_science', 'data_science'],
  business: ['business_administration', 'finance_economics', 'economics'],
  engineering: ['mechanical_aerospace_engineering', 'electrical_engineering', 'civil_engineering', 'chemical_engineering'],
};

function countryFactor(profile: StudentMatchingProfile, candidate: MatchingProgrammeCandidate): MatchFactorResult {
  const countries = profile.preferredCountries.map(normalise).filter((value) => value !== 'open_to_ideas');
  if (countries.length === 0) return factor('country', MATCHING_MODEL_V1.preference.country, { status: 'not_applicable', score: null, evidence: [], reasons: ['You are open to destinations.'], limitations: [] });
  if (!candidate.country) return factor('country', MATCHING_MODEL_V1.preference.country, { status: 'unknown', score: null, evidence: [], reasons: [], limitations: ['Programme country is unavailable.'] });
  const match = countries.includes(normalise(candidate.country));
  return factor('country', MATCHING_MODEL_V1.preference.country, { status: 'scored', score: match ? 100 : 0, evidence: [], reasons: [match ? `${candidate.country} is one of your preferred countries.` : `${candidate.country} is outside your preferred countries.`], limitations: [] });
}

function programmeFactor(profile: StudentMatchingProfile, candidate: MatchingProgrammeCandidate): MatchFactorResult {
  if (profile.targetSubjects.length === 0) return factor('programme', MATCHING_MODEL_V1.preference.programme, { status: 'not_applicable', score: null, evidence: [], reasons: ['No target subject is set.'], limitations: [] });
  if (!candidate.normalizedField) return factor('programme', MATCHING_MODEL_V1.preference.programme, { status: 'unknown', score: null, evidence: [], reasons: [], limitations: ['This programme has no normalized field.'] });
  const field = normalise(candidate.normalizedField);
  const targets = profile.targetSubjects.map(normalise);
  const exact = targets.includes(field);
  const related = targets.some((target) => RELATED_FIELDS[target]?.includes(field) || RELATED_FIELDS[field]?.includes(target));
  return factor('programme', MATCHING_MODEL_V1.preference.programme, { status: 'scored', score: exact ? 100 : related ? 70 : 0, evidence: [], reasons: [exact ? 'The programme field exactly matches your target subject.' : related ? 'The programme field is closely related to your target subject.' : 'The normalized programme field does not match your target subjects.'], limitations: related ? ['Related-field mapping is a small controlled v1 set.'] : [] });
}

function budgetFactor(profile: StudentMatchingProfile, candidate: MatchingProgrammeCandidate): MatchFactorResult {
  if (!profile.budget) return factor('budget', MATCHING_MODEL_V1.preference.budget, { status: 'not_applicable', score: null, evidence: [], reasons: ['No comparable annual budget is set.'], limitations: [] });
  if (!candidate.tuition) return factor('budget', MATCHING_MODEL_V1.preference.budget, { status: 'unknown', score: null, evidence: [], reasons: [], limitations: ['Programme tuition is unavailable.'] });
  if (candidate.tuition.currency !== profile.budget.currency || candidate.tuition.period !== profile.budget.period) return factor('budget', MATCHING_MODEL_V1.preference.budget, { status: 'incompatible', score: null, evidence: [profile.budget.evidence, candidate.tuition.evidence], reasons: [], limitations: ['Budget and tuition do not share a currency and annual period.'] });
  const ratio = candidate.tuition.amount / profile.budget.amount;
  return factor('budget', MATCHING_MODEL_V1.preference.budget, { status: 'scored', score: ratio <= 1 ? 100 : ratio <= 1.2 ? 50 : 0, evidence: [profile.budget.evidence, candidate.tuition.evidence], reasons: [ratio <= 1 ? 'Programme tuition is within your stated annual budget.' : ratio <= 1.2 ? 'Programme tuition is slightly above your stated annual budget.' : 'Programme tuition exceeds your stated annual budget.'], limitations: ['This comparison excludes living costs and funding because current programme data is incomplete.'] });
}

function cityFactor(profile: StudentMatchingProfile, candidate: MatchingProgrammeCandidate): MatchFactorResult {
  if (profile.preferredCities.length === 0) return factor('city', MATCHING_MODEL_V1.preference.city, { status: 'not_applicable', score: null, evidence: [], reasons: ['No preferred city is set.'], limitations: [] });
  if (!candidate.city) return factor('city', MATCHING_MODEL_V1.preference.city, { status: 'unknown', score: null, evidence: [], reasons: [], limitations: ['Programme city is unavailable.'] });
  const match = profile.preferredCities.map(normalise).includes(normalise(candidate.city));
  return factor('city', MATCHING_MODEL_V1.preference.city, { status: 'scored', score: match ? 100 : 0, evidence: [], reasons: [match ? `${candidate.city} is one of your preferred cities.` : `${candidate.city} is outside your preferred cities.`], limitations: [] });
}

function characteristicsFactor(candidate: MatchingProgrammeCandidate): MatchFactorResult {
  return factor('characteristics', MATCHING_MODEL_V1.preference.characteristics, { status: 'unknown', score: null, evidence: [], reasons: [], limitations: candidate.characteristics.length === 0 ? ['No structured programme characteristics are available.'] : ['Current profile preferences do not provide structured characteristics to compare.'] });
}

export function evaluatePreference(profile: StudentMatchingProfile, candidate: MatchingProgrammeCandidate): PreferenceResult {
  const factors = [countryFactor(profile, candidate), programmeFactor(profile, candidate), budgetFactor(profile, candidate), cityFactor(profile, candidate), characteristicsFactor(candidate)];
  const availableWeight = factors.filter((item) => item.status === 'scored').reduce((sum, item) => sum + item.configuredWeight, 0);
  const totalWeight = factors.reduce((sum, item) => sum + item.configuredWeight, 0);
  const score = availableWeight === 0 ? null : factors.filter((item) => item.status === 'scored').reduce((sum, item) => sum + (item.score ?? 0) * item.configuredWeight, 0) / availableWeight;
  return { score, coverage: availableWeight / totalWeight, rankingSignal: score ?? MATCHING_MODEL_V1.ranking.neutralPreference, factors, reasons: factors.flatMap((item) => item.reasons), limitations: factors.flatMap((item) => item.limitations) };
}
