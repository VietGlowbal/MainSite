import { notFound, redirect } from 'next/navigation';
import { CvBuilderWorkspace } from '@/components/cv/CvBuilderWorkspace';
import {
  isCvBuilderEnabled,
  loadCvBuilderContext,
} from '@/lib/ai/cv-builder-context';
import { createClient } from '@/lib/supabase/server';

export default async function CvBuilderPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  if (!isCvBuilderEnabled()) redirect(`/apply/${applicationId}/cv-review`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    />
  );
}
