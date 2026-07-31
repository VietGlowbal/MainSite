import { redirect } from 'next/navigation';
import { generateRecommendations } from '@/features/ai-strategy-dashboard/api';
import { recommendationFromRow } from '@/features/ai-strategy-dashboard/domain';
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
 * Generates recommendations on first visit if a Course Match Analysis
 * exists but nothing has been generated from it yet — `generateRecommendations`
 * is idempotent, so this is safe to run on every load rather than needing a
 * separate "has this run before" flag.
 *
 * Recommendation Detail (11), AI Coach (12), Evidence Upload (14) and
 * Multiple Strategies (15) are tasks.md Phases 5-7, not built yet.
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

  if (latestMatch) {
    await generateRecommendations(supabase, applicationId);
  }

  const { data: recommendationRows } = await supabase
    .from('application_recommendations')
    .select('*')
    .eq('application_id', applicationId)
    .not('category', 'is', null)
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

        <StrategyCategoryBoard recommendations={recommendations} />

        <RecommendationTable applicationId={applicationId} recommendations={recommendations} />
      </div>
    </Container>
  );
}
