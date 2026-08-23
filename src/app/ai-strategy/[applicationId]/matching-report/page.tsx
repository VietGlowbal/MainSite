import { notFound, redirect } from 'next/navigation';
import { getMatchingReportPageData } from '@/features/apply/api';
import { MatchingReportView } from '@/features/apply/ui';
import { fetchOnboardingState } from '@/features/ai-strategy-dashboard/api';
import { nextOnboardingStep, onboardingStepHref } from '@/features/ai-strategy-dashboard/domain';
import { createClient } from '@/lib/supabase/server';

/**
 * Canonical application-level Matching Report route.
 *
 * ─── WHY THIS SWITCHED COMPONENTS ────────────────────────────────────────────
 *
 * This route used to render `ProgrammeFitReport` (the dashboard feature's
 * six-tab view of catalogue facts), while `MatchingReportView` — the component
 * actually built on the F5 `ProgrammeFit` contract, with the five scored
 * dimensions and the eligibility gates — was exported and rendered by nothing.
 * The report that answered "how well do I match" was unreachable; the one on
 * the canonical URL answered "what does this course cost".
 *
 * `docs/ai-strategy-route-audit.md` recorded the canonical route as sitting
 * "over current Programme Fit implementation" pending the F5 rebuild. F5 is now
 * implemented (`src/shared/evaluation/f5-programme-fit.ts`), so the route points
 * at the report that consumes it. The URL is unchanged.
 *
 * `ProgrammeFitReport` is left in place: it is still reachable from the older
 * `/strategy/analysis/*` surfaces and removing it is a separate cleanup.
 */
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

  // Ownership is enforced inside the repository (`user_id` is part of the
  // query), so a missing row here is either "not yours" or "does not exist" —
  // both correctly a 404 rather than a 403 that would confirm the id exists.
  const { data, migrationMissing } = await getMatchingReportPageData(
    supabase,
    user.id,
    applicationId,
  );
  if (!data) notFound();

  return <MatchingReportView data={data} migrationMissing={migrationMissing} />;
}
