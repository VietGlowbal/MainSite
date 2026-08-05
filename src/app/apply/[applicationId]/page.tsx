import { notFound, redirect } from 'next/navigation';
import { ApplicationNav } from '@/components/application-nav';
import { createClient } from '@/lib/supabase/server';
import { fetchApplicationWorkspace } from '@/lib/api/application-workspace';
import { ApplicationWorkspaceV2 } from './application-workspace-v2';

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

  const workspacePromise = fetchApplicationWorkspace(applicationId, user.id);
  const profilePromise = supabase
    .from('student_profiles')
    .select('plus_status, academic_background, grades_summary')
    .eq('user_id', user.id)
    .maybeSingle();
  const documentsPromise = supabase
    .from('uploaded_documents')
    .select('type')
    .eq('user_id', user.id);

  const [workspace, { data: profile }, { data: docs }] = await Promise.all([
    workspacePromise,
    profilePromise,
    documentsPromise,
  ]);

  if (!workspace) notFound();

  // Plus gating + which inputs the user already has, so the match-insights panel
  // can guide them to upload what's missing instead of scoring an empty 0%.
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
      logoUrl={workspace.application.logoUrl ?? null}
      userName={userName}
      userAvatarUrl={userAvatarUrl}
      nav={
        <ApplicationNav
          applicationId={applicationId}
          courseName={workspace.application.courseName}
        />
      }
    />
  );
}
