import { notFound, redirect } from 'next/navigation';
import { CvReviewWorkspace } from '@/components/cv/CvReviewWorkspace';
import { getApplicationDocumentContext } from '@/features/apply/application-document-context';
import { parseCvPublicTemplate } from '@/lib/ai/cv-builder';
import { getServerIdentity } from '@/server/auth/server-identity';

export default async function CvReviewPage({ params, searchParams }: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ template?: string | string[] }>;
}) {
  const { applicationId } = await params;
  const template = parseCvPublicTemplate((await searchParams).template);
  if (!template) redirect(`/apply/${applicationId}/cv`);

  const { identity: user } = await getServerIdentity();
  if (!user) redirect('/auth');
  const context = await getApplicationDocumentContext(applicationId, user.id);
  if (!context) notFound();

  return (
    <CvReviewWorkspace
      applicationId={applicationId}
      targetName={[context.courseName, context.universityName].filter(Boolean).join(' · ')}
      template={template}
    />
  );
}
