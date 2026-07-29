import { notFound, redirect } from 'next/navigation';
import { CvReviewWorkspace } from '@/components/cv/CvReviewWorkspace';
import { fetchApplicationWorkspace } from '@/lib/api/application-workspace';
import { createClient } from '@/lib/supabase/server';

export default async function CvReviewPage({
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

  const { application } = workspace;
  return (
    <CvReviewWorkspace
      applicationId={application.id}
      targetName={`${application.courseName} · ${application.universityName}`}
      contextNote={workspace.course?.entryRequirementsSummary ?? application.aiSummary}
    />
  );
}
