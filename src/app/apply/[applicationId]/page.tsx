import { redirect } from 'next/navigation';
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
 * ─── A PURE BOUNCE, NOT A SECOND ROUTER ──────────────────────────────────────
 *
 * This used to compute `onboardingStepHref(nextOnboardingStep(state), id)`
 * itself, duplicating the exact decision `/ai-strategy/[id]/strategy`
 * (`strategy/page.tsx`) already makes for its own "resume, don't restart"
 * behaviour. The two computations drifted the same day this page shipped —
 * this one skipped `strategy/page.tsx`'s "show the Overview first" case
 * entirely, so a returning student (whose reflections were already complete
 * from an EARLIER application) landed straight on the AI-analysis page with
 * no explanation, autofiring a generation call — see
 * `docs/known-issues.md §5f`. Bouncing here instead of recomputing means
 * there is exactly one place that decides where a student belongs; this page
 * cannot disagree with it because it no longer has an opinion.
 *
 * Every existing link to `/apply/${id}` (the applications list, the Plus
 * upsell return path, the statement editor's back-link, the post-sign-in
 * redirect target) keeps working unchanged — they now just bounce onward to
 * wherever is actually correct, first-time or returning.
 */
export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const { identity: user } = await getServerIdentity();
  if (!user) redirect(`/auth?redirect=${encodeURIComponent(`/apply/${applicationId}`)}`);

  redirect(`/ai-strategy/${applicationId}/strategy`);
}
