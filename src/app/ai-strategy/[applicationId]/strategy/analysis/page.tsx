import { Button, Container } from '@/shared/ui';

/**
 * `/ai-strategy/[applicationId]/strategy/analysis` — Stage 3, AI Analysis.
 *
 * A placeholder, not a stub pretending to be finished. Requirements 5-7
 * (the loading state, the Applicant Analysis report, the Course Match
 * Analysis report) are tasks.md Phase 3, not built yet. This page exists so
 * Strategy Home's CTA has somewhere honest to land instead of a 404 — see the
 * note on the "Design authority" rule against inventing UI ahead of what's
 * real, applied here in the other direction: an unbuilt step says so plainly
 * rather than faking a result.
 */
export default function StrategyAnalysisComingSoonPage() {
  return (
    <Container className="max-w-4xl py-gb-7xl">
      <div className="flex flex-col items-center gap-gb-lg text-center">
        <h1 className="font-display text-gb-display-sm font-semibold text-fg">
          Your AI analysis is coming soon
        </h1>
        <p className="max-w-gb-width-xl text-gb-md text-fg-tertiary">
          We&rsquo;ve saved your Personal Summary and Achievements. The Applicant Analysis and
          Course Match Analysis reports that turn them into a strategy are still being built.
        </p>
        <Button href="/ai-strategy" variant="secondary" size="lg">
          Back to AI strategy
        </Button>
      </div>
    </Container>
  );
}
