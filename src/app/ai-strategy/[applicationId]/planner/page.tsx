import { redirect } from 'next/navigation';
import { fetchOnboardingState, generateRecommendations, getApplicationPlanner } from '@/features/ai-strategy-dashboard/api';
import {
  nextOnboardingStep,
  onboardingStepHref,
  recommendationFromRow,
} from '@/features/ai-strategy-dashboard/domain';
import {
  ApplicationPlanner,
  DashboardSummary,
  GenerateCanonicalPlanButton,
  HierarchicalApplicationPlanner,
  StrategyCategoryBoard,
} from '@/features/ai-strategy-dashboard/ui';
import { getUniversityQueries } from '@/features/universities/api';
import { createClient } from '@/lib/supabase/server';
import { Container } from '@/shared/ui';

/** Canonical application-level Planner route. */
export default async function PlannerPage({
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
    .select('course_name, university_name, university_id, deadline')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();

  const hero = await fetchUniversityHero(application?.university_id ?? null);

  // The hierarchy is canonical when it exists. A missing (or not-yet-deployed)
  // hierarchy migration leaves the established legacy experience available;
  // recommendations are never merged into a fake canonical structure.
  let canonicalPlanner = null;
  try {
    canonicalPlanner = await getApplicationPlanner(supabase, applicationId, user.id);
  } catch (error) {
    console.error('[planner] canonical hierarchy unavailable; using legacy planner', error);
  }

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

  return (
    <Container className="max-w-6xl py-gb-7xl">
      <div className="flex flex-col gap-gb-4xl">
        <DashboardSummary
          universityName={application?.university_name ?? 'Your university'}
          courseName={application?.course_name ?? 'Your course'}
          imageUrl={hero.imageUrl}
          location={hero.country}
          currentMatchPercent={latestMatch?.current_match_score ?? 0}
          deadline={application?.deadline ?? null}
          recommendations={recommendations}
        />

        {generationError ? (
          <p className="rounded-gb-lg border border-line bg-surface-muted px-gb-lg py-gb-md text-gb-sm text-fg-error">
            {generationError}
          </p>
        ) : null}

        <StrategyCategoryBoard applicationId={applicationId} recommendations={recommendations} />
        {canonicalPlanner?.plan ? (
          <HierarchicalApplicationPlanner applicationId={applicationId} planner={canonicalPlanner} />
        ) : (
          <>
            {process.env.NODE_ENV !== 'production' ? <GenerateCanonicalPlanButton applicationId={applicationId} /> : null}
            <ApplicationPlanner
              applicationId={applicationId}
              recommendations={recommendations}
              today={new Date()}
            />
          </>
        )}
      </div>
    </Container>
  );
}

async function fetchUniversityHero(
  universityId: number | null,
): Promise<{ imageUrl: string | null; country: string | null }> {
  if (universityId == null) return { imageUrl: null, country: null };
  const [uni] = await getUniversityQueries().getByIds([universityId]);
  return { imageUrl: uni?.image_url ?? null, country: uni?.country ?? null };
}
