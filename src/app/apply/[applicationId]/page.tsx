import { notFound, redirect } from 'next/navigation';
import { getUniversityQueries } from '@/features/universities/api';
import { createClient } from '@/lib/supabase/server';
import { fetchApplicationWorkspace } from '@/lib/api/application-workspace';
import { ApplicationWorkspaceV2 } from './application-workspace-v2';

/**
 * The crest for the workspace banner.
 *
 * Same rule as the applications list: `course_applications` has no logo of its
 * own, only a nullable `university_id`, and most rows are imported straight
 * from a course URL without one. When it misses, `Avatar` renders initials
 * rather than a broken image box.
 */
async function fetchLogo(universityId: number | null | undefined): Promise<string | null> {
  if (universityId == null) return null;
  const [uni] = await getUniversityQueries().getByIds([universityId]);
  return uni?.logo_url ?? null;
}

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const workspace = await fetchApplicationWorkspace(applicationId, user.id);

  if (!workspace) notFound();

  // Plus gating + which inputs the user already has, so the match-insights panel
  // can guide them to upload what's missing instead of scoring an empty 0%.
  const [{ data: profile }, { data: docs }, logoUrl] = await Promise.all([
    supabase
      .from('student_profiles')
      .select('plus_status, academic_background, grades_summary')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('uploaded_documents').select('type').eq('user_id', user.id),
    fetchLogo(workspace.application.universityId),
  ]);

  const isPlus = Boolean(profile?.plus_status);
  const essayTypes = ['statement_of_purpose', 'personal_statement', 'sop', 'statement'];
  const matchInputs = {
    cv: (docs ?? []).some((d) => d.type === 'cv'),
    essay: (docs ?? []).some((d) => essayTypes.includes(d.type)),
    academic: Boolean(profile?.academic_background || profile?.grades_summary),
  };

  return (
    /* NOT `gb-page-full-bleed`: that marker cancels the 240px sidebar gutter in
       globals.css, and is only for pages that ship their own nav (/universities).
       This page sits inside the global sidebar shell, so it keeps the gutter. */
    <main className="min-h-screen bg-surface">
      <ApplicationWorkspaceV2
        workspace={workspace}
        isPlus={isPlus}
        matchInputs={matchInputs}
        logoUrl={logoUrl}
      />
    </main>
  );
}
