import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  getOrCreateStrategy,
  getStructuredCv,
  getTargetProfile,
} from '@/features/application-strategy/api';
import { isExportOutdated, recommendLayout } from '@/features/application-strategy/domain';
import { CvLayoutWorkspace } from '@/features/application-strategy/ui';

export const metadata: Metadata = {
  title: 'Layout and PDF | GlowBal',
  description: 'Choose how your CV is presented and export it.',
};

/**
 * CV step 4 — /ai-strategy/[applicationId]/cv/layout
 *
 * The recommendation is computed here, server-side and deterministically, from the
 * target profile and where the CV's evidence sits. The client receives the choice
 * and the sentence explaining it; it does not recompute either, so what the student
 * reads cannot drift from what was decided.
 */
export default async function CvLayoutPage({
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

  const candidateName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split('@')[0] ||
    null;

  return (
    <CvLayoutWorkspace
      applicationId={applicationId}
      cv={cv}
      recommendation={recommendLayout(targetProfile, cv)}
      exportOutdated={cv ? isExportOutdated(cv) : false}
      candidateName={candidateName}
    />
  );
}
