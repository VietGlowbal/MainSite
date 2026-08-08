import { unstable_cache } from 'next/cache';
import { toExplorerUniversity, type ExplorerUniversity } from '@/lib/explorer-utils';
import { CACHE_TAGS, CACHE_TTL_LONG } from '@/server/cache';
import type { Page } from '@/shared/lib/pagination';
import {
  universitySearchParams,
  type UniversityDirectoryQueryState,
} from '../domain/directory-query';
import { getUniversityQueries } from './index';
import { UNIVERSITY_PAGE_SIZE_DEFAULT, type UniversityFacets } from './university-queries';

export type UniversityDirectoryResponse = {
  query: UniversityDirectoryQueryState;
  page: Page<ExplorerUniversity>;
  wikiPairs: Array<[string, string]>;
  canonicalSearch: string;
};

const getUniversityPage = unstable_cache(
  async (page: number, search: string, country: string) =>
    getUniversityQueries().list({
      page,
      pageSize: UNIVERSITY_PAGE_SIZE_DEFAULT,
      ...(search ? { search } : {}),
      ...(country ? { countries: [country] } : {}),
      sort: 'rank',
    }),
  ['university-directory-page'],
  { revalidate: CACHE_TTL_LONG, tags: [CACHE_TAGS.universities] },
);

export const getUniversityFacets = unstable_cache(
  async (): Promise<UniversityFacets> => getUniversityQueries().facets(),
  ['university-directory-facets'],
  { revalidate: CACHE_TTL_LONG, tags: [CACHE_TAGS.universities] },
);

export async function loadUniversityDirectory(
  requested: UniversityDirectoryQueryState,
): Promise<UniversityDirectoryResponse> {
  let result = await getUniversityPage(requested.page, requested.search, requested.country);
  if (result.total > 0 && result.items.length === 0 && requested.page > 1) {
    const lastPage = Math.ceil(result.total / result.pageSize);
    result = await getUniversityPage(lastPage, requested.search, requested.country);
  }

  const wikiPairs: Array<[string, string]> = [];
  const items = result.items.map((university) => {
    const item = toExplorerUniversity({
      ...university,
      match_score: null,
      match_breakdown: null,
      is_saved: false,
    });
    if (item.image_url.startsWith('__wiki__')) {
      wikiPairs.push([item.image_url.replace('__wiki__', ''), item.name]);
      item.image_url = '';
      item.logo_url = '';
    }
    return item;
  });
  const query = { ...requested, page: result.page };

  return {
    query,
    page: { ...result, items },
    wikiPairs,
    canonicalSearch: universitySearchParams(query, {}).toString(),
  };
}
