import { unstable_cache } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CACHE_TAGS, CACHE_TTL_LONG } from '@/server/cache';
import { clampPage, clampPageSize, pageOffset, toPage } from '@/shared/lib';
import { getPublicUniversityFocus } from '@/server/directory/university-focus';
import {
  scholarshipSearchParams,
  type ScholarshipQueryState,
} from '../domain/query-state';
import type { FrequentlyPickedAggregate } from '../domain/frequently-picked';
import {
  recommendScholarships,
  type ScholarshipRecommendationCandidate,
  type ScholarshipRecommendationResult,
} from '../domain/recommendation';
import { normalizeScholarshipDirectoryFilters } from '../domain/eligibility-normalization';
import {
  evaluateScholarshipEligibility,
  type ScholarshipEligibilityResult,
} from '../domain/eligibility';
import {
  SCHOLARSHIP_BENEFIT_NORMALIZER_VERSION,
  SCHOLARSHIP_QUERY_VERSION,
  SCHOLARSHIP_RANKING_VERSION,
  SCHOLARSHIP_VALUATION_VERSION,
  rankScholarships,
} from '../domain/ranking';
import { PERSONAL_FIT_POLICY_VERSION } from '../domain/personal-fit-policy';
import { scorePersonalFit, type PersonalFitResult } from '../domain/personal-fit';
import { calculateScholarshipValue, type TuitionSource } from '../domain/valuation';
import type { ScholarshipValueResult } from '../domain/valuation';
import { calculateDisplayScholarshipValue } from '../domain/value-formatting';
import { SCHOLARSHIP_VALUE_SORT_VERSION } from '../domain/value-sort';
import {
  FILE_COST_REFERENCE_DATASET,
  FILE_FX_REFERENCE_DATASET,
  getFileCostReferenceProvider,
  getFileFxReferenceProvider,
} from './file-reference-providers';
import { loadScholarshipMatchingContext } from './matching-context-loader';
import { loadFrequentlyPicked } from './frequently-picked';
import { getScholarshipQueries } from './index';
import type {
  DirectoryScholarship,
  Page,
  ScholarshipListQuery,
} from './scholarship-queries';
import type { NormalizedScholarshipBenefits } from '../domain/benefit-types';

export type ScholarshipDirectoryResponse = {
  query: ScholarshipQueryState;
  directoryPage: Page<DirectoryScholarship> | null;
  focusPage: Page<DirectoryScholarship> | null;
  countryPage: Page<DirectoryScholarship> | null;
  focusUniversity: { id: number; name: string; country: string | null } | null;
  canonicalSearch: string;
  /** Aggregate-only popularity data; individual users never cross this boundary. */
  frequentlyPicked: FrequentlyPickedAggregate;
  /** User-scoped canonical recommendations; public responses carry an empty map. */
  recommendations: Record<string, ScholarshipRecommendationResult>;
  /** Canonical value results for the visible cards; never contains user IDs. */
  values: Record<string, ScholarshipValueResult>;
};

type ScholarshipDirectoryBaseResponse = Omit<ScholarshipDirectoryResponse, 'frequentlyPicked' | 'recommendations'>;

const emptyPage = (page: number): Page<DirectoryScholarship> => ({
  items: [],
  total: 0,
  page,
  pageSize: 9,
  hasMore: false,
});

async function attachFrequentlyPicked(
  response: ScholarshipDirectoryBaseResponse,
  recommendations: Record<string, ScholarshipRecommendationResult> = {},
): Promise<ScholarshipDirectoryResponse> {
  const scholarshipIds = [...new Set([
    ...(response.directoryPage?.items ?? []),
    ...(response.focusPage?.items ?? []),
    ...(response.countryPage?.items ?? []),
  ].map((scholarship) => scholarship.id))].sort((left, right) => left - right);

  return {
    ...response,
    frequentlyPicked: await loadFrequentlyPicked({ scholarshipIds }),
    recommendations,
  };
}

function publicValueResults(
  items: readonly DirectoryScholarship[],
): Record<string, ScholarshipValueResult> {
  return Object.fromEntries(
    items.map((item) => [
      String(item.id),
      calculateDisplayScholarshipValue(item.benefits?.components ?? []),
    ]),
  );
}

export function scholarshipListQuery(
  state: ScholarshipQueryState,
  page: number,
): ScholarshipListQuery {
  return {
    page,
    pageSize: 9,
    ...(state.search ? { search: state.search } : {}),
    ...(state.universitySearch ? { universitySearch: state.universitySearch } : {}),
    major: state.major,
    degree: state.degree,
    ...(state.country === 'all' ? {} : { country: state.country }),
    funding: state.funding,
    filters: normalizeScholarshipDirectoryFilters({
      country: state.country === 'all' ? null : state.country,
      universityIds: state.universityId == null ? [] : [state.universityId],
      subject: state.subject || null,
      major: state.major === 'all' ? null : state.major,
      degree: state.degree === 'all' ? null : state.degree,
      fundingTypes: state.funding,
      deadline: state.deadline,
    }),
    sort: state.sort,
  };
}

async function loadPage(query: ScholarshipListQuery) {
  let result = await getScholarshipQueries().listPublished(query);
  if (result.total > 0 && result.items.length === 0 && query.page > 1) {
    const lastPage = Math.ceil(result.total / result.pageSize);
    result = await getScholarshipQueries().listPublished({ ...query, page: lastPage });
  }
  return result;
}

function asOfDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function programmeTuitionSource(
  context: Awaited<ReturnType<typeof loadScholarshipMatchingContext>>,
): TuitionSource | null {
  const programme = context.selection.programme;
  if (!programme?.tuitionAmount) return null;
  return {
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
  };
}

/**
 * The focused university is a presentation section, not a directory-wide
 * constraint. Related-country and zero-focus fallback queries must retain the
 * user's other filters while removing only that university scope.
 */
function unscopedScholarshipListQuery(
  state: ScholarshipQueryState,
  page: number,
): ScholarshipListQuery {
  return scholarshipListQuery({ ...state, universityId: null }, page);
}

function privateScholarshipValue(
  item: { id: number; benefits?: NormalizedScholarshipBenefits | null },
  context: Awaited<ReturnType<typeof loadScholarshipMatchingContext>>,
  asOf: string,
) {
  const matching = context.scholarships.find((scholarship) => scholarship.id === item.id);
  const benefits = matching?.benefits ?? item.benefits?.components ?? [];
  const tuitionSource = programmeTuitionSource(context);
  const programme = context.selection.programme;
  const university = context.selection.university;
  const costProvider = getFileCostReferenceProvider();
  const fx = getFileFxReferenceProvider({ asOf });
  const currencies = new Set(
    [
      ...benefits
        .map((component) => component.amount)
        .filter((amount) => amount?.currencyStatus === 'known' && amount.currency !== null)
        .map((amount) => amount!.currency!.toUpperCase()),
      ...(tuitionSource?.amount.currencyStatus === 'known' && tuitionSource.amount.currency
        ? [tuitionSource.amount.currency.toUpperCase()]
        : []),
    ],
  );
  const comparableCurrency = currencies.size === 1 ? [...currencies][0]! : undefined;
  const costContext = {
    programmeKey: programme?.id ?? null,
    universityKey: university?.id == null ? null : String(university.id),
    cityKey: university?.city ?? null,
    countryKey: university?.country ?? null,
    globalKey: 'global',
  };

  return calculateScholarshipValue({
    benefits,
    ...(programme?.duration ? { duration: { programme: programme.duration } } : {}),
    ...(tuitionSource ? { tuitionSource } : {}),
    costSources: (component) => costProvider.resolve({
      benefitType: component.type,
      context: costContext,
      asOf,
    }).source,
    fx,
    ...(comparableCurrency === undefined ? {} : { policy: { comparableCurrency } }),
  });
}

export type ScholarshipSurfaceCandidate = {
  id: number;
  name: string;
  deadline: string | number | null;
  benefits: NormalizedScholarshipBenefits | null;
};

export type ScholarshipSurfacePersonalization = {
  value: ScholarshipValueResult;
  eligibility: ScholarshipEligibilityResult | null;
  recommendation: ScholarshipRecommendationResult;
};

/**
 * Compose the canonical server-side presentation data for a bounded set of
 * scholarship surfaces such as Saved Scholarships and the application drawer.
 * The complete candidate set is scored in one request; only the resulting
 * scholarship-keyed summaries cross into the UI. This deliberately shares the
 * directory's T2A/T4/T5/T8 adapters instead of making each surface re-derive
 * a display-only match or value.
 */
export async function loadScholarshipSurfacePersonalization(args: {
  supabase: SupabaseClient;
  userId: string;
  candidates: readonly ScholarshipSurfaceCandidate[];
  applicationId?: string | null;
  selectedProgrammeId?: string | null;
  selectedUniversityId?: number | null;
}): Promise<Record<string, ScholarshipSurfacePersonalization>> {
  const candidates = [...new Map(
    args.candidates.map((candidate) => [candidate.id, candidate] as const),
  ).values()];
  if (candidates.length === 0) return {};

  const context = await loadScholarshipMatchingContext({
    supabase: args.supabase,
    request: {
      userId: args.userId,
      scholarshipIds: candidates.map((candidate) => candidate.id),
      ...(args.applicationId !== undefined ? { applicationId: args.applicationId } : {}),
      ...(args.selectedProgrammeId !== undefined ? { selectedProgrammeId: args.selectedProgrammeId } : {}),
      ...(args.selectedUniversityId !== undefined ? { selectedUniversityId: args.selectedUniversityId } : {}),
    },
  });
  const asOf = asOfDate();
  const matching = new Map(context.scholarships.map((scholarship) => [scholarship.id, scholarship]));
  const projections = candidates.map((candidate) => {
    const scholarship = matching.get(candidate.id);
    const eligibility = scholarship
      ? evaluateScholarshipEligibility({
          context,
          scholarship,
          policy: { asOf },
        })
      : null;
    const fit = scholarship && eligibility
      ? scorePersonalFit({ context, scholarship, eligibility })
      : null;
    const value = privateScholarshipValue(candidate, context, asOf);
    return {
      candidate,
      eligibility,
      fit,
      value,
      recommendation: {
        id: candidate.id,
        name: candidate.name,
        deadline: candidate.deadline,
        benefits: scholarship?.benefits ?? candidate.benefits?.components ?? [],
        eligibility,
        fit,
        value,
        item: candidate,
      } satisfies ScholarshipRecommendationCandidate<ScholarshipSurfaceCandidate>,
    };
  });
  const recommendationSet = recommendScholarships(
    projections.map((projection) => projection.recommendation),
  );
  const recommendations = new Map(
    recommendationSet.recommendations.map((entry) => [entry.result.scholarshipId, entry.result]),
  );

  return Object.fromEntries(projections.map((projection) => [
    String(projection.candidate.id),
    {
      value: projection.value,
      eligibility: projection.eligibility,
      recommendation: recommendations.get(projection.candidate.id)!,
    },
  ]));
}

type PrivateProjection = {
  ranking: {
    id: number;
    name: string;
    deadline: string | number | null;
    value: ReturnType<typeof privateScholarshipValue>;
    eligibility: ScholarshipEligibilityResult | null;
    fit: PersonalFitResult | null;
    item: DirectoryScholarship;
  };
  recommendation: ScholarshipRecommendationCandidate<DirectoryScholarship>;
};

function privateProjection(
  item: DirectoryScholarship,
  context: Awaited<ReturnType<typeof loadScholarshipMatchingContext>>,
  asOf: string,
  matching = new Map(context.scholarships.map((scholarship) => [scholarship.id, scholarship])),
): PrivateProjection {
  const scholarship = matching.get(item.id);
  let eligibility: ScholarshipEligibilityResult | null = null;
  let fit: PersonalFitResult | null = null;
  if (scholarship) {
    eligibility = evaluateScholarshipEligibility({
      context,
      scholarship,
      policy: { asOf },
    });
    fit = scorePersonalFit({ context, scholarship, eligibility });
  }
  const value = privateScholarshipValue(item, context, asOf);
  const benefits = scholarship?.benefits ?? item.benefits?.components ?? [];
  return {
    ranking: {
      id: item.id,
      name: item.name,
      deadline: item.deadline_date,
      value,
      eligibility,
      fit,
      item,
    },
    recommendation: {
      id: item.id,
      name: item.name,
      deadline: item.deadline_date,
      benefits,
      eligibility,
      fit,
      value,
      item,
    },
  };
}

function privateProjections(
  items: readonly DirectoryScholarship[],
  context: Awaited<ReturnType<typeof loadScholarshipMatchingContext>>,
  asOf: string,
): PrivateProjection[] {
  const matching = new Map(context.scholarships.map((scholarship) => [scholarship.id, scholarship]));
  return items.map((item) => privateProjection(item, context, asOf, matching));
}

function privatePage(
  items: readonly DirectoryScholarship[],
  context: Awaited<ReturnType<typeof loadScholarshipMatchingContext>>,
  query: ScholarshipListQuery,
  asOf: string,
  prepared?: ReadonlyMap<number, PrivateProjection>,
): Page<DirectoryScholarship> {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize, 100, 9);
  const projections = items.map((item) => prepared?.get(item.id) ?? privateProjection(item, context, asOf));
  const ranked = rankScholarships(
    projections.map((projection) => projection.ranking),
    query.sort ?? 'relevance',
    { version: SCHOLARSHIP_RANKING_VERSION },
  ).map((candidate) => candidate.item);
  const start = pageOffset(page, pageSize);
  return toPage(ranked.slice(start, start + pageSize), ranked.length, page, pageSize);
}

/**
 * User-scoped directory path. Public candidate data may come from the public
 * catalogue cache, but context, eligibility, fit, and final ordering are
 * request-scoped and are never written to that cache.
 */
export async function loadScholarshipDirectoryForUser(args: {
  state: ScholarshipQueryState;
  supabase: SupabaseClient;
  userId: string;
}): Promise<ScholarshipDirectoryResponse> {
  const requested = args.state;
  if (requested.view !== 'directory') {
    throw new Error('The user scholarship loader only supports directory view');
  }

  const focusUniversity = requested.universityId == null
    ? null
    : await getPublicUniversityFocus(requested.universityId);
  const query: ScholarshipQueryState = focusUniversity
    ? { ...requested }
    : { ...requested, universityId: null, countryPage: 1 };
  const directoryQuery = focusUniversity
    ? unscopedScholarshipListQuery(query, 1)
    : scholarshipListQuery(query, 1);
  const repository = getScholarshipQueries();
  const candidateQuery = (value: ScholarshipListQuery): ScholarshipListQuery => ({
    ...value,
    page: 1,
    pageSize: 100,
  });

  let directoryCandidates: DirectoryScholarship[] = [];
  let focusCandidates: DirectoryScholarship[] = [];
  let countryCandidates: DirectoryScholarship[] = [];
  if (focusUniversity) {
    const focusQuery: ScholarshipListQuery = {
      ...directoryQuery,
      universityId: focusUniversity.id,
    };
    const countryQuery = focusUniversity.country
      ? {
          ...unscopedScholarshipListQuery(query, 1),
          relatedUniversityCountry: focusUniversity.country,
          excludeUniversityId: focusUniversity.id,
        }
      : null;
    [directoryCandidates, focusCandidates, countryCandidates] = await Promise.all([
      repository.listPublishedCandidates(candidateQuery(directoryQuery)),
      repository.listPublishedCandidates(candidateQuery(focusQuery)),
      countryQuery
        ? repository.listPublishedCandidates(candidateQuery(countryQuery))
        : Promise.resolve([]),
    ]);
  } else {
    directoryCandidates = await repository.listPublishedCandidates(candidateQuery(directoryQuery));
  }

  const scholarshipIds = [...new Set([
    ...directoryCandidates,
    ...focusCandidates,
    ...countryCandidates,
  ].map((item) => item.id))].sort((left, right) => left - right);
  const context = await loadScholarshipMatchingContext({
    supabase: args.supabase,
    request: {
      userId: args.userId,
      scholarshipIds,
      selectedUniversityId: focusUniversity?.id ?? null,
    },
  });
  const asOf = asOfDate();
  const completeCandidates = [...new Map([
    ...directoryCandidates,
    ...focusCandidates,
    ...countryCandidates,
  ].map((item) => [item.id, item] as const)).values()];
  const preparedProjections = privateProjections(completeCandidates, context, asOf);
  const prepared = new Map(preparedProjections.map((projection) => [projection.ranking.id, projection]));

  let directoryPage: Page<DirectoryScholarship> | null = null;
  let focusPage: Page<DirectoryScholarship> | null = null;
  let countryPage: Page<DirectoryScholarship> | null = null;
  if (focusUniversity) {
    const focusQuery: ScholarshipListQuery = {
      ...directoryQuery,
      universityId: focusUniversity.id,
    };
    const countryQuery = focusUniversity.country
      ? {
          ...unscopedScholarshipListQuery(query, query.countryPage),
          relatedUniversityCountry: focusUniversity.country,
          excludeUniversityId: focusUniversity.id,
        }
      : null;
    focusPage = privatePage(
      focusCandidates,
      context,
      focusQuery,
      asOf,
      prepared,
    );
    countryPage = privatePage(
      countryCandidates,
      context,
      countryQuery ?? unscopedScholarshipListQuery(query, query.countryPage),
      asOf,
      prepared,
    );
    query.page = focusPage.page;
    query.countryPage = countryPage.page;
    if (focusPage.total === 0) {
      directoryPage = privatePage(directoryCandidates, context, directoryQuery, asOf, prepared);
    }
  } else {
    directoryPage = privatePage(directoryCandidates, context, directoryQuery, asOf, prepared);
    query.page = directoryPage.page;
  }

  const recommendationSet = recommendScholarships(
    preparedProjections.map((projection) => projection.recommendation),
  );
  const visibleIds = new Set([
    ...(directoryPage?.items ?? []),
    ...(focusPage?.items ?? []),
    ...(countryPage?.items ?? []),
  ].map((item) => item.id));
  const recommendations = Object.fromEntries(
    recommendationSet.recommendations
      .filter((entry) => visibleIds.has(entry.result.scholarshipId))
      .map((entry) => [String(entry.result.scholarshipId), entry.result]),
  );
  const values = Object.fromEntries(
    [...visibleIds]
      .map((id) => prepared.get(id)?.ranking)
      .filter((projection): projection is NonNullable<typeof projection> => projection != null)
      .map((projection) => [String(projection.id), projection.value]),
  );

  const publicFocus = focusUniversity
    ? { id: focusUniversity.id, name: focusUniversity.name, country: focusUniversity.country }
    : null;
  return attachFrequentlyPicked({
    query,
    directoryPage,
    focusPage,
    countryPage,
    focusUniversity: publicFocus,
    canonicalSearch: scholarshipSearchParams(query, {}).toString(),
    values,
  }, recommendations);
}

const loadCached = unstable_cache(
  async (requested: ScholarshipQueryState): Promise<ScholarshipDirectoryBaseResponse> => {
    if (requested.view !== 'directory') {
      throw new Error('The public scholarship loader only supports directory view');
    }

    const focusUniversity = requested.universityId == null
      ? null
      : await getPublicUniversityFocus(requested.universityId);
    const query: ScholarshipQueryState = focusUniversity
      ? { ...requested }
      : { ...requested, universityId: null, countryPage: 1 };
    const directoryQuery = focusUniversity
      ? unscopedScholarshipListQuery(query, query.page)
      : scholarshipListQuery(query, query.page);
    let directoryPage: Page<DirectoryScholarship> | null = null;
    let focusPage: Page<DirectoryScholarship> | null = null;
    let countryPage: Page<DirectoryScholarship> | null = null;

    if (focusUniversity) {
      const focusQuery: ScholarshipListQuery = {
        ...directoryQuery,
        universityId: focusUniversity.id,
      };
      const countryQuery = focusUniversity.country
        ? {
            ...unscopedScholarshipListQuery(query, query.countryPage),
            relatedUniversityCountry: focusUniversity.country,
            excludeUniversityId: focusUniversity.id,
          }
        : null;
      [focusPage, countryPage] = await Promise.all([
        loadPage(focusQuery),
        countryQuery
          ? loadPage(countryQuery)
          : Promise.resolve(emptyPage(query.countryPage)),
      ]);
      query.page = focusPage.page;
      query.countryPage = countryPage.page;
      if (focusPage.total === 0) directoryPage = await loadPage(directoryQuery);
    } else {
      directoryPage = await loadPage(directoryQuery);
      query.page = directoryPage.page;
    }

    const publicFocus = focusUniversity
      ? { id: focusUniversity.id, name: focusUniversity.name, country: focusUniversity.country }
      : null;
    const visibleItems = [
      ...(directoryPage?.items ?? []),
      ...(focusPage?.items ?? []),
      ...(countryPage?.items ?? []),
    ];

    return {
      query,
      directoryPage,
      focusPage,
      countryPage,
      focusUniversity: publicFocus,
      canonicalSearch: scholarshipSearchParams(query, {}).toString(),
      values: publicValueResults(visibleItems),
    };
  },
  [
    'scholarship-directory',
    SCHOLARSHIP_RANKING_VERSION,
    SCHOLARSHIP_BENEFIT_NORMALIZER_VERSION,
    SCHOLARSHIP_VALUATION_VERSION,
    SCHOLARSHIP_VALUE_SORT_VERSION,
    PERSONAL_FIT_POLICY_VERSION,
    SCHOLARSHIP_QUERY_VERSION,
    FILE_COST_REFERENCE_DATASET.version,
    FILE_FX_REFERENCE_DATASET.version,
  ],
  {
    revalidate: CACHE_TTL_LONG,
    tags: [CACHE_TAGS.scholarships, CACHE_TAGS.universities],
  },
);

export function loadScholarshipDirectory(state: ScholarshipQueryState) {
  return loadCached(state).then(attachFrequentlyPicked);
}
