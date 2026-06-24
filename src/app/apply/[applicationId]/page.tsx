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

  // Plus gating for the match-insights improvement features.
  const { data: profile } = await supabase
    .from('student_profiles')
    .select('plus_status')
    .eq('user_id', user.id)
    .maybeSingle();
  const isPlus = Boolean(profile?.plus_status);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8 md:py-8">
      <div className="w-full">
        <ApplicationWorkspaceV2 workspace={workspace} isPlus={isPlus} />
      </div>
    </main>
  );
}
