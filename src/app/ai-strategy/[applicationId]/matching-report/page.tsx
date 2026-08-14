import { notFound, redirect } from 'next/navigation';
import { fetchOnboardingState, loadEvaluation } from '@/features/ai-strategy-dashboard/api';
import { nextOnboardingStep, onboardingStepHref } from '@/features/ai-strategy-dashboard/domain';
import { ProgrammeFitReport } from '@/features/ai-strategy-dashboard/ui';
import { createClient } from '@/lib/supabase/server';

/** Canonical application-level Matching Report route. */
export default async function MatchingReportPage({
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

  const state = await fetchOnboardingState(supabase, user.id, applicationId);
  const step = nextOnboardingStep(state);
  if (step === 'personal-summary' || step === 'achievements' || step === 'confirm') {
    redirect(onboardingStepHref(step, applicationId));
  }

  const evaluation = await loadEvaluation(supabase, user.id, applicationId);
  if (!evaluation) notFound();

  return <ProgrammeFitReport applicationId={applicationId} fit={evaluation.programmeFit} />;
}
