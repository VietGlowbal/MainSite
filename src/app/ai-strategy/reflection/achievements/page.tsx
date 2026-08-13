import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadCandidateReflection } from '@/features/apply/api';
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
 * Once confirmed (Review & Confirm), this page stops rendering the editable
 * form — see `ConfirmedAchievementsView`, which also folds in the read-only
 * document list rather than being a route of its own.
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

  const { reflection, documents, confirmedAt } = await loadCandidateReflection(supabase, user.id);

  return (
    <ReflectionChrome user={user} nav={<ApplicationNavFromReturn returnTo={returnTo} />}>
      {confirmedAt ? (
        <ConfirmedAchievementsView
          achievements={reflection.achievements}
          activities={reflection.activities}
          documents={documents}
          confirmedAt={confirmedAt}
          returnTo={returnTo}
        />
      ) : (
        <ReflectionEvidenceForm
          initialAchievements={reflection.achievements}
          initialActivities={reflection.activities}
          initialDocuments={documents}
        />
      )}
    </ReflectionChrome>
  );
}
