import { redirect } from 'next/navigation';
import { ensureApplicationPlan, fetchOnboardingState, generateRecommendations, getCanonicalApplicationPlanner, getApplicationPlannerHealth, getPlannerMode } from '@/features/ai-strategy-dashboard/api';
import {
  getPlannerMicroSteps,
  nextOnboardingStep,
  onboardingStepHref,
  recommendationFromRow,
} from '@/features/ai-strategy-dashboard/domain';
import {
  ApplicationPlanner,
  DashboardSummary,
  HierarchicalApplicationPlanner,
  PlannerHealthBanner,
  StrategyCategoryBoard,
} from '@/features/ai-strategy-dashboard/ui';
import { getUniversityQueries } from '@/features/universities/api';
import { getServerIdentity } from '@/server/auth/server-identity';
import { Container } from '@/shared/ui';

/** Canonical application-level Planner route. */
export default async function PlannerPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  const { supabase, identity: user } = await getServerIdentity();
  if (!user) redirect('/auth');
  const plannerMode = await getPlannerMode(supabase, user.id);

  const state = await fetchOnboardingState(supabase, user.id, applicationId);
  const step = nextOnboardingStep(state);
  // The legacy board is the final stage of its older recommendation funnel.
  // Canonical Planner is a Plus/admin workspace and starts from the current
  // application state instead; it must remain reachable from the application
  // navigation even before that legacy funnel is complete.
  if (plannerMode === 'legacy' && step !== 'dashboard') {
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
  let plannerHealth = null;
  let canonicalState: 'failed' | 'not_entitled' | 'ready' = 'not_entitled';
  if (plannerMode === 'canonical') {
    const ensured = await ensureApplicationPlan(supabase, applicationId, user.id);
    canonicalState = ensured.kind === 'ready' ? 'ready' : ensured.kind === 'failed' ? 'failed' : 'not_entitled';
    if (ensured.kind === 'ready') {
      canonicalPlanner = await getCanonicalApplicationPlanner(supabase, applicationId, user.id);
      plannerHealth = await getApplicationPlannerHealth(supabase, applicationId, user.id);
    }
  }

  const { data: latestMatch } = await supabase
    .from('application_match_analyses')
    .select('current_match_score, max_possible_match_score')
    .eq('application_id', applicationId)
    .eq('user_id', user.id)
    .eq('analysis_status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let generationError: string | null = null;
  if (latestMatch && plannerMode === 'legacy') {
    const result = await generateRecommendations(supabase, applicationId, user.id);
    if (!result.ok && result.error !== 'no_match_analysis') {
      generationError =
        "We couldn't refresh your recommendations just now. Showing what's already saved.";
    }
  }

  const { data: recommendationRows } = plannerMode === 'legacy'
    ? await supabase
      .from('application_recommendations')
      .select('*')
      .eq('application_id', applicationId)
      .not('category', 'is', null)
      .is('archived_at', null)
      .order('priority', { ascending: false })
    : { data: [] };

  const recommendations = (recommendationRows ?? []).map(recommendationFromRow);
  const canonicalProgress = plannerMode === 'canonical'
    ? canonicalPlanner
      ? (() => {
        const micros = getPlannerMicroSteps(canonicalPlanner);
        const nextTask = micros.find((micro) => micro.status !== 'completed');
        const completed = micros.filter((micro) => micro.status === 'completed').length;
        return { completed, total: micros.length, percentage: micros.length ? Math.round((completed / micros.length) * 100) : 0, nextTitle: nextTask?.title ?? null };
      })()
      : null
    : undefined;

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
          recommendations={plannerMode === 'legacy' ? recommendations : undefined}
          canonicalProgress={canonicalProgress}
        />

        {generationError ? (
          <p className="rounded-gb-lg border border-line bg-surface-muted px-gb-lg py-gb-md text-gb-sm text-fg-error">
            {generationError}
          </p>
        ) : null}

        {plannerMode === 'canonical' && plannerHealth ? <PlannerHealthBanner applicationId={applicationId} health={plannerHealth} /> : null}

        {plannerMode === 'legacy' ? <StrategyCategoryBoard applicationId={applicationId} recommendations={recommendations} /> : null}
        {canonicalPlanner?.plan ? (
          <HierarchicalApplicationPlanner applicationId={applicationId} planner={canonicalPlanner} />
        ) : canonicalState === 'failed' ? (
          <p role="alert" className="rounded-gb-lg border border-line bg-surface-muted px-gb-lg py-gb-md text-gb-sm text-fg-error">We could not initialize your Planner. Please try again shortly.</p>
        ) : plannerMode === 'canonical' ? (
          <p role="status" className="rounded-gb-lg border border-line bg-surface-muted px-gb-lg py-gb-md text-gb-sm">Your Planner is being initialized. Refresh this page in a moment.</p>
        ) : (
          <ApplicationPlanner applicationId={applicationId} recommendations={recommendations} today={new Date()} />
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
