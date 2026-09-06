import { redirect } from 'next/navigation';
import { fetchOnboardingState, getPlannerMode } from '@/features/ai-strategy-dashboard/api';
import { nextOnboardingStep, onboardingStepHref } from '@/features/ai-strategy-dashboard/domain';
import { StrategyRecommendationWorkspace } from '@/features/ai-strategy-dashboard/ui';
import { getServerIdentity } from '@/server/auth/server-identity';

/** Canonical application-level Strategy Report route. */
export default async function StrategyReportPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const { supabase, identity: user } = await getServerIdentity();
  if (!user) redirect('/auth');

  const state = await fetchOnboardingState(supabase, user.id, applicationId);
  const step = nextOnboardingStep(state);
  if (
    step === 'personal-summary' ||
    step === 'achievements' ||
    step === 'personal-reflection' ||
    step === 'confirm' ||
    step === 'analysis' ||
    step === 'intro'
  ) {
    redirect(onboardingStepHref(step, applicationId));
  }

  const plannerMode = await getPlannerMode(supabase, user.id);
  return <StrategyRecommendationWorkspace applicationId={applicationId} plannerMode={plannerMode} />;
}
