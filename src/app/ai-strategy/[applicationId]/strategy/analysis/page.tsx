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
 * This application's own `course_applications.candidate_confirmed_at` — NOT
 * the global `student_profiles.confirmed_at`, which is shared across every
 * application a student has and would show the wrong date (or another
 * application's date) here. Might not exist yet on a deployment where
 * `supabase-per-application-onboarding.sql` hasn't run — this page must not
 * 500 over a purely cosmetic "confirmed on {date}" line, so the read
 * degrades to "unknown" (falls back to a base select with just the two
 * columns this page already needed) rather than failing.
 */
async function loadApplication(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  applicationId: string,
): Promise<{ courseName: string | null; universityName: string | null; confirmedAt: string | null }> {
  const full = await supabase
    .from('course_applications')
    .select('course_name, university_name, candidate_confirmed_at')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!full.error) {
    const row = full.data as
      | { course_name: string | null; university_name: string | null; candidate_confirmed_at: string | null }
      | null;
    return {
      courseName: row?.course_name ?? null,
      universityName: row?.university_name ?? null,
      confirmedAt: row?.candidate_confirmed_at ?? null,
    };
  }

  const base = await supabase
    .from('course_applications')
    .select('course_name, university_name')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  const row = base.data as { course_name: string | null; university_name: string | null } | null;
  return { courseName: row?.course_name ?? null, universityName: row?.university_name ?? null, confirmedAt: null };
}

export default async function StrategyAnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ regenerate?: string }>;
}) {
  const { applicationId } = await params;
  const { regenerate } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const state = await fetchOnboardingState(supabase, user.id, applicationId);
  const step = nextOnboardingStep(state);
  if (
    step === 'personal-summary' ||
    step === 'achievements' ||
    step === 'personal-reflection' ||
    step === 'confirm'
  ) {
    redirect(onboardingStepHref(step, applicationId));
  }

  const { courseName, universityName, confirmedAt } = await loadApplication(
    supabase,
    user.id,
    applicationId,
  );

  const matchingSubtitle =
    universityName && courseName ? `${universityName} — ${courseName}` : undefined;

  // Generates Personal + Matching, then starts Strategy once both inputs are
  // complete. The reports themselves are server-rendered pages — see
  // analysis-workspace.tsx on why generation stays in one place.
  return (
    <AnalysisWorkspace
      applicationId={applicationId}
      confirmedAt={confirmedAt}
      matchingSubtitle={matchingSubtitle}
      regenerateOnLoad={regenerate === '1'}
    />
  );
}
