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

export type ScholarshipDirectoryResponse = {
  query: ScholarshipQueryState;
  directoryPage: Page<DirectoryScholarship> | null;
  focusPage: Page<DirectoryScholarship> | null;
  countryPage: Page<DirectoryScholarship> | null;
  focusUniversity: { id: number; name: string; country: string | null } | null;
  canonicalSearch: string;
  /** Aggregate-only popularity data; individual users never cross this boundary. */
  frequentlyPicked: FrequentlyPickedAggregate;
};

type ScholarshipDirectoryBaseResponse = Omit<ScholarshipDirectoryResponse, 'frequentlyPicked'>;

const emptyPage = (page: number): Page<DirectoryScholarship> => ({
  items: [],
  total: 0,
  page,
  pageSize: 9,
  hasMore: false,
});

async function attachFrequentlyPicked(
  response: ScholarshipDirectoryBaseResponse,
): Promise<ScholarshipDirectoryResponse> {
  const scholarshipIds = [...new Set([
    ...(response.directoryPage?.items ?? []),
    ...(response.focusPage?.items ?? []),
    ...(response.countryPage?.items ?? []),
  ].map((scholarship) => scholarship.id))].sort((left, right) => left - right);

  return {
    ...response,
    frequentlyPicked: await loadFrequentlyPicked({ scholarshipIds }),
  };
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

function privateScholarshipValue(
  item: DirectoryScholarship,
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

function privateRankedItems(
  items: readonly DirectoryScholarship[],
  context: Awaited<ReturnType<typeof loadScholarshipMatchingContext>>,
  sort: ScholarshipQueryState['sort'],
  asOf: string,
): DirectoryScholarship[] {
  const matching = new Map(context.scholarships.map((scholarship) => [scholarship.id, scholarship]));
  const projections = items.map((item) => {
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
    return {
      id: item.id,
      name: item.name,
      deadline: item.deadline_date,
      value: privateScholarshipValue(item, context, asOf),
      eligibility,
      fit,
      item,
    };
  });

  return rankScholarships(projections, sort, { version: SCHOLARSHIP_RANKING_VERSION })
    .map((candidate) => candidate.item);
}

function privatePage(
  items: readonly DirectoryScholarship[],
  context: Awaited<ReturnType<typeof loadScholarshipMatchingContext>>,
  query: ScholarshipListQuery,
  asOf: string,
): Page<DirectoryScholarship> {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize, 100, 9);
  const ranked = privateRankedItems(items, context, query.sort ?? 'relevance', asOf);
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
  const baseQuery = scholarshipListQuery(query, 1);
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
    [directoryCandidates, focusCandidates, countryCandidates] = await Promise.all([
      repository.listPublishedCandidates(candidateQuery(baseQuery)),
      repository.listPublishedCandidates(candidateQuery({ ...baseQuery, universityId: focusUniversity.id })),
      focusUniversity.country
        ? repository.listPublishedCandidates(candidateQuery({
            ...scholarshipListQuery(query, 1),
            relatedUniversityCountry: focusUniversity.country,
            excludeUniversityId: focusUniversity.id,
          }))
        : Promise.resolve([]),
    ]);
  } else {
    directoryCandidates = await repository.listPublishedCandidates(candidateQuery(baseQuery));
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

  let directoryPage: Page<DirectoryScholarship> | null = null;
  let focusPage: Page<DirectoryScholarship> | null = null;
  let countryPage: Page<DirectoryScholarship> | null = null;
  if (focusUniversity) {
    focusPage = privatePage(
      focusCandidates,
      context,
      { ...baseQuery, universityId: focusUniversity.id },
      asOf,
    );
    countryPage = privatePage(
      countryCandidates,
      context,
      scholarshipListQuery(query, query.countryPage),
      asOf,
    );
    query.page = focusPage.page;
    query.countryPage = countryPage.page;
    if (focusPage.total === 0) {
      directoryPage = privatePage(directoryCandidates, context, baseQuery, asOf);
    }
  } else {
    directoryPage = privatePage(directoryCandidates, context, baseQuery, asOf);
    query.page = directoryPage.page;
  }

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
  });
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
    const baseQuery = scholarshipListQuery(query, query.page);
    let directoryPage: Page<DirectoryScholarship> | null = null;
    let focusPage: Page<DirectoryScholarship> | null = null;
    let countryPage: Page<DirectoryScholarship> | null = null;

    if (focusUniversity) {
      [focusPage, countryPage] = await Promise.all([
        loadPage({ ...baseQuery, universityId: focusUniversity.id }),
        focusUniversity.country
          ? loadPage({
              ...scholarshipListQuery(query, query.countryPage),
              relatedUniversityCountry: focusUniversity.country,
              excludeUniversityId: focusUniversity.id,
            })
          : Promise.resolve(emptyPage(query.countryPage)),
      ]);
      query.page = focusPage.page;
      query.countryPage = countryPage.page;
      if (focusPage.total === 0) directoryPage = await loadPage(baseQuery);
    } else {
      directoryPage = await loadPage(baseQuery);
      query.page = directoryPage.page;
    }

    const publicFocus = focusUniversity
      ? { id: focusUniversity.id, name: focusUniversity.name, country: focusUniversity.country }
      : null;

    return {
      query,
      directoryPage,
      focusPage,
      countryPage,
      focusUniversity: publicFocus,
      canonicalSearch: scholarshipSearchParams(query, {}).toString(),
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
