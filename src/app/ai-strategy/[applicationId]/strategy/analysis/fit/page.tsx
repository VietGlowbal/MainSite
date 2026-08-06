import { notFound, redirect } from 'next/navigation';
import { fetchOnboardingState, loadEvaluation } from '@/features/ai-strategy-dashboard/api';
import { nextOnboardingStep, onboardingStepHref } from '@/features/ai-strategy-dashboard/domain';
import { ProgrammeFitReport } from '@/features/ai-strategy-dashboard/ui';
import { createClient } from '@/lib/supabase/server';

/**
 * `/ai-strategy/[applicationId]/strategy/analysis/fit` — the Programme Fit
 * report, second of the two pages the analysis splits into.
 *
 * Same shape as the portrait route: server-rendered from the pure engine, no
 * model call on this path. See `../portrait/page.tsx`.
 */
export default async function ProgrammeFitPage({
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

  const evaluation = await loadEvaluation(supabase, user.id, applicationId);
  // Was redirect('/ai-strategy'), which threw a student out of their own
  // Matching Report and onto the marketing explainer. Same reasoning as the
  // portrait route — see the note there.
  if (!evaluation) notFound();

  return (
    <ProgrammeFitReport
      applicationId={applicationId}
      fit={evaluation.programmeFit}
      unlockedStages={
        step === 'dashboard'
          ? ['reflection', 'portrait', 'fit', 'strategy', 'planner']
          : ['reflection', 'portrait', 'fit', 'strategy']
      }
    />
  );
}
