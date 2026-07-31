import { Button, Container } from '@/shared/ui';

/**
 * `/ai-strategy/[applicationId]/strategy/dashboard` — Stage 5, the AI
 * Strategy Dashboard (requirements.md Requirement 9-14). tasks.md Phase 4-6,
 * not built yet — see the note on the analysis stub page for why this is an
 * honest placeholder rather than a page pretending to be finished.
 */
export default function StrategyDashboardComingSoonPage() {
  return (
    <Container className="max-w-4xl py-gb-7xl">
      <div className="flex flex-col items-center gap-gb-lg text-center">
        <h1 className="font-display text-gb-display-sm font-semibold text-fg">
          Your dashboard is being built
        </h1>
        <p className="max-w-gb-width-xl text-gb-md text-fg-tertiary">
          Your Applicant Analysis and Course Match Analysis are saved. The full recommendation
          dashboard — categories, priorities, an AI coach and progress tracking — is still in
          progress.
        </p>
        <Button href="/ai-strategy" variant="secondary" size="lg">
          Back to AI strategy
        </Button>
      </div>
    </Container>
  );
}
