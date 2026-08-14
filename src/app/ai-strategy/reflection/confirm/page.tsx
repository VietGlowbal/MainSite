import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadCandidateReflection, verifiedApplicationId } from '@/features/apply/api';
import { candidateReadiness } from '@/features/apply/domain';
import { fetchOnboardingState } from '@/features/ai-strategy-dashboard/api';
import { confirmedReflectionContinueHref } from '@/features/ai-strategy-dashboard/domain';
import { applicationIdFromPath } from '@/shared/lib';
import { ReflectionChrome } from '../../reflection-chrome';
import { ApplicationNavFromReturn } from '../application-nav-from-return';
import { ReviewConfirmView } from './review-confirm-view';

/**
 * Review & Confirm — the checkpoint between finishing Candidate Information
 * and generating reports.
 *
 * Once THIS APPLICATION is confirmed, this renders the same summary in a
 * read-only mode instead of bouncing away — it is also where the
 * "Reflections" nav entry (`applicationSubNav`) sends a student back once
 * reports exist. It used to redirect unconditionally to `returnTo`, which
 * meant the one place the nav wanted to link to could never actually be
 * viewed — reported live 2026-08-14 as a broken "Continue" button and a
 * missing Reflections tab, both downstream of this page being unreachable
 * once confirmed. `applicationId` is derived the same way
 * `reflection/page.tsx` does — see its own doc comment for why, and
 * `docs/known-issues.md` for the incident this fixed: without it, a student
 * confirming a SECOND application would have this page think it was already
 * confirmed (from the first) and bounce them straight past it.
 */
export default async function ReviewConfirmPage({
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

  const { reflection, documents, confirmedAt } = await loadCandidateReflection(
    supabase,
    user.id,
    applicationId,
  );

  const readiness = candidateReadiness(reflection);

  const continueHref = confirmedAt
    ? applicationId
      ? confirmedReflectionContinueHref(
          applicationId,
          (await fetchOnboardingState(supabase, user.id, applicationId)).aiAnalysisComplete,
        )
      : returnTo || '/ai-strategy/report'
    : undefined;

  return (
    <ReflectionChrome user={user} nav={<ApplicationNavFromReturn returnTo={returnTo} />}>
      <ReviewConfirmView
        reflection={reflection}
        documents={documents}
        readiness={readiness}
        returnTo={returnTo}
        applicationId={applicationId}
        readOnly={Boolean(confirmedAt)}
        confirmedAt={confirmedAt ?? undefined}
        continueHref={continueHref}
      />
    </ReflectionChrome>
  );
}
