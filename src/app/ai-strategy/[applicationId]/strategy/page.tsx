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
 *  - This application's AI analysis (Personal Report + Matching Report)
 *    hasn't run yet → render the marketing page below, whatever the actual
 *    next step is (reflections, or straight to the analysis gate if
 *    reflections are already done). CTA links to that real next step.
 *  - Everything done → skip this page entirely and go to the Dashboard,
 *    matching 1.3's "route them directly to the Dashboard" literally
 *    (not "show Strategy Home again, which then links to the Dashboard").
 *
 * ─── WHY "aiAnalysisComplete", NOT "personalSummaryComplete" ─────────────────
 *
 * `personalSummaryComplete`/`achievementsComplete` are shared across every
 * Strategy the student has (`student_profiles`, not per-application) — a
 * returning student who already did reflections for an EARLIER application
 * has both flags true from the moment they open a brand new one. The
 * previous check (`nextOnboardingStep(state) === 'personal-summary'`) only
 * showed this page to a student with NEITHER flag set, so a returning
 * student skipped this explainer entirely and was redirected straight into
 * `/strategy/analysis`, which fires a real AI generation call on load with
 * no explanation of what was about to happen — reported live 2026-08-08, see
 * `docs/known-issues.md §5f`. Gating on `aiAnalysisComplete` instead means
 * every application gets its own Overview before anything analysis-related
 * runs for it, regardless of what the student's other applications have
 * already done.
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
  const showOverview = !state.aiAnalysisComplete;

  if (!showOverview) {
    redirect(onboardingStepHref(step, applicationId));
  }

  return (
    <StrategyHome
      courseName={application?.course_name ?? 'Your course'}
      universityName={application?.university_name ?? 'Your university'}
      startHref={onboardingStepHref(step, applicationId)}
    />
  );
}
