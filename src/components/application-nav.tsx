import { fetchOnboardingState } from '@/features/ai-strategy-dashboard/api';
import { nextOnboardingStep } from '@/features/ai-strategy-dashboard/domain';
import { aiStrategyApplicationNav } from '@/shared/lib/ai-strategy-route-model';
import { Breadcrumbs } from '@/shared/ui/breadcrumbs';
import { Container } from '@/shared/ui/container';
import { createClient } from '@/lib/supabase/server';
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
  const supabase = await createClient();
  const authenticatedUserId =
    userId ??
    (
      await supabase.auth.getUser()
    ).data.user?.id;

  if (!authenticatedUserId) return null;

  const state = await fetchOnboardingState(supabase, authenticatedUserId, applicationId);
  const step = nextOnboardingStep(state);
  const items = aiStrategyApplicationNav(applicationId, {
    analysisReady: state.aiAnalysisComplete,
    strategyReady: state.strategyComplete,
    plannerReady: step === 'dashboard',
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
