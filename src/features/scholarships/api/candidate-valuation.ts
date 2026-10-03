import type { BenefitComponent } from '../domain/benefit-types';
import {
  DEFAULT_SCHOLARSHIP_COMPARISON_POLICY,
  resolveScholarshipComparisonPolicy,
  type ScholarshipComparisonPolicy,
} from '../domain/comparison-policy';
import type { CostReferenceProvider } from '../domain/cost-reference';
import type {
  MatchingProgrammeContext,
  MatchingUniversityContext,
} from '../domain/matching-context';
import type { ScholarshipValuationContext } from '../domain/valuation-context';
import {
  selectScholarshipValuationContext,
  type ScholarshipValuationProgrammeContext,
  type ScholarshipValuationUniversityContext,
} from '../domain/valuation-context';
import {
  calculateScholarshipValue,
  type FxProvider,
  type ScholarshipValueResult,
} from '../domain/valuation';
import {
  FILE_COST_REFERENCE_DATASET,
  FILE_FX_REFERENCE_DATASET,
  getFileCostReferenceProvider,
  getFileFxReferenceProvider,
} from './file-reference-providers';

export const SCHOLARSHIP_CANDIDATE_VALUATION_VERSION = 'scholarship-candidate-valuation-v2';

export type ScholarshipValuationCandidate = {
  id: number;
  country?: string | null | undefined;
  benefits: readonly BenefitComponent[];
  valuationContexts?: readonly ScholarshipValuationContext[] | undefined;
};

export type ScholarshipValuationRefinement = {
  programme: ScholarshipValuationProgrammeContext | null;
  university: ScholarshipValuationUniversityContext | null;
};

export type CandidateValuationDependencies = {
  asOf: string;
  costProvider?: CostReferenceProvider;
  fx?: FxProvider;
  comparisonPolicy?: ScholarshipComparisonPolicy;
};

export function valuationRefinementFromMatchingSelection(selection: {
  programme: MatchingProgrammeContext | null;
  university: MatchingUniversityContext | null;
}): ScholarshipValuationRefinement {
  const programme = selection.programme;
  return {
    programme: programme
      ? {
          id: programme.id,
          name: programme.name,
          universityId: programme.universityId,
          duration: programme.duration,
          tuitionSource: programme.tuitionAmount
            ? {
                amount: programme.tuitionAmount,
                period: programme.tuitionPeriod,
                ...(programme.duration ? { duration: programme.duration } : {}),
                status: 'ESTIMATED',
                sourceType: 'programme-tuition',
                ...(programme.source.retrievedAt ? { sourceVersion: programme.source.retrievedAt } : {}),
                confidence: 'medium',
                evidence: [{
                  sourceType: 'catalogue-field',
                  sourceField: 'raw',
                  excerpt: programme.tuitionText ?? 'Programme tuition source',
                  sourceUrl: programme.source.sourceUrl,
                }],
              }
            : null,
          provenance: {
            sourceType: 'programme',
            recordId: programme.id,
            sourceUrl: programme.source.sourceUrl,
            retrievedAt: programme.source.retrievedAt,
          },
        }
      : null,
    university: selection.university
      ? {
          id: selection.university.id,
          name: selection.university.name,
          city: selection.university.city,
          country: selection.university.country,
          provenance: {
            sourceType: 'university',
            recordId: String(selection.university.id),
            sourceUrl: selection.university.source.sourceUrl,
            retrievedAt: selection.university.source.retrievedAt,
          },
        }
      : null,
  };
}

function fallbackContext(candidate: ScholarshipValuationCandidate): ScholarshipValuationContext {
  return {
    scholarshipId: candidate.id,
    programme: null,
    university: null,
    city: null,
    country: candidate.country?.trim() || null,
    programmeKey: null,
    universityKey: null,
    cityKey: null,
    countryKey: candidate.country?.trim() || null,
    duration: null,
    tuitionReferenceKey: null,
    provenance: [{
      sourceType: 'scholarship-catalogue',
      recordId: String(candidate.id),
      sourceUrl: null,
      retrievedAt: null,
    }],
  };
}

function defaultCostProvider(): CostReferenceProvider {
  return getFileCostReferenceProvider();
}

function defaultFxProvider(asOf: string): FxProvider {
  return getFileFxReferenceProvider({ asOf });
}

/**
 * One server adapter for both public and private catalogue valuation. The
 * engine remains pure; this adapter owns provider lookup and candidate-context
 * selection. A private refinement is accepted only when the candidate context
 * proves the selected programme/university applies to that scholarship.
 */
export function calculateCandidateScholarshipValue(
  candidate: ScholarshipValuationCandidate,
  refinement: ScholarshipValuationRefinement | null,
  dependencies: CandidateValuationDependencies,
): ScholarshipValueResult {
  const costProvider = dependencies.costProvider ?? defaultCostProvider();
  const fx = dependencies.fx ?? defaultFxProvider(dependencies.asOf);
  const comparisonPolicy = resolveScholarshipComparisonPolicy({
    comparisonPolicy: dependencies.comparisonPolicy ?? DEFAULT_SCHOLARSHIP_COMPARISON_POLICY,
  });
  const context = selectScholarshipValuationContext(
    candidate.valuationContexts ?? [fallbackContext(candidate)],
    refinement,
  );
  const selected = context ?? fallbackContext(candidate);
  const costContext = {
    programmeKey: selected.programmeKey,
    universityKey: selected.universityKey,
    cityKey: selected.cityKey,
    countryKey: selected.countryKey,
    globalKey: 'global',
  };

  return calculateScholarshipValue({
    benefits: candidate.benefits,
    ...(selected.duration ? { duration: { programme: selected.duration } } : {}),
    ...(selected.programme?.tuitionSource ? { tuitionSource: selected.programme.tuitionSource } : {}),
    costSources: (component) => costProvider.resolve({
      benefitType: component.type,
      context: costContext,
      asOf: dependencies.asOf,
    }).source,
    fx,
    policy: { comparableCurrency: comparisonPolicy.currency },
  });
}

export const CANDIDATE_VALUATION_CACHE_VERSIONS = [
  SCHOLARSHIP_CANDIDATE_VALUATION_VERSION,
  FILE_COST_REFERENCE_DATASET.version,
  FILE_FX_REFERENCE_DATASET.version,
  DEFAULT_SCHOLARSHIP_COMPARISON_POLICY.version,
  DEFAULT_SCHOLARSHIP_COMPARISON_POLICY.currency,
] as const;

export const SCHOLARSHIP_VALUATION_CACHE_KEY_VERSION = 'scholarship-valuation-cache-v1';

/**
 * Public valuation caches are date-bucketed because cost and FX references
 * can become effective or stale without a dataset code change. Provider and
 * policy versions remain part of the identity as an additional invalidation
 * boundary. The returned key contains no user-specific information.
 */
export function scholarshipValuationCacheKey(
  asOf: string,
  versions: readonly string[] = CANDIDATE_VALUATION_CACHE_VERSIONS,
): string {
  const normalizedAsOf = asOf.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedAsOf)) {
    throw new Error('Scholarship valuation cache keys require a YYYY-MM-DD asOf date.');
  }
  return [SCHOLARSHIP_VALUATION_CACHE_KEY_VERSION, normalizedAsOf, ...versions].join('|');
}

export type ScholarshipValuationCacheInput = {
  asOf: string;
  key: string;
};

export function scholarshipValuationCacheInput(asOf: string): ScholarshipValuationCacheInput {
  return { asOf, key: scholarshipValuationCacheKey(asOf) };
}
