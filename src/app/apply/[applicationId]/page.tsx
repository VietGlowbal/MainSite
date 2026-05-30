import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ApplicationWorkspaceView } from './application-workspace';
import { MOCK_WORKSPACE_APP1 } from '@/lib/apply-mock-data';

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

  // Phase 1: use mock data; Phase 2 will load from DB
  const workspace =
    applicationId === 'app_1' ? MOCK_WORKSPACE_APP1 : null;

  if (!workspace) notFound();

  return (
    <main className="min-h-screen bg-transparent px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl">
        <ApplicationWorkspaceView workspace={workspace} />
      </div>
    </main>
  );
}
