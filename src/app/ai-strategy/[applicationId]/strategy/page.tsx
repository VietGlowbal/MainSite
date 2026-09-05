import { redirect } from 'next/navigation';
import { fetchOnboardingState } from '@/features/ai-strategy-dashboard/api';
import { nextOnboardingStep, onboardingStepHref } from '@/features/ai-strategy-dashboard/domain';
import { StrategyHome } from '@/features/ai-strategy-dashboard/ui';
import { getServerIdentity } from '@/server/auth/server-identity';

/**
 * `/ai-strategy/[applicationId]/strategy` — Stage 1, Strategy Home
 * (requirements.md Requirement 2), and the front door for every application.
 *
 * Ownership of `applicationId` is already enforced by the layout above this
 * page. `fetchOnboardingState` decides what happens next:
 *  - This application's AI analysis (Personal Report + Matching Report)
 *    hasn't run yet → render the marketing page below. Its CTA opens
 *    whatever onboarding actually has left to do — see the note below.
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
 * ─── WHY THE CTA TARGETS `nextOnboardingStep(state)`, NOT A FIXED STEP ───────
 *
 * This used to always link to `onboardingStepHref('personal-summary', id)`,
 * on the theory that `step` resolving straight to `'analysis'` for a
 * returning student would fire the AI generation call with no chance to
 * review reflections first (see git history for the original note). That
 * reasoning predates the Review & Confirm checkpoint (`'confirm'` step,
 * added after this comment was first written): today `nextOnboardingStep`
 * never skips straight from "reflections done" to `'analysis'` for a
 * student who hasn't confirmed — it stops at `'confirm'`, which shows the
 * full profile for review before anything generates. Once `candidateConfirmed`
 * is true, though — true globally, from ANY earlier application — the two
 * reflection pages render their read-only, confirmed views
 * (`ConfirmedReflectionView`/`ConfirmedAchievementsView`), which have no
 * Next/Continue action at all; they are a "this is what you approved"
 * summary, not a step in a funnel. Hardcoding the CTA to `'personal-summary'`
 * sent a student who had already confirmed on an earlier application
 * straight into that dead end for every NEW application afterward — reported
 * live 2026-08-13. Routing through `nextOnboardingStep(state)` instead means
 * a not-yet-confirmed student still gets routed to reflections → achievements
 * → confirm, in order, exactly as before; a confirmed student instead goes
 * straight to `'analysis'`, which is correct — there is nothing left to
 * review, since the profile it would show them is the exact one they
 * already reviewed and confirmed.
 */
export default async function StrategyHomePage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  const { supabase, identity: user } = await getServerIdentity();

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
      startHref={onboardingStepHref(nextOnboardingStep(state), applicationId)}
    />
  );
}
