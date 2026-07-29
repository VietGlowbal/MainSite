import { notFound, redirect } from 'next/navigation';
import { StatementFeedbackWorkspace } from '@/components/statement/StatementFeedbackWorkspace';
import { fetchApplicationWorkspace } from '@/lib/api/application-workspace';
import { createClient } from '@/lib/supabase/server';
import { VINUNI_DEMO_APPLICATION_ID } from '@/lib/ai/vinuni-evaluation-shared';

export default async function StatementFeedbackPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  if (applicationId === VINUNI_DEMO_APPLICATION_ID) {
    if (process.env.NODE_ENV !== 'development') notFound();
    return (
      <StatementFeedbackWorkspace
        applicationId={VINUNI_DEMO_APPLICATION_ID}
        targetName="Bachelor of Computer Science · VinUniversity"
        contextNote="VinUniversity AACC · Demo essay-only · Profile chưa có"
        demo
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const workspace = await fetchApplicationWorkspace(applicationId, user.id);
  if (!workspace) notFound();

  const { application } = workspace;
  return (
    <StatementFeedbackWorkspace
      applicationId={application.id}
      targetName={`${application.courseName} · ${application.universityName}`}
      contextNote={workspace.course?.entryRequirementsSummary ?? application.aiSummary}
    />
  );
}
