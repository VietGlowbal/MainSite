import { notFound, redirect } from 'next/navigation';
import { CvBuilderWorkspace } from '@/components/cv/CvBuilderWorkspace';
import { parseCvPublicTemplate } from '@/lib/ai/cv-builder';
import {
  isCvBuilderEnabled,
  loadCvBuilderContext,
} from '@/lib/ai/cv-builder-context';
import { getServerIdentity } from '@/server/auth/server-identity';

export default async function CvBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ template?: string | string[] }>;
}) {
  const { applicationId } = await params;
  const template = parseCvPublicTemplate((await searchParams).template);
  if (!isCvBuilderEnabled() || !template) redirect(`/apply/${applicationId}/cv`);

  const { identity: user } = await getServerIdentity();
  if (!user) redirect('/auth');
  const context = await loadCvBuilderContext(applicationId, user);
  if (!context) notFound();

  return (
    <CvBuilderWorkspace
      applicationId={applicationId}
      userId={user.id}
      universityName={context.universityName}
      programmeName={context.programmeName}
      prefill={context.prefill}
      initialTemplate={template}
    />
  );
}
