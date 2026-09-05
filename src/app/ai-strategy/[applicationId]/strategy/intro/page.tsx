import { redirect } from 'next/navigation';
import { markStrategyIntroSeen } from '@/features/ai-strategy-dashboard/api';
import { getServerIdentity } from '@/server/auth/server-identity';
import { Button, Container, Panel } from '@/shared/ui';

/**
 * `/ai-strategy/[applicationId]/strategy/intro` — Stage 4, AI Strategy
 * Introduction (requirements.md Requirement 8).
 *
 * Built to the text spec, same as Strategy Home — see the warning in
 * tasks.md Phase 2 about node `375:18445` not having been read yet; this
 * page has no node id recorded in docs/redesign-status.md at all, so there
 * is nothing to check it against.
 *
 * Marks `strategy_intro_seen_at` on load, idempotently — visiting this page
 * IS "seeing the introduction" (requirements.md 1.2's per-Strategy step),
 * which is what lets `nextOnboardingStep` stop routing a returning student
 * back here once they've been through it.
 */
const FAQ = [
  {
    q: 'Why is my strategy different?',
    a: 'Every recommendation is generated from your own Personal Summary, Achievements and the specific course you chose — nobody else gets the same list.',
  },
  {
    q: 'Will it update?',
    a: 'Uploading new evidence or asking for a re-analysis from a recommendation refreshes your strategy — it does not happen automatically yet.',
  },
  {
    q: 'Can I ignore tasks?',
    a: 'Yes. Recommendations are guidance, not requirements — you decide what to act on.',
  },
  {
    q: 'How often does AI rerun?',
    a: 'Whenever you ask it to, from a recommendation’s "Re-analyse now" action — not on a fixed schedule.',
  },
] as const;

export default async function StrategyIntroPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  const { supabase, identity: user } = await getServerIdentity();
  if (!user) redirect('/auth');

  await markStrategyIntroSeen(supabase, user.id, applicationId);

  return (
    <Container className="max-w-4xl py-gb-7xl">
      <div className="flex flex-col gap-gb-4xl">
        <div className="flex flex-col items-center gap-gb-lg text-center">
          <h1 className="font-display text-gb-display-sm font-semibold text-fg">
            Your AI strategist is ready.
          </h1>
          <p className="max-w-gb-width-xl text-gb-md text-fg-tertiary">
            Recommendations are generated from your Applicant Analysis and Course Match Analysis,
            ranked by priority. Ask for a re-analysis any time you&rsquo;ve made progress.
          </p>
        </div>

        <div className="flex flex-col gap-gb-lg">
          {FAQ.map((item) => (
            <Panel key={item.q}>
              <p className="text-gb-md font-semibold text-fg">{item.q}</p>
              <p className="mt-gb-xs text-gb-sm text-fg-tertiary">{item.a}</p>
            </Panel>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            href={`/ai-strategy/${applicationId}/strategy/analysis/recommendation`}
            size="lg"
            className="min-w-64"
          >
            Generate My Strategy
          </Button>
        </div>
      </div>
    </Container>
  );
}
