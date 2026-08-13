import { redirect } from 'next/navigation';
import { fetchOnboardingState } from '@/features/ai-strategy-dashboard/api';
import { onboardingStepHref } from '@/features/ai-strategy-dashboard/domain';
import { StrategyHome } from '@/features/ai-strategy-dashboard/ui';
import { createClient } from '@/lib/supabase/server';

/**
 * `/ai-strategy/[applicationId]/strategy` — Stage 1, Strategy Home
 * (requirements.md Requirement 2), and the front door for every application.
 *
 * Ownership of `applicationId` is already enforced by the layout above this
 * page. `fetchOnboardingState` decides what happens next:
 *  - This application's AI analysis (Personal Report + Matching Report)
 *    hasn't run yet → render the marketing page below. Its CTA always opens
 *    the reflection flow, never skips ahead — see the note below.
 *  - It has → the Matching Report is home. See the note below.
 *
 * ─── THE MATCHING REPORT IS HOME, NOT A STEP IN A FUNNEL ─────────────────────
 *
 * Changed 12/08, per explicit product direction. Before this, once the
 * analysis existed this page kept computing `nextOnboardingStep` and bouncing
 * a student onward through intro → strategy → dashboard — so where "Overview"
 * landed depended on how far the application had gotten, never a stable
 * place. Now, once the analysis exists, `/strategy/analysis/fit` IS home,
 * always, for every application, regardless of how far the student has since
 * gone. Personalized Strategy and the Planner are reached deliberately
 * through the nav bar (`applicationSubNav()`/`SubNav`), which is also the
 * only thing that gates them now — this page no longer decides.
 *
 * ─── WHY "aiAnalysisComplete", NOT "personalSummaryComplete" ─────────────────
 *
 * `personalSummaryComplete`/`achievementsComplete` are shared across every
 * Strategy the student has (`student_profiles`, not per-application) — a
 * returning student who already did reflections for an EARLIER application
 * has both flags true from the moment they open a brand new one. The
 * original check (`nextOnboardingStep(state) === 'personal-summary'`) only
 * showed this page to a student with NEITHER flag set, so a returning
 * student skipped this explainer entirely and was redirected straight into
 * `/strategy/analysis`, which fires a real AI generation call on load with
 * no explanation of what was about to happen — reported live 2026-08-08, see
 * `docs/known-issues.md §5f`. Gating on `aiAnalysisComplete` instead means
 * every application gets its own Overview before anything analysis-related
 * runs for it, regardless of what the student's other applications have
 * already done.
 *
 * ─── WHY THE CTA ALWAYS TARGETS "personal-summary", NOT `step` ───────────────
 *
 * The obvious-looking alternative — link to `onboardingStepHref(step, id)`,
 * whatever the real next step is — was tried and reported broken the same
 * day: for that same returning student, `step` resolves straight to
 * `'analysis'` (their reflections already being globally complete), so the
 * CTA fired the AI generation call the moment they clicked "Start My
 * Strategy," with no chance to review or update their reflections for THIS
 * application first. The reflection pages read back and PRE-FILL existing
 * answers (`reflectionFromProfile`, the achievements page's own select), so
 * routing through them is a "confirm/edit," not a "redo from scratch" —
 * always sending the CTA there is what "ask for reflections, confirm
 * achievements, then generate" actually requires.
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

  if (state.aiAnalysisComplete) {
    redirect(`/ai-strategy/${applicationId}/strategy/analysis/fit`);
  }

  return (
    <StrategyHome
      courseName={application?.course_name ?? 'Your course'}
      universityName={application?.university_name ?? 'Your university'}
      startHref={onboardingStepHref('personal-summary', applicationId)}
    />
  );
}
