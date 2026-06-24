import { notFound, redirect } from 'next/navigation';
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

  const workspace = await fetchApplicationWorkspace(applicationId, user.id);

  if (!workspace) notFound();

  // Plus gating + which inputs the user already has, so the match-insights panel
  // can guide them to upload what's missing instead of scoring an empty 0%.
  const [{ data: profile }, { data: docs }] = await Promise.all([
    supabase
      .from('student_profiles')
      .select('plus_status, academic_background, grades_summary')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('uploaded_documents').select('type').eq('user_id', user.id),
  ]);

  const isPlus = Boolean(profile?.plus_status);
  const essayTypes = ['statement_of_purpose', 'personal_statement', 'sop', 'statement'];
  const matchInputs = {
    cv: (docs ?? []).some((d) => d.type === 'cv'),
    essay: (docs ?? []).some((d) => essayTypes.includes(d.type)),
    academic: Boolean(profile?.academic_background || profile?.grades_summary),
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8 md:py-8">
      <div className="w-full">
        <ApplicationWorkspaceV2 workspace={workspace} isPlus={isPlus} matchInputs={matchInputs} />
      </div>
    </main>
  );
}
