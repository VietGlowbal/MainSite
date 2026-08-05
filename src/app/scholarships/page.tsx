import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  getScholarshipQueries,
  parseScholarshipSearchParams,
  scholarshipSearchParams,
  type DirectoryScholarship,
  type Page,
  type ScholarshipListQuery,
  type ScholarshipQueryState,
} from '@/features/scholarships';
import { ScholarshipDirectoryClient } from './scholarship-directory-client';

export const revalidate = 43200;

type RawSearchParams = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<RawSearchParams> };

const emptyPage = (page: number): Page<DirectoryScholarship> => ({
  items: [],
  total: 0,
  page,
  pageSize: 9,
  hasMore: false,
});

function listQuery(state: ScholarshipQueryState, page: number): ScholarshipListQuery {
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

export default async function ScholarshipsPage({ searchParams }: Props) {
  const state = parseScholarshipSearchParams(await searchParams);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const focusPromise = state.universityId == null
    ? Promise.resolve(null)
    : supabase
        .from('universities')
        .select('id, name, country')
        .eq('id', state.universityId)
        .maybeSingle()
        .then(({ data }) => data ?? null);

  const [focusUniversity, facets, savedResult, applicationsResult, savedScholarshipsResult] =
    await Promise.all([
      focusPromise,
      getScholarshipQueries().facets(),
      supabase
        .from('user_universities')
        .select('university_id, universities(country)')
        .eq('user_id', user.id),
      supabase
        .from('course_applications')
        .select('id, university_name, course_name, degree_level, subject, country, country_flag, intake, deadline, status')
        .eq('user_id', user.id)
        .not('status', 'in', '("rejected","withdrawn","archived")')
        .order('created_at', { ascending: false }),
      supabase.from('user_scholarships').select('scholarship_id').eq('user_id', user.id),
    ]);

  if (state.universityId != null && !focusUniversity) {
    redirect(`/scholarships?${scholarshipSearchParams(state, { universityId: null })}`);
  }

  const baseQuery = listQuery(state, state.page);
  let directoryPage: Page<DirectoryScholarship> | null = null;
  let focusPage: Page<DirectoryScholarship> | null = null;
  let countryPage: Page<DirectoryScholarship> | null = null;

  if (focusUniversity) {
    [focusPage, countryPage] = await Promise.all([
      getScholarshipQueries().listPublished({ ...baseQuery, universityId: focusUniversity.id }),
      focusUniversity.country
        ? getScholarshipQueries().listPublished({
            ...listQuery(state, state.countryPage),
            relatedUniversityCountry: focusUniversity.country,
            excludeUniversityId: focusUniversity.id,
          })
        : Promise.resolve(emptyPage(state.countryPage)),
    ]);
    if (focusPage.total === 0) {
      directoryPage = await getScholarshipQueries().listPublished(baseQuery);
    }
  } else {
    directoryPage = await getScholarshipQueries().listPublished(baseQuery);
  }

  const savedScholarshipIds = (savedScholarshipsResult.data ?? []).map((row) =>
    Number(row.scholarship_id),
  );
  const savedRows = (savedResult.data ?? []) as Array<{
    university_id: number;
    universities: { country: string | null } | { country: string | null }[] | null;
  }>;
  const savedUniversityIds = savedRows.map((row) => row.university_id);
  const savedCountries = [
    ...new Set(
      savedRows
        .map((row) =>
          Array.isArray(row.universities)
            ? row.universities[0]?.country
            : row.universities?.country,
        )
        .filter((country): country is string => Boolean(country)),
    ),
  ];
  const applications = applicationsResult.data ?? [];

  // AI-owned data path: intentionally unchanged by this performance pass.
  const appIds = applications.map((application) => application.id);
  let existingScholarships: Array<{
    id: string;
    application_id: string;
    title: string;
    description: string | null;
    url: string | null;
    confidence: string;
  }> = [];
  if (appIds.length > 0) {
    const { data: resources } = await supabase
      .from('application_sources')
      .select('id, application_id, title, description, url, confidence')
      .in('application_id', appIds)
      .eq('source_type', 'scholarships');
    existingScholarships = (resources ?? []).map((resource) => ({
      ...resource,
      confidence: String(resource.confidence ?? 0.7),
    }));
  }

  return (
    <main className="min-h-screen bg-surface-muted px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-10">
      <div className="mx-auto w-full max-w-7xl">
        <ScholarshipDirectoryClient
          queryState={state}
          directoryPage={directoryPage}
          focusPage={focusPage}
          countryPage={countryPage}
          facets={facets}
          savedUniversityIds={savedUniversityIds}
          savedCountries={savedCountries}
          applications={applications}
          existingScholarships={existingScholarships}
          focusUniversity={focusUniversity}
          savedScholarshipIds={savedScholarshipIds}
        />
      </div>
    </main>
  );
}
