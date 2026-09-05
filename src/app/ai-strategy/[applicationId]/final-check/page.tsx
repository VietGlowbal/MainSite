import { notFound, redirect } from 'next/navigation';
import { getFinalCheckPageData } from '@/features/apply/api';
import { FinalCheckView } from '@/features/apply/ui';
import { getServerIdentity } from '@/server/auth/server-identity';

/**
 * Final Application Check — the last surface in the Strategy journey.
 *
 * Unlike the report routes above it, this one deliberately does NOT bounce a
 * student back through onboarding. Someone arriving here has documents to
 * review; sending them to re-confirm their reflections would be a dead end.
 * The view handles the "not enough attached yet" case itself.
 */
export default async function FinalCheckPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const { supabase, identity: user } = await getServerIdentity();
  if (!user) redirect('/auth');

  const { data, migrationMissing } = await getFinalCheckPageData(
    supabase,
    user.id,
    applicationId,
  );
  if (!data) notFound();

  return (
    <FinalCheckView
      applicationId={data.applicationId}
      universityName={data.universityName}
      courseName={data.courseName}
      components={data.components}
      liveReadiness={data.liveReadiness}
      check={data.check}
      migrationMissing={migrationMissing}
    />
  );
}
