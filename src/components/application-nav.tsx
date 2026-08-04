import { fetchOnboardingState } from '@/features/ai-strategy-dashboard/api';
import { nextOnboardingStep } from '@/features/ai-strategy-dashboard/domain';
import { applicationSubNav } from '@/shared/lib';
import { Breadcrumbs } from '@/shared/ui';
import { createClient } from '@/lib/supabase/server';
import { ApplicationSubNav } from './application-sub-nav';

/**
 * Breadcrumbs plus the context bar, for every page scoped to one application.
 *
 * ─── WHY IT LIVES IN `src/components` ────────────────────────────────────────
 *
 * It reaches `@/features/ai-strategy-dashboard` for the onboarding state and
 * `@/shared` for the route registry, and it is rendered from two different
 * subtrees — `/apply/[applicationId]` and the `/ai-strategy/[applicationId]`
 * layout. A feature may not import another feature, and duplicating it in both
 * subtrees is how the two bars end up listing different destinations. The
 * composition layer is the one place allowed to reach both, which is the same
 * reasoning that keeps `strategy-chrome.tsx` in the app layer.
 *
 * ─── WHY IT ASKS THE DATABASE ────────────────────────────────────────────────
 *
 * Two of the six entries are unreachable until the AI analysis has run —
 * `strategy/dashboard` redirects back into onboarding, so linking it early
 * would bounce the student. `fetchOnboardingState` is the same read the routing
 * already does, so the bar and the redirects cannot disagree about what is
 * open.
 *
 * It is a server component doing one extra query per application page. That is
 * the cost of the bar being correct rather than optimistic; the alternative is
 * a bar that lies for the first few minutes of a student's first session, which
 * is exactly when they are least able to tell it is lying.
 */
export async function ApplicationNav({
  applicationId,
  /** The course name, so the breadcrumb reads as the thing rather than "Application". */
  courseName,
}: {
  applicationId: string;
  courseName?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed out, the page above this is already redirecting. Rendering a bar of
  // links into someone's application while that resolves would be worse than
  // rendering nothing.
  if (!user) return null;

  const state = await fetchOnboardingState(supabase, user.id, applicationId);
  const step = nextOnboardingStep(state);

  const items = applicationSubNav(applicationId, {
    analysisReady: state.aiAnalysisComplete,
    // The planner is the last step; anything earlier and the route redirects.
    plannerReady: step === 'dashboard',
  });

  return (
    <div className="flex flex-col gap-gb-lg">
      <Breadcrumbs {...(courseName ? { labels: { application: courseName } } : {})} />
      <ApplicationSubNav items={items} />
    </div>
  );
}
