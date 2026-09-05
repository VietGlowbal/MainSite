import { fetchOnboardingState, getPlannerMode } from '@/features/ai-strategy-dashboard/api';
import { nextOnboardingStep } from '@/features/ai-strategy-dashboard/domain';
import { aiStrategyApplicationNav } from '@/shared/lib/ai-strategy-route-model';
import { Breadcrumbs } from '@/shared/ui/breadcrumbs';
import { Container } from '@/shared/ui/container';
import { getServerIdentity } from '@/server/auth/server-identity';
import { ApplicationNavBackground } from './application-nav-background';
import { ApplicationSubNav } from './application-sub-nav';

/**
 * Shared application context bar. Route destinations come from one canonical
 * AI Strategy model so report/planner links cannot drift between pages.
 */
export async function ApplicationNav({
  applicationId,
  userId,
  courseName,
}: {
  applicationId: string;
  userId?: string;
  courseName?: string | null;
}) {
  // `getServerIdentity` is React-`cache()`d per request and verifies the access
  // token's ES256 signature locally, so the caller that already resolved the
  // session (every one of them does) pays nothing for this second read — where
  // `supabase.auth.getUser()` was a fresh Auth API round-trip each time this
  // band rendered. See docs/performance.md fix 7.
  const { supabase, identity } = await getServerIdentity();
  const authenticatedUserId = userId ?? identity?.id;

  if (!authenticatedUserId) return null;

  const state = await fetchOnboardingState(supabase, authenticatedUserId, applicationId);
  const step = nextOnboardingStep(state);
  const plannerMode = await getPlannerMode(supabase, authenticatedUserId);
  const items = aiStrategyApplicationNav(applicationId, {
    analysisReady: state.aiAnalysisComplete,
    strategyReady: state.strategyComplete,
    // Plus/admin users have the canonical Planner as their product entry
    // point. It derives whatever useful work it can from the application, so
    // it must not disappear behind the legacy recommendation onboarding flow.
    // Free users retain that established gate and legacy board behaviour.
    plannerReady: plannerMode === 'canonical' || step === 'dashboard',
    candidateConfirmed: state.candidateConfirmed,
  });

  return (
    <div data-no-auto-translate className="relative overflow-hidden">
      <div className="absolute inset-0 animate-gb-app-nav-reveal bg-brand motion-reduce:animate-none" />
      <ApplicationNavBackground />
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
