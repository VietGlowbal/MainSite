import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMentorSummary } from '@/lib/mentor-status';
import { ProfileClient } from './profile-client';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const [
    profileResult,
    documentsResult,
    mentorSummary,
    appsCountResult,
    workCountResult,
    englishCountResult,
  ] = await Promise.all([
    supabase
      .from('student_profiles')
      .select('phone, date_of_birth, location, nationality, bio, study_level, current_institution, current_qualification, predicted_grades, academic_background, preferred_countries, target_subjects, budget_range, study_mode_preference, target_intake, achievements, skills, goals, career_interests, application_cycle_year, plus_status, plus_plan')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('uploaded_documents')
      .select('id, type, file_name, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    getMentorSummary(),
    supabase.from('course_applications').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    /*
     * Work experience and English scores live in their own tables, not on
     * student_profiles. The page used to fetch neither, so both section cards
     * hard-returned 0% — they read "Get started" to a student who had already
     * filled them in, and they dragged the overall strength figure down with
     * them. Two head-only counts is what it takes to stop the page lying about
     * its own data; the editors themselves are unchanged.
     */
    supabase.from('work_experiences').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('english_test_scores').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);

  const profile = profileResult.data;
  const documents = documentsResult.data ?? [];
  const activeApplications = appsCountResult.count ?? 0;

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split('@')[0] ||
    'Student';
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  const memberSince = new Date(user.created_at).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="min-h-screen bg-transparent px-gb-xl py-gb-3xl md:px-gb-4xl md:py-gb-5xl">
      <ProfileClient
        displayName={displayName}
        email={user.email ?? ''}
        avatarUrl={avatarUrl}
        memberSince={memberSince}
        profile={profile}
        documents={documents}
        activeApplications={activeApplications}
        workEntries={workCountResult.count ?? 0}
        englishScores={englishCountResult.count ?? 0}
        isMentor={!!mentorSummary}
        plusStatus={!!profile?.plus_status}
        plusPlan={profile?.plus_plan ?? null}
      />
    </main>
  );
}
