import { Button, Container, Panel } from '@/shared/ui';

/**
 * `/ai-strategy/[applicationId]/strategy/intro` — Stage 4, AI Strategy
 * Introduction (requirements.md Requirement 8).
 *
 * Built to the text spec, same as Strategy Home — see the warning in
 * tasks.md Phase 2 about node `375:18445` not having been read yet; this
 * page has no node id recorded in docs/redesign-status.md at all, so there
 * is nothing to check it against.
 */
const FAQ = [
  {
    q: 'Why is my strategy different?',
    a: 'Every recommendation is generated from your own Personal Summary, Achievements and the specific course you chose — nobody else gets the same list.',
  },
  {
    q: 'Will it update?',
    a: 'Yes. Improving a grade, adding an achievement, or uploading evidence triggers a re-analysis automatically.',
  },
  {
    q: 'Can I ignore tasks?',
    a: 'Yes. Recommendations are guidance, not requirements — you decide what to act on.',
  },
  {
    q: 'How often does AI rerun?',
    a: 'Whenever something meaningful changes, not on a fixed schedule — see "Continuous AI Updates" once your dashboard is live.',
  },
] as const;

export default async function StrategyIntroPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  return (
    <Container className="max-w-4xl py-gb-7xl">
      <div className="flex flex-col gap-gb-4xl">
        <div className="flex flex-col items-center gap-gb-lg text-center">
          <h1 className="font-display text-gb-display-sm font-semibold text-fg">
            Your AI strategist is ready.
          </h1>
          <p className="max-w-gb-width-xl text-gb-md text-fg-tertiary">
            Recommendations are generated from your Applicant Analysis and Course Match Analysis,
            ranked by priority, and updated automatically as you make progress.
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
          <Button href={`/ai-strategy/${applicationId}/strategy/dashboard`} size="lg" className="min-w-64">
            Generate My Strategy
          </Button>
        </div>
      </div>
    </Container>
  );
}
