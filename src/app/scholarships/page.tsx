import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { JourneySteps } from '@/components/JourneySteps';
import { ScholarshipDashboard } from './scholarship-dashboard';

export default async function ScholarshipsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  // Fetch user's active applications for the scholarship search
  const { data: applications } = await supabase
    .from('course_applications')
    .select('id, university_name, course_name, degree_level, subject, country, country_flag, intake, deadline, status')
    .eq('user_id', user.id)
    .not('status', 'in', '("rejected","withdrawn","archived")')
    .order('created_at', { ascending: false });

  // Fetch any existing scholarship sources already saved
  const appIds = (applications ?? []).map((a) => a.id);
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
        <ScholarshipDashboard
          applications={applications ?? []}
          existingScholarships={existingScholarships}
        />
      </div>
    </main>
  );
}
