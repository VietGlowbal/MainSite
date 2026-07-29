'use client';

import { Stepper, type StepperStep } from '@/shared/ui';
import type { ApplicationStage } from '@/lib/apply-types';
import { stageProgressLabel } from '../domain';
import { ResearchProgress } from './research-progress';

/**
 * "Your application journey" — the five-stage spine of a course application.
 *
 * Replaces `JourneyPipeline`, a horizontally scrolling row of cards with its own
 * status colours and a "View full timeline" button that was wired to nothing.
 * This is the shared `Stepper`, so the workspace and the AI strategy journey now
 * draw the same component rather than two lookalikes that drift apart.
 *
 * The stage's supporting line is its task count rather than a due date. The
 * frame shows dates, but `application_stages` has no due-date column — only
 * tasks do — so printing one would mean inventing it. "2/5 done" is true today
 * and is what a student actually wants from a step they are mid-way through.
 */
export function ApplicationJourney({
  stages,
  activeIndex,
  onSelectStage,
}: {
  stages: ApplicationStage[];
  activeIndex: number;
  onSelectStage: (stageId: string) => void;
}) {
  if (stages.length === 0) return null;

  const steps: StepperStep[] = stages.map((stage) => {
    const label = stageProgressLabel(stage);
    return {
      key: stage.id,
      label: stage.name,
      ...(label !== null ? { meta: label } : {}),
    };
  });

  return (
    <section className="flex flex-col gap-gb-2xl">
      <h2 className="font-display text-gb-xl font-semibold text-fg">Your application journey</h2>

      {/* The stepper renders labels, not controls — selection is a separate row
          of buttons beneath it. Making each label a link would mean either a
          real route per stage (there is none) or an anchor that does not
          navigate, which is worse than a button that plainly is one. */}
      <Stepper steps={steps} currentIndex={activeIndex} label="Your application journey" />

      <div className="flex flex-wrap gap-gb-md">
        {stages.map((stage, index) => (
          <button
            key={stage.id}
            type="button"
            onClick={() => onSelectStage(stage.id)}
            aria-pressed={index === activeIndex}
            className={`rounded-gb-full border px-gb-xl py-gb-md text-gb-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              index === activeIndex
                ? 'border-brand bg-brand text-on-brand'
                : 'border-line text-fg-tertiary hover:border-line-strong hover:text-fg'
            }`}
          >
            {stage.name}
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * What the workspace shows when the checklist does not exist yet.
 *
 * This is the common case on live data, not an edge case: until the parse
 * worker has read the course page there are no stages at all, and the previous
 * build rendered that as an empty journey with a 100% progress bar above it.
 *
 * The waiting half is `ResearchProgress` — a paragraph alone left the screen
 * looking inert, which is what made a working parse read as a broken page.
 */
export function JourneyPending({ parseStatus, parseError, target }: {
  parseStatus?: string | undefined;
  parseError?: string | null | undefined;
  target?: string | null | undefined;
}) {
  const failed = parseStatus === 'failed' || parseStatus === 'timeout';

  if (!failed) return <ResearchProgress target={target} />;

  return (
    <section className="flex flex-col items-start gap-gb-lg rounded-gb-2xl border border-dashed border-line-strong p-gb-4xl">
      <h2 className="font-display text-gb-xl font-semibold text-fg">Your application journey</h2>
      <p className="text-gb-md text-fg-tertiary">
        {parseError ?? 'We could not read the official course page, so there is no checklist yet.'}{' '}
        You can try again from your applications list.
      </p>
    </section>
  );
}
