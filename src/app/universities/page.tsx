import { unstable_cache } from 'next/cache';
import { getScholarshipQueries } from '@/features/scholarships/api';
import {
  getUniversityQueries,
  UNIVERSITY_PAGE_SIZE_DEFAULT,
  type UniversityFacets,
  type UniversityListItem,
} from '@/features/universities/api';
import {
  toExplorerUniversity,
  type UniversityScholarship,
} from '@/lib/explorer-utils';
import { CACHE_TAGS, CACHE_TTL_LONG } from '@/server/cache';
import { UniversityListClient } from './university-list-client';

export const revalidate = 43200;

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

const getUniversityFacets = unstable_cache(
  async (): Promise<UniversityFacets> => getUniversityQueries().facets(),
  ['university-directory-facets'],
  { revalidate: CACHE_TTL_LONG, tags: [CACHE_TAGS.universities] },
);

const getScholarshipsForUniversities = unstable_cache(
  async (ids: number[]): Promise<Array<[number, UniversityScholarship[]]>> => {
    const byId = await getScholarshipQueries().byUniversityIds(ids);
    return [...byId.entries()];
  },
  ['university-directory-scholarships'],
  {
    revalidate: CACHE_TTL_LONG,
    tags: [CACHE_TAGS.universities, CACHE_TAGS.scholarships],
  },
);

type Props = {
  searchParams: Promise<{
    q?: string;
    country?: string;
    page?: string;
  }>;
};

export default async function UniversitiesPage({ searchParams }: Props) {
  const params = await searchParams;
  const parsedPage = Number.parseInt(params.page ?? '1', 10);
  const page = Number.isFinite(parsedPage) ? Math.max(parsedPage, 1) : 1;
  const search = params.q?.trim().slice(0, 100) ?? '';
  const country = params.country?.trim().slice(0, 100) ?? '';

  const [result, facets] = await Promise.all([
    getUniversityPage(page, search, country),
    getUniversityFacets(),
  ]);
  const scholarshipEntries = await getScholarshipsForUniversities(
    result.items.map((university) => university.id),
  );
  const scholarshipsByUniversity = new Map(scholarshipEntries);

  const universities = result.items.map((university: UniversityListItem) => {
    const item = toExplorerUniversity({
      ...university,
      match_score: null,
      match_breakdown: null,
      is_saved: false,
    });
    item.scholarships = scholarshipsByUniversity.get(item.id) ?? [];
    return item;
  });

  const wikiPairs: Array<[string, string]> = [];
  for (const university of universities) {
    if (!university.image_url.startsWith('__wiki__')) continue;
    const title = university.image_url.replace('__wiki__', '');
    wikiPairs.push([title, university.name]);
    university.image_url = '';
    university.logo_url = '';
  }

  return (
    <UniversityListClient
      universities={universities}
      total={result.total}
      page={result.page}
      pageSize={result.pageSize}
      search={search}
      country={country}
      countries={facets.countries.map((facet) => facet.value)}
      wikiPairs={wikiPairs}
    />
  );
}
