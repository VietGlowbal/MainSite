import { redirect } from 'next/navigation';
import { fetchOnboardingState } from '@/features/ai-strategy-dashboard/api';
import { nextOnboardingStep, onboardingStepHref } from '@/features/ai-strategy-dashboard/domain';
import { AnalysisWorkspace } from '@/features/ai-strategy-dashboard/ui';
import { createClient } from '@/lib/supabase/server';

/**
 * `/ai-strategy/[applicationId]/strategy/analysis` — Stage 3, AI Analysis
 * (requirements.md Requirements 5-7).
 *
 * Ownership already enforced by the layout above this route. Guards against
 * a direct visit before Personal Summary/Achievements are done — without
 * this, a linked-to or bookmarked analysis URL could run (and pay for) an
 * AI call against an empty profile.
 */
export default async function StrategyAnalysisPage({
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
  if (step === 'personal-summary' || step === 'achievements') {
    redirect(onboardingStepHref(step, applicationId));
  }

  // Generates whichever of the two analyses is missing, then hands off to
  // `analysis/portrait`. The reports themselves are server-rendered pages —
  // see analysis-workspace.tsx on why generation stays in one place.
  return <AnalysisWorkspace applicationId={applicationId} />;
}
