import { notFound, redirect } from 'next/navigation';
import { fetchOnboardingState, loadEvaluation } from '@/features/ai-strategy-dashboard/api';
import { nextOnboardingStep, onboardingStepHref } from '@/features/ai-strategy-dashboard/domain';
import { ApplicantPortrait } from '@/features/ai-strategy-dashboard/ui';
import { createClient } from '@/lib/supabase/server';

/**
 * `/ai-strategy/[applicationId]/strategy/analysis/portrait` — the Applicant
 * Portrait, first of the two report pages the analysis splits into.
 *
 * Server-rendered from `loadEvaluation`: six reads and a pure engine run, no
 * model call. Generation happens once, on `../analysis`, which is where a
 * student arrives from onboarding; landing here directly just reads whatever
 * has been stored.
 *
 * Ownership is enforced by the layout above this route, and `loadEvaluation`
 * scopes every read to the signed-in user regardless.
 */
export default async function ApplicantPortraitPage({
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
  /*
   * ⚠️ THIS USED TO redirect('/ai-strategy'), AND THAT WAS A BUG (06/08).
   *
   * `/ai-strategy` is the product explainer — marketing copy about how GlowBal
   * works. A student who clicked "Personal Report" and got bounced onto a
   * help page has been told nothing about their own report and lost the
   * application they were inside; there is no way back to it from there since
   * the "your strategies" list was removed on 02/08.
   *
   * It is also the wrong condition to treat as "no analysis yet".
   * `loadEvaluation` returns null ONLY when `course_applications` has no row
   * for this id and user — a missing narrative still returns a real evaluation
   * (see its header, "A MISSING NARRATIVE IS NOT A MISSING PAGE"). So this
   * branch means the application does not exist or is not this student's,
   * which is precisely what the layout above already answers with notFound().
   * Matching it keeps one answer for one condition.
   */
  if (!evaluation) notFound();

  const studentName =
    (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || 'there';

  return (
    <ApplicantPortrait
      applicationId={applicationId}
      studentName={studentName}
      studentAvatarUrl={(user.user_metadata?.avatar_url as string | undefined) ?? null}
      narrative={evaluation.narrative}
      evidence={evaluation.evidence}
      vagueness={evaluation.vagueness}
      sections={evaluation.portraitSections}
      pendingSectionCount={evaluation.pendingSectionCount}
      confidence={evaluation.confidence}
      generatedAt={evaluation.generatedAt}
      unlockedStages={
        // The planner redirects back to onboarding until the analysis has run,
        // so it is shown but not linked until then — see StageBar.
        step === 'dashboard'
          ? ['reflection', 'portrait', 'fit', 'strategy', 'planner']
          : ['reflection', 'portrait', 'fit', 'strategy']
      }
    />
  );
}
