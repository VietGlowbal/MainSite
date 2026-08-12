import { redirect } from 'next/navigation';
import { fetchOnboardingState } from '@/features/ai-strategy-dashboard/api';
import { nextOnboardingStep, onboardingStepHref } from '@/features/ai-strategy-dashboard/domain';
import { StrategyRecommendationWorkspace } from '@/features/ai-strategy-dashboard/ui';
import { createClient } from '@/lib/supabase/server';

/**
 * `/ai-strategy/[applicationId]/strategy/analysis/recommendation` — F7
 * Personalized Strategy, the fourth stage in the onboarding pipeline.
 *
 * Unlike `analysis/portrait` and `analysis/fit` (pure derived reshapes, no
 * model call, generation gated one page earlier on `../analysis`), F7 is its
 * own real model call and has nowhere earlier to be generated — so this page
 * both gates the generation AND renders the result, via
 * `StrategyRecommendationWorkspace`. See that component's header comment.
 *
 * Redirects back into onboarding for any step before `strategy`: F7 needs the
 * Personal Report and Matching Report (`analysis`) already generated, and the
 * intro seen, before it can run.
 */
export default async function StrategyRecommendationPage({
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
  if (
    step === 'personal-summary' ||
    step === 'achievements' ||
    step === 'analysis' ||
    step === 'intro'
  ) {
    redirect(onboardingStepHref(step, applicationId));
  }

  return <StrategyRecommendationWorkspace applicationId={applicationId} />;
}
