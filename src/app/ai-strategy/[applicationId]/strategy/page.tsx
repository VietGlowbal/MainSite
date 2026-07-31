import { redirect } from 'next/navigation';
import { fetchStrategyOnboardingStatus } from '@/features/ai-strategy-dashboard/api';
import { StrategyHome } from '@/features/ai-strategy-dashboard/ui';
import { createClient } from '@/lib/supabase/server';

/**
 * `/ai-strategy/[applicationId]/strategy` — Stage 1, Strategy Home
 * (requirements.md Requirement 2).
 *
 * Ownership of `applicationId` is already enforced by the layout above this
 * page; this component only decides where "Start My Strategy" goes.
 *
 * Personal Summary and Achievements (requirements.md Requirement 3-4) are not
 * scoped to one application — they're the same student data shared across
 * every Strategy (Requirement 15.2) — so a student who has already been
 * through that flow for a different course skips straight to the AI Analysis
 * step for this one, instead of re-answering questions they've already
 * answered. Stages 3-5 (AI Analysis, AI Strategy Introduction, the Dashboard
 * itself) are tasks.md Phase 3+ and are not built yet; the CTA lands on an
 * honest "coming soon" placeholder rather than a dead link.
 */
export default async function StrategyHomePage({
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

  const [{ data: application }, { reflectionComplete }] = await Promise.all([
    supabase
      .from('course_applications')
      .select('course_name, university_name')
      .eq('id', applicationId)
      .eq('user_id', user.id)
      .maybeSingle(),
    fetchStrategyOnboardingStatus(supabase, user.id),
  ]);

  const analysisHref = `/ai-strategy/${applicationId}/strategy/analysis`;
  const startHref = reflectionComplete
    ? analysisHref
    : `/ai-strategy/reflection?return=${encodeURIComponent(analysisHref)}`;

  return (
    <StrategyHome
      courseName={application?.course_name ?? 'Your course'}
      universityName={application?.university_name ?? 'Your university'}
      startHref={startHref}
    />
  );
}
