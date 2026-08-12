import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getScholarshipQueries } from '@/features/scholarships/api';
import {
  parseScholarshipSearchParams,
  scholarshipSearchParams,
} from '@/features/scholarships/directory-query';
import { loadScholarshipDirectory } from '@/features/scholarships/directory-loader';
import { ScholarshipDirectoryClient } from './scholarship-directory-client';

export const revalidate = 43200;

type RawSearchParams = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<RawSearchParams> };

export default async function ScholarshipsPage({ searchParams }: Props) {
  const state = parseScholarshipSearchParams(await searchParams);
  const directoryPromise = state.view === 'directory'
    ? loadScholarshipDirectory(state)
    : Promise.resolve(null);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const applicationsPromise = state.view === 'ai'
    ? supabase
        .from('course_applications')
        .select('id, university_name, course_name, degree_level, subject, country, country_flag, intake, deadline, status')
        .eq('user_id', user.id)
        .not('status', 'in', '("rejected","withdrawn","archived")')
        .order('created_at', { ascending: false })
    : Promise.resolve({ data: [] });

  const [directory, facets, savedResult, applicationsResult, savedScholarshipsResult] =
    await Promise.all([
      directoryPromise,
      getScholarshipQueries().facets(),
      supabase
        .from('user_universities')
        .select('university_id, universities(country)')
        .eq('user_id', user.id),
      applicationsPromise,
      supabase.from('user_scholarships').select('scholarship_id').eq('user_id', user.id),
    ]);

  const currentSearch = scholarshipSearchParams(state, {}).toString();
  if (directory && directory.canonicalSearch !== currentSearch) {
    redirect(directory.canonicalSearch ? `/scholarships?${directory.canonicalSearch}` : '/scholarships');
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
    <main
      data-no-auto-translate
      className="min-h-screen bg-surface-muted px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-10"
    >
      <div className="mx-auto w-full max-w-7xl">
        <ScholarshipDirectoryClient
          queryState={directory?.query ?? state}
          directoryPage={directory?.directoryPage ?? null}
          focusPage={directory?.focusPage ?? null}
          countryPage={directory?.countryPage ?? null}
          facets={facets}
          savedUniversityIds={savedUniversityIds}
          savedCountries={savedCountries}
          applications={applications}
          existingScholarships={existingScholarships}
          focusUniversity={directory?.focusUniversity ?? null}
          savedScholarshipIds={savedScholarshipIds}
          canonicalSearch={directory?.canonicalSearch ?? currentSearch}
        />
      </div>
    </main>
  );
}
