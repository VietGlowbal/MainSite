import { redirect } from 'next/navigation';
import { fetchOnboardingState, generateRecommendations } from '@/features/ai-strategy-dashboard/api';
import {
  nextOnboardingStep,
  onboardingStepHref,
  recommendationFromRow,
} from '@/features/ai-strategy-dashboard/domain';
import {
  DashboardSummary,
  RecommendationTable,
  StrategyCategoryBoard,
} from '@/features/ai-strategy-dashboard/ui';
import { createClient } from '@/lib/supabase/server';
import { Container } from '@/shared/ui';

/**
 * `/ai-strategy/[applicationId]/strategy/dashboard` — Stage 5, the AI
 * Strategy Dashboard (requirements.md Requirement 9-10). Ownership already
 * enforced by the layout above this route.
 *
 * Guards against a direct visit before onboarding is done — a bookmarked or
 * shared dashboard URL for a Strategy with no Course Match Analysis yet
 * would otherwise render an empty, unexplained page instead of resuming
 * onboarding at the right step.
 *
 * Generates (and reconciles) recommendations on every visit if a Course
 * Match Analysis exists — `generateRecommendations` is idempotent and
 * update-in-place rather than append-only, so re-running it on every load
 * is what keeps the table current with the latest analysis.
 *
 * A generation failure is shown as an explicit error, not an empty table —
 * those read identically to a genuinely-recommendation-free Strategy
 * otherwise, which is its own kind of wrong answer.
 */
export default async function StrategyDashboardPage({
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
  if (step !== 'dashboard') {
    redirect(onboardingStepHref(step, applicationId));
  }

  const { data: application } = await supabase
    .from('course_applications')
    .select('course_name, university_name')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: latestMatch } = await supabase
    .from('application_match_analyses')
    .select('current_match_score, max_possible_match_score')
    .eq('application_id', applicationId)
    .eq('analysis_status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let generationError: string | null = null;
  if (latestMatch) {
    const result = await generateRecommendations(supabase, applicationId);
    if (!result.ok && result.error !== 'no_match_analysis') {
      generationError =
        "We couldn't refresh your recommendations just now. Showing what's already saved.";
    }
  }

  const { data: recommendationRows } = await supabase
    .from('application_recommendations')
    .select('*')
    .eq('application_id', applicationId)
    .not('category', 'is', null)
    .is('archived_at', null)
    .order('priority', { ascending: false });

  const recommendations = (recommendationRows ?? []).map(recommendationFromRow);
  const completionPercent =
    recommendations.length === 0
      ? 0
      : Math.round(
          (recommendations.filter((r) => r.status === 'completed').length / recommendations.length) *
            100,
        );

  return (
    <Container className="max-w-6xl py-gb-7xl">
      <div className="flex flex-col gap-gb-4xl">
        <DashboardSummary
          universityName={application?.university_name ?? 'Your university'}
          courseName={application?.course_name ?? 'Your course'}
          currentMatchPercent={latestMatch?.current_match_score ?? 0}
          goalMatchPercent={latestMatch?.max_possible_match_score ?? 0}
          completionPercent={completionPercent}
          recommendations={recommendations}
        />

        {generationError ? (
          <p className="rounded-gb-lg border border-line bg-surface-muted px-gb-lg py-gb-md text-gb-sm text-fg-error">
            {generationError}
          </p>
        ) : null}

        <StrategyCategoryBoard applicationId={applicationId} recommendations={recommendations} />

        <RecommendationTable applicationId={applicationId} recommendations={recommendations} />
      </div>
    </Container>
  );
}
