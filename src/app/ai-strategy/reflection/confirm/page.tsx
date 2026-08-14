import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadCandidateReflection, verifiedApplicationId } from '@/features/apply/api';
import { candidateReadiness } from '@/features/apply/domain';
import { applicationIdFromPath } from '@/shared/lib';
import { ReflectionChrome } from '../../reflection-chrome';
import { ApplicationNavFromReturn } from '../application-nav-from-return';
import { ReviewConfirmView } from './review-confirm-view';

/**
 * Review & Confirm — the checkpoint between finishing Candidate Information
 * and generating reports.
 *
 * Once THIS APPLICATION is confirmed, there is nothing left to review here:
 * the student is sent straight on to `returnTo` (normally the analysis
 * gate), the same "confirmed means done with this screen" rule the two
 * read-only reflection views apply to themselves. `applicationId` is derived
 * the same way `reflection/page.tsx` does — see its own doc comment for why,
 * and `docs/known-issues.md` for the incident this fixed: without it, a
 * student confirming a SECOND application would have this page think it was
 * already confirmed (from the first) and bounce them straight past it.
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

  if (confirmedAt) redirect(returnTo || '/ai-strategy/report');

  const readiness = candidateReadiness(reflection);

  return (
    <ReflectionChrome user={user} nav={<ApplicationNavFromReturn returnTo={returnTo} />}>
      <ReviewConfirmView
        reflection={reflection}
        documents={documents}
        readiness={readiness}
        returnTo={returnTo}
        applicationId={applicationId}
      />
    </ReflectionChrome>
  );
}
