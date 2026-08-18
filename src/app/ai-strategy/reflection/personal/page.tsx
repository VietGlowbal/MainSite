import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadApplicationSummary, loadCandidateReflection, verifiedApplicationId } from '@/features/apply/api';
import { fetchOnboardingState } from '@/features/ai-strategy-dashboard/api';
import { candidateInformationStepperSteps, confirmedReflectionContinueHref } from '@/features/ai-strategy-dashboard/domain';
import { applicationIdFromPath } from '@/shared/lib';
import { Stepper } from '@/shared/ui';
import { ReflectionChrome } from '../../reflection-chrome';
import { ApplicationNavFromReturn } from '../application-nav-from-return';
import { ConfirmedPersonalReflectionView } from './confirmed-personal-reflection-view';
import { PersonalReflectionForm } from './personal-reflection-form';

/**
 * Step 3 — Personal Reflection. Inserted between Activities & Achievements
 * and Review & Confirm (`onboarding.ts`'s `personal-reflection` step).
 *
 * Distinct from Activity Reflection: this asks about patterns ACROSS
 * experiences ("what genuinely drives you"), not about any one activity —
 * see `src/features/apply/domain/personal-reflection.ts` for why the two are
 * kept as separate flows rather than merged.
 *
 * Same per-application-confirmed gate as the other candidate-information
 * pages — see `reflection/page.tsx`'s doc comment for why `applicationId` is
 * derived from `return` and re-verified rather than trusted.
 */
export default async function PersonalReflectionPage({
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

  const [{ reflection, confirmedAt }, onboardingState, applicationSummary] = await Promise.all([
    loadCandidateReflection(supabase, user.id, applicationId),
    applicationId ? fetchOnboardingState(supabase, user.id, applicationId) : Promise.resolve(undefined),
    applicationId ? loadApplicationSummary(supabase, user.id, applicationId) : Promise.resolve(null),
  ]);

  const stepper =
    applicationId && onboardingState ? (
      <Stepper
        {...candidateInformationStepperSteps(onboardingState, 'personal-reflection', applicationId, returnTo)}
        label="Application setup"
      />
    ) : undefined;

  return (
    <ReflectionChrome user={user} nav={<ApplicationNavFromReturn returnTo={returnTo} />} stepper={stepper}>
      {confirmedAt ? (
        <ConfirmedPersonalReflectionView
          answers={reflection.personalReflection}
          confirmedAt={confirmedAt}
          continueHref={
            applicationId && onboardingState
              ? confirmedReflectionContinueHref(applicationId, onboardingState.aiAnalysisComplete)
              : returnTo
          }
        />
      ) : (
        <PersonalReflectionForm
          applicationId={applicationId}
          returnTo={returnTo}
          initial={reflection.personalReflection ?? {}}
          applicationLabel={applicationSummary?.label}
        />
      )}
    </ReflectionChrome>
  );
}
