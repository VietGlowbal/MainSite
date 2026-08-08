import { redirect } from 'next/navigation';
import { fetchOnboardingState } from '@/features/ai-strategy-dashboard/api';
import { nextOnboardingStep, onboardingStepHref } from '@/features/ai-strategy-dashboard/domain';
import { getServerIdentity } from '@/server/auth/server-identity';

/**
 * `/apply/[applicationId]` — no longer a page of its own.
 *
 * IT USED TO RENDER A FREE TASK CHECKLIST PLUS A FREE FIVE-PILLAR MATCH
 * ANALYSIS (`ApplicationWorkspaceV2` + `MatchInsightsPanel`) — real AI output,
 * shown with no gate at all, to anyone who clicked an application from
 * `/apply`. That undercut the product: the whole point of Reflection →
 * Personal Report → Matching Report → Personalized Strategy is that a student
 * commits to the flow to unlock what it produces, and this page was handing
 * out a chunk of the same value for free, one click earlier.
 *
 * This is now a pure router. `nextOnboardingStep` already knows exactly where
 * a student belongs — `StrategyHome`'s marketing page for a first-timer, the
 * correct mid-onboarding step for someone returning, or straight to the
 * Planner for someone fully set up — because `/ai-strategy/[id]/strategy`
 * (`strategy/page.tsx`) already computes it the same way for its own
 * "resume, don't restart" behaviour. Reusing it here rather than duplicating
 * the logic is what keeps the two from disagreeing about where a student is.
 *
 * Every existing link to `/apply/${id}` (the applications list, the Plus
 * upsell return path, the statement editor's back-link, the post-sign-in
 * redirect target) keeps working unchanged — they now just bounce onward
 * through this redirect to wherever is actually correct, first-time or
 * returning.
 */
export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const { supabase, identity: user } = await getServerIdentity();
  if (!user) redirect(`/auth?redirect=${encodeURIComponent(`/apply/${applicationId}`)}`);

  const state = await fetchOnboardingState(supabase, user.id, applicationId);
  redirect(onboardingStepHref(nextOnboardingStep(state), applicationId));
}
