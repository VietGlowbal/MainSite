import { fetchOnboardingState } from '@/features/ai-strategy-dashboard/api';
import { nextOnboardingStep } from '@/features/ai-strategy-dashboard/domain';
import { applicationSubNav } from '@/shared/lib/app-routes';
import { Breadcrumbs } from '@/shared/ui/breadcrumbs';
import { Container } from '@/shared/ui/container';
import { createClient } from '@/lib/supabase/server';
import { ApplicationSubNav } from './application-sub-nav';

/**
 * The brand-red band at the top of every page scoped to one application:
 * breadcrumbs above the six-entry context bar.
 *
 * ─── WHY IT IS A BAND AND NOT JUST A ROW OF LINKS ────────────────────────────
 *
 * It used to be black-on-white text sitting in the page's own measure, which
 * made it read as part of whichever screen it happened to be on — and the six
 * screens look nothing like each other (a checklist, two reports, a planner, a
 * CV workspace, an essay editor). A student who had just navigated could not
 * tell the bar was the same bar. Painting it `bg-brand` and running it
 * full-bleed makes it chrome: the one region that does not change between the
 * six, so it is recognisable as the way between them.
 *
 * ⚠️ IT MUST BE RENDERED OUTSIDE ANY `Container`. The band spans the viewport
 * and puts its own `Container` inside, so its content still lines up with the
 * page below it. Nested inside a page's measure it becomes an inset red box
 * with the content aligned to nothing.
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
  userId,
  /** The course name, so the breadcrumb reads as the thing rather than "Application". */
  courseName,
}: {
  applicationId: string;
  userId?: string;
  courseName?: string | null;
}) {
  const supabase = await createClient();
  const authenticatedUserId =
    userId ??
    (
      await supabase.auth.getUser()
    ).data.user?.id;

  // Signed out, the page above this is already redirecting. Rendering a bar of
  // links into someone's application while that resolves would be worse than
  // rendering nothing.
  if (!authenticatedUserId) return null;

  const state = await fetchOnboardingState(supabase, authenticatedUserId, applicationId);
  const step = nextOnboardingStep(state);

  const items = applicationSubNav(applicationId, {
    analysisReady: state.aiAnalysisComplete,
    strategyReady: state.strategyComplete,
    // The planner is the last step; anything earlier and the route redirects.
    plannerReady: step === 'dashboard',
  });

  return (
    <div data-no-auto-translate className="bg-brand">
      {/* No bottom padding: the sub-nav's own underline is the band's edge, so
          the active entry's marker sits flush with where the white starts. */}
      <Container className="flex flex-col gap-gb-lg pt-gb-2xl">
        <Breadcrumbs
          tone="on-brand"
          {...(courseName ? { labels: { application: courseName } } : {})}
        />
        <ApplicationSubNav items={items} tone="on-brand" />
      </Container>
    </div>
  );
}
