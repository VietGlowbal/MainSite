import { fetchOnboardingState } from '@/features/ai-strategy-dashboard/api';
import { nextOnboardingStep } from '@/features/ai-strategy-dashboard/domain';
import { applicationSubNav } from '@/shared/lib/app-routes';
import { Breadcrumbs } from '@/shared/ui/breadcrumbs';
import { Container } from '@/shared/ui/container';
import { createClient } from '@/lib/supabase/server';
import { ApplicationNavBackground } from './application-nav-background';
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
 *
 * ─── WHY THE RED FILL AND REAL CONTENT ARRIVE A BEAT LATE ────────────────────
 *
 * `ApplicationNavBackground`'s canvas starts drawing the moment it mounts, on
 * whatever the page's own background is. The brand-red fill and the
 * breadcrumb/nav content are deliberately held back a few seconds
 * (`gb-app-nav-reveal`, `src/styles/tokens.css`) so a student sees the
 * animation on its own for a moment before the chrome settles in around it —
 * owner decision. It is a plain CSS `animation-delay`, not React state, so
 * this stays a server component.
 *
 * The fill div still has to sit BEFORE the canvas in source order (i.e.
 * behind it — plain elements with no z-index paint in DOM order). Once its
 * fade-in finishes it is a fully opaque layer; painted after the canvas it
 * would bury the animation instead of becoming the backdrop it plays against.
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
    candidateConfirmed: state.candidateConfirmed,
  });

  return (
    <div data-no-auto-translate className="relative overflow-hidden">
      {/* The red fill and the real content both hold back a few seconds so
          the animation gets a moment on its own before the chrome settles
          in around it — see tokens.css's gb-app-nav-reveal. Pure CSS
          (animation-delay), not JS state, so this stays a server component.
          It has to paint BEHIND the canvas, not after it: painted later in
          DOM order it would sit on top and, once fully faded in, occlude the
          animation completely instead of becoming the backdrop it flashes
          against. */}
      <div className="absolute inset-0 animate-gb-app-nav-reveal bg-brand motion-reduce:animate-none" />
      <ApplicationNavBackground />
      {/* No bottom padding: the sub-nav's own underline is the band's edge, so
          the active entry's marker sits flush with where the white starts. */}
      <Container className="relative animate-gb-app-nav-reveal flex flex-col gap-gb-lg pt-gb-2xl motion-reduce:animate-none">
        <Breadcrumbs
          tone="on-brand"
          {...(courseName ? { labels: { application: courseName } } : {})}
        />
        <ApplicationSubNav items={items} tone="on-brand" />
      </Container>
    </div>
  );
}
