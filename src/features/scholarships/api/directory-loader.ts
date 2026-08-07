import { unstable_cache } from 'next/cache';
import { CACHE_TAGS, CACHE_TTL_LONG } from '@/server/cache';
import { getPublicUniversityFocus } from '@/server/directory/university-focus';
import {
  scholarshipSearchParams,
  type ScholarshipQueryState,
} from '../domain/query-state';
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
};

const emptyPage = (page: number): Page<DirectoryScholarship> => ({
  items: [],
  total: 0,
  page,
  pageSize: 9,
  hasMore: false,
});

export function scholarshipListQuery(
  state: ScholarshipQueryState,
  page: number,
): ScholarshipListQuery {
  return {
    page,
    pageSize: 9,
    search: state.search || undefined,
    universitySearch: state.universitySearch || undefined,
    major: state.major,
    degree: state.degree,
    country: state.country === 'all' ? undefined : state.country,
    funding: state.funding,
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

const loadCached = unstable_cache(
  async (requested: ScholarshipQueryState): Promise<ScholarshipDirectoryResponse> => {
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
  ['scholarship-directory'],
  {
    revalidate: CACHE_TTL_LONG,
    tags: [CACHE_TAGS.scholarships, CACHE_TAGS.universities],
  },
);

export function loadScholarshipDirectory(state: ScholarshipQueryState) {
  return loadCached(state);
}
