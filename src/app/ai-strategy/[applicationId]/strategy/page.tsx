import { redirect } from 'next/navigation';
import { fetchOnboardingState } from '@/features/ai-strategy-dashboard/api';
import { isOnboardingComplete, nextOnboardingStep, onboardingStepHref } from '@/features/ai-strategy-dashboard/domain';
import { StrategyHome } from '@/features/ai-strategy-dashboard/ui';
import { createClient } from '@/lib/supabase/server';

/**
 * `/ai-strategy/[applicationId]/strategy` — Stage 1, Strategy Home
 * (requirements.md Requirement 2), and the router for the whole onboarding
 * pass.
 *
 * Ownership of `applicationId` is already enforced by the layout above this
 * page. `fetchOnboardingState` + `nextOnboardingStep` decide what happens
 * next, per Requirement 1.2-1.3:
 *  - Nothing done at all → render the marketing page below, CTA starts the
 *    real first step (Personal Summary).
 *  - Some steps done, some not (a returning-but-unfinished student) →
 *    skip straight to the first unfinished step, not back to the marketing
 *    copy — the audit's explicit ask, "handle partially completed
 *    onboarding by returning users to the correct unfinished stage."
 *  - Everything done → skip this page entirely and go to the Dashboard,
 *    matching 1.3's "route them directly to the Dashboard" literally
 *    (not "show Strategy Home again, which then links to the Dashboard").
 */
export default async function StrategyHomePage({
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

  const [{ data: application }, state] = await Promise.all([
    supabase
      .from('course_applications')
      .select('course_name, university_name')
      .eq('id', applicationId)
      .eq('user_id', user.id)
      .maybeSingle(),
    fetchOnboardingState(supabase, user.id, applicationId),
  ]);

  if (isOnboardingComplete(state)) {
    redirect(onboardingStepHref('dashboard', applicationId));
  }

  const step = nextOnboardingStep(state);
  const nothingDoneYet = step === 'personal-summary';

  if (!nothingDoneYet) {
    redirect(onboardingStepHref(step, applicationId));
  }

  return (
    <StrategyHome
      courseName={application?.course_name ?? 'Your course'}
      universityName={application?.university_name ?? 'Your university'}
      startHref={onboardingStepHref('personal-summary', applicationId)}
    />
  );
}
