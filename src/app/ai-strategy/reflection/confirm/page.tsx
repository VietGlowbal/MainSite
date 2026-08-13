import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadCandidateReflection } from '@/features/apply/api';
import { candidateReadiness } from '@/features/apply/domain';
import { ReflectionChrome } from '../../reflection-chrome';
import { ApplicationNavFromReturn } from '../application-nav-from-return';
import { ReviewConfirmView } from './review-confirm-view';

/**
 * Review & Confirm — the checkpoint between finishing Candidate Information
 * and generating reports.
 *
 * Once confirmed, there is nothing left to review here: the student is sent
 * straight on to `returnTo` (normally the analysis gate), the same "confirmed
 * means done with this screen" rule the two read-only reflection views apply
 * to themselves.
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

  const { reflection, documents, confirmedAt } = await loadCandidateReflection(supabase, user.id);

  if (confirmedAt) redirect(returnTo || '/ai-strategy/personal-report');

  const readiness = candidateReadiness(reflection);

  return (
    <ReflectionChrome user={user} nav={<ApplicationNavFromReturn returnTo={returnTo} />}>
      <ReviewConfirmView
        reflection={reflection}
        documents={documents}
        readiness={readiness}
        returnTo={returnTo}
      />
    </ReflectionChrome>
  );
}
