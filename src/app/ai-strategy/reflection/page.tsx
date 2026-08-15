import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadCandidateReflection, loadProfileReview, verifiedApplicationId } from '@/features/apply/api';
import { fetchOnboardingState } from '@/features/ai-strategy-dashboard/api';
import { confirmedReflectionContinueHref } from '@/features/ai-strategy-dashboard/domain';
import { applicationIdFromPath } from '@/shared/lib';
import { ReflectionChrome } from '../reflection-chrome';
import { ApplicationNavFromReturn } from './application-nav-from-return';
import { ProfileReviewView } from './profile-review-view';
import { ConfirmedReflectionView } from './confirmed-reflection-view';

/**
 * Step 1 of the application setup flow — "Review Existing Profile".
 *
 * Used to render a twelve-question "about" wizard that re-asked facts
 * onboarding already collected (study level, subjects, countries, GPA,
 * IELTS, budget). It now shows a read-only summary of the canonical data
 * (`loadProfileReview` — `student_profiles` + `english_test_scores` +
 * `standardized_test_scores`) with Edit actions out to the `/profile/*` page
 * that owns each fact, and a single "Yes, this information is correct" CTA.
 * `ReflectionAboutForm`/`ABOUT_QUESTIONS` still exist for the confirmed
 * read-only view below (which renders whatever was true at confirm time,
 * including the older aspirational fields — career goal, funding source —
 * that have no `/profile/*` home yet) and for backwards compatibility with
 * data shaped by the old flow.
 *
 * Once THIS APPLICATION has been confirmed (Review & Confirm), this page
 * stops rendering the editable summary — a confirmed record is locked, and
 * editing a canonical field here would let a student change fields the
 * PATCH route will now reject anyway. See `ConfirmedReflectionView`.
 *
 * ─── PER-APPLICATION, DERIVED FROM `return` ──────────────────────────────────
 *
 * `applicationId` comes from `applicationIdFromPath(returnTo)` — the same
 * untrusted-until-verified extraction `ApplicationNavFromReturn` already
 * does for this exact page, re-checked against `course_applications` via
 * `verifiedApplicationId`. Without an application id (the legacy, non-
 * application-scoped entry points), `confirmedAt` below falls back to the
 * student's global `student_profiles.confirmed_at`, unchanged from before
 * candidate-information review became per-application — see
 * `docs/known-issues.md` for the incident that made this necessary: a
 * student who had confirmed on an earlier application would otherwise see
 * this page as already-confirmed for a brand-new one too.
 */
export default async function ReflectionAboutPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const { return: returnTo } = await searchParams;
  const applicationId = returnTo
    ? await verifiedApplicationId(supabase, user.id, applicationIdFromPath(returnTo) ?? undefined)
    : undefined;

  const { reflection: initial, confirmedAt } = await loadCandidateReflection(
    supabase,
    user.id,
    applicationId,
  );

  const continueHref = confirmedAt
    ? applicationId
      ? confirmedReflectionContinueHref(
          applicationId,
          (await fetchOnboardingState(supabase, user.id, applicationId)).aiAnalysisComplete,
        )
      : returnTo
    : undefined;

  return (
    <ReflectionChrome user={user} nav={<ApplicationNavFromReturn returnTo={returnTo} />}>
      {confirmedAt ? (
        <ConfirmedReflectionView values={initial} confirmedAt={confirmedAt} continueHref={continueHref} />
      ) : (
        <ProfileReviewView
          data={await loadProfileReview(supabase, user.id)}
          applicationId={applicationId}
          returnTo={returnTo}
        />
      )}
    </ReflectionChrome>
  );
}
