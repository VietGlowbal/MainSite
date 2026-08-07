import { notFound, redirect } from 'next/navigation';
import { CvReviewWorkspace } from '@/components/cv/CvReviewWorkspace';
import { getApplicationDocumentContext } from '@/features/apply/application-document-context';
import { getServerIdentity } from '@/server/auth/server-identity';

export default async function CvReviewPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const { identity: user } = await getServerIdentity();
  if (!user) redirect('/auth');

  const context = await getApplicationDocumentContext(applicationId, user.id);
  if (!context) notFound();

  return (
    <CvReviewWorkspace
      applicationId={context.id}
      targetName={`${context.courseName ?? ''} · ${context.universityName ?? ''}`}
      contextNote={context.entryRequirementsSummary ?? context.aiSummary}
    />
  );
}
