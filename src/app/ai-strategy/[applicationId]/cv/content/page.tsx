import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getServerIdentity } from '@/server/auth/server-identity';
import {
  getOrCreateStrategy,
  getStructuredCv,
  getTargetProfile,
} from '@/features/application-strategy/api';
import { CvContentWorkspace } from '@/features/application-strategy/ui';

export const metadata: Metadata = {
  title: 'CV content | GlowBal',
  description: 'Build and edit the structured content of your CV.',
};

/**
 * CV step 2 — /ai-strategy/[applicationId]/cv/content
 *
 * The already-uploaded CV list is resolved here rather than fetched by the client
 * so the editor renders with its import option already correct. A student who has
 * a CV on file should see "import from it" as the recommended path on first paint,
 * not after a round trip.
 */
export default async function CvContentPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  const { supabase, identity: user } = await getServerIdentity();
  if (!user) redirect('/auth');

  const { data: application } = await supabase
    .from('course_applications')
    .select('id')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!application) notFound();

  const strategy = await getOrCreateStrategy(supabase, user.id, applicationId);

  const [cv, targetProfile, { data: documents }] = await Promise.all([
    getStructuredCv(supabase, strategy.id),
    getTargetProfile(supabase, strategy.id),
    supabase
      .from('uploaded_documents')
      .select('id, file_name, created_at, type')
      .eq('user_id', user.id)
      .eq('type', 'cv')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  return (
    <CvContentWorkspace
      applicationId={applicationId}
      initial={cv}
      hasTargetProfile={targetProfile != null}
      documents={(documents ?? []).map((doc) => ({
        id: doc.id as string,
        fileName: (doc.file_name as string | null) ?? 'CV',
        uploadedAt: formatUploadDate(doc.created_at as string | null),
        sizeLabel: null,
      }))}
    />
  );
}

/** `uploaded_documents` records no byte size, so the size label is omitted rather than guessed. */
function formatUploadDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `Uploaded ${date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
