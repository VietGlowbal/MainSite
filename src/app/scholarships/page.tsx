import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPublishedScholarships } from '@/lib/scholarships-data';
import { JourneySteps } from '@/components/JourneySteps';
import { ScholarshipDirectoryClient } from './scholarship-directory-client';

// The published scholarship list is cached in scholarships-data.ts (12h); the
// per-user personalization below stays dynamic. Mirrors universities/page.tsx.
export const revalidate = 43200;

type Props = {
  // Optional ?university=<id> deep-link from a university detail page, used to
  // scope the directory to scholarships applicable to that university.
  searchParams: Promise<{ university?: string }>;
};

export default async function ScholarshipsPage({ searchParams }: Props) {
  const params = await searchParams;
  const parsedFocusId = params.university ? Number.parseInt(params.university, 10) : NaN;
  const focusUniversityId = Number.isFinite(parsedFocusId) ? parsedFocusId : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  // When deep-linked from a university page, resolve its name so the directory
  // can show a "scholarships for {name}" context even if none are linked yet.
  let focusUniversity: { id: number; name: string } | null = null;
  if (focusUniversityId != null) {
    const { data } = await supabase
      .from('universities')
      .select('id, name')
      .eq('id', focusUniversityId)
      .maybeSingle();
    if (data) focusUniversity = { id: data.id, name: data.name };
  }

  // Curated directory (cached, identical for everyone) + per-user signals in parallel.
  const [scholarships, savedResult, applicationsResult] = await Promise.all([
    getPublishedScholarships(),
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
  ]);

  // Personalization keys: saved university ids + their countries.
  const savedRows = (savedResult.data ?? []) as Array<{
    university_id: number;
    universities: { country: string | null } | { country: string | null }[] | null;
  }>;
  const savedUniversityIds = savedRows.map((r) => r.university_id);
  const savedCountries = [
    ...new Set(
      savedRows
        .map((r) => (Array.isArray(r.universities) ? r.universities[0]?.country : r.universities?.country))
        .filter((c): c is string => !!c),
    ),
  ];

  const applications = applicationsResult.data ?? [];

  // Scholarships extracted earlier during course import (for the AI tab).
  const appIds = applications.map((a) => a.id);
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

    existingScholarships = (resources ?? []).map((r) => ({
      ...r,
      confidence: String(r.confidence ?? 0.7),
    }));
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto w-full max-w-6xl">
        <JourneySteps activeStep={4} />
        <ScholarshipDirectoryClient
          scholarships={scholarships}
          savedUniversityIds={savedUniversityIds}
          savedCountries={savedCountries}
          applications={applications}
          existingScholarships={existingScholarships}
          focusUniversity={focusUniversity}
        />
      </div>
    </main>
  );
}
