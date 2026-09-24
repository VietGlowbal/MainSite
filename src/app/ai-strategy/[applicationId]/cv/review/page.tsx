import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getServerIdentity } from '@/server/auth/server-identity';
import {
  getLatestCvReview,
  getOrCreateStrategy,
  getStructuredCv,
  getTargetProfile,
} from '@/features/application-strategy/api';
import { isReviewOutdated } from '@/features/application-strategy/domain';
import { CvReviewWorkspace } from '@/features/application-strategy/ui';

export const metadata: Metadata = {
  title: 'AI Assessment | GlowBal',
  description: 'See whether your CV proves what this programme is looking for.',
};

/**
 * CV step 3 — /ai-strategy/[applicationId]/cv/review
 *
 * Staleness is decided here, on the server, by comparing the versions the stored
 * review recorded against the current CV and target profile. The client is handed
 * the boolean rather than the version numbers: it has no way to compute it wrongly
 * and no reason to know how.
 */
export default async function CvReviewPage({
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
  const [cv, targetProfile] = await Promise.all([
    getStructuredCv(supabase, strategy.id),
    getTargetProfile(supabase, strategy.id),
  ]);

  const review = cv ? await getLatestCvReview(supabase, cv.id) : null;

  return (
    <CvReviewWorkspace
      applicationId={applicationId}
      cv={cv}
      initialReview={review}
      outdated={isReviewOutdated(review, cv, targetProfile)}
      hasTargetProfile={targetProfile != null}
    />
  );
}
