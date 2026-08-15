import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadApplicationSummary, loadCandidateReflection, verifiedApplicationId } from '@/features/apply/api';
import { fetchOnboardingState } from '@/features/ai-strategy-dashboard/api';
import { candidateInformationStepperSteps, confirmedReflectionContinueHref } from '@/features/ai-strategy-dashboard/domain';
import { applicationIdFromPath } from '@/shared/lib';
import { Stepper } from '@/shared/ui';
import { ReflectionChrome } from '../../reflection-chrome';
import { ApplicationNavFromReturn } from '../application-nav-from-return';
import { ReflectionEvidenceForm } from './reflection-evidence-form';
import { ConfirmedAchievementsView } from './confirmed-achievements-view';

/**
 * Reflection step 2 of 2 — achievements, activities, and supporting
 * documents.
 *
 * Reads back whatever the student saved last time so the form is editable
 * rather than append-only; the API replaces the set wholesale on save, which
 * is only safe because the form always posts the complete list.
 *
 * Once THIS APPLICATION has been confirmed (Review & Confirm), this page
 * stops rendering the editable form — see `ConfirmedAchievementsView`, which
 * also folds in the read-only document list rather than being a route of its
 * own. `applicationId` is derived the same way `reflection/page.tsx` does —
 * see its own doc comment for why, and `docs/known-issues.md` for the
 * incident this fixed.
 */
export default async function ReflectionAchievementsPage({
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

  const [{ reflection, documents, confirmedAt }, onboardingState, applicationSummary] = await Promise.all([
    loadCandidateReflection(supabase, user.id, applicationId),
    applicationId ? fetchOnboardingState(supabase, user.id, applicationId) : Promise.resolve(undefined),
    applicationId ? loadApplicationSummary(supabase, user.id, applicationId) : Promise.resolve(null),
  ]);

  const continueHref = confirmedAt
    ? applicationId && onboardingState
      ? confirmedReflectionContinueHref(applicationId, onboardingState.aiAnalysisComplete)
      : returnTo
    : undefined;

  const stepper =
    applicationId && onboardingState ? (
      <Stepper
        {...candidateInformationStepperSteps(onboardingState, 'achievements', applicationId, returnTo)}
        label="Application setup"
      />
    ) : undefined;

  return (
    <ReflectionChrome user={user} nav={<ApplicationNavFromReturn returnTo={returnTo} />} stepper={stepper}>
      {confirmedAt ? (
        <ConfirmedAchievementsView
          achievements={reflection.achievements}
          activities={reflection.activities}
          documents={documents}
          confirmedAt={confirmedAt}
          continueHref={continueHref}
        />
      ) : (
        <ReflectionEvidenceForm
          applicationId={applicationId}
          applicationLabel={applicationSummary?.label}
          initialAchievements={reflection.achievements}
          initialActivities={reflection.activities}
          initialDocuments={documents}
        />
      )}
    </ReflectionChrome>
  );
}
