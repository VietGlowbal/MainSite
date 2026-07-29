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

  const userName =
    (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || null;
  const userAvatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  /* No wrapping <main> here: the workspace ships its own chrome (TopNav,
     MobileNav, Footer) around its own <main>, the same way the applications
     list does. /apply/* is suppressed in nav-reveal.tsx, so there is no app
     sidebar on this page to sit inside. */
  return (
    <ApplicationWorkspaceV2
      workspace={workspace}
      isPlus={isPlus}
      matchInputs={matchInputs}
      logoUrl={logoUrl}
      userName={userName}
      userAvatarUrl={userAvatarUrl}
    />
  );
}
