import { redirect } from 'next/navigation';
import { fetchOnboardingState } from '@/features/ai-strategy-dashboard/api';
import { nextOnboardingStep, onboardingStepHref } from '@/features/ai-strategy-dashboard/domain';
import { AnalysisWorkspace } from '@/features/ai-strategy-dashboard/ui';
import { createClient } from '@/lib/supabase/server';

/**
 * `/ai-strategy/[applicationId]/strategy/analysis` — Stage 3, AI Analysis
 * (requirements.md Requirements 5-7).
 *
 * Ownership already enforced by the layout above this route. Guards against
 * a direct visit before Personal Summary/Achievements are done — without
 * this, a linked-to or bookmarked analysis URL could run (and pay for) an
 * AI call against an empty profile.
 */
/**
 * `confirmed_at` might not exist yet on a deployment where
 * `supabase-candidate-confirmation.sql` hasn't run — this page must not 500
 * over a purely cosmetic "confirmed on {date}" line, so the read degrades to
 * "unknown" rather than failing.
 */
async function loadConfirmedAt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('student_profiles')
    .select('confirmed_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return (data as { confirmed_at?: string | null } | null)?.confirmed_at ?? null;
}

export default async function StrategyAnalysisPage({
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

  const [confirmedAt, { data: application }] = await Promise.all([
    loadConfirmedAt(supabase, user.id),
    supabase
      .from('course_applications')
      .select('course_name, university_name')
      .eq('id', applicationId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const matchingSubtitle =
    application?.university_name && application?.course_name
      ? `${application.university_name} — ${application.course_name}`
      : undefined;

  // Generates whichever of the two analyses is missing, then hands off to
  // `analysis/portrait`. The reports themselves are server-rendered pages —
  // see analysis-workspace.tsx on why generation stays in one place.
  return (
    <AnalysisWorkspace
      applicationId={applicationId}
      confirmedAt={confirmedAt}
      matchingSubtitle={matchingSubtitle}
    />
  );
}
