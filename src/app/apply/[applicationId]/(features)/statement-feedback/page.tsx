import { notFound, redirect } from 'next/navigation';
import { StatementFeedbackWorkspace } from '@/components/statement/StatementFeedbackWorkspace';
import { getApplicationDocumentContext } from '@/features/apply/application-document-context';
import { getServerIdentity } from '@/server/auth/server-identity';
import { VINUNI_DEMO_APPLICATION_ID } from '@/lib/ai/vinuni-evaluation-shared';
import { VINUNI_UNIVERSITY_ID } from '@/lib/vinuni-content';

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
        evaluationMode="vinuni"
        demo
      />
    );
  }

  const { identity: user } = await getServerIdentity();
  if (!user) redirect('/auth');

  const context = await getApplicationDocumentContext(applicationId, user.id);
  if (!context) notFound();

  return (
    <StatementFeedbackWorkspace
      applicationId={context.id}
      targetName={`${context.courseName ?? ''} · ${context.universityName ?? ''}`}
      contextNote={context.entryRequirementsSummary ?? context.aiSummary}
      evaluationMode={context.universityId === VINUNI_UNIVERSITY_ID ? 'vinuni' : 'generic'}
    />
  );
}
