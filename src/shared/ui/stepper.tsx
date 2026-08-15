import { TID, testId } from '@/shared/lib';

/**
 * Stepper — the five-step spine both apply journeys are navigated by.
 *
 * TWO STEPPERS, ONE COMPONENT. The designs contain two distinct sequences and
 * it is worth being clear which is which, because several frames mix their
 * labels:
 *
 *   AI strategy   Reflection → Output report → University Detail →
 *                 Application Strategy → Submit Audit
 *                 Steps 4 and 5 sit behind the paywall, which is why that
 *                 stepper renders locked steps rather than simply upcoming ones.
 *
 *   Application   Research → Check eligibility → Prepare documents →
 *                 Improve application → Submit
 *                 Per course, and the only one that carries due dates.
 *
 * The component takes the steps as data and holds no opinion about either.
 *
 * STATE IS DERIVED, NOT PASSED PER STEP. Callers give a `currentIndex`;
 * everything before it is complete, everything after is upcoming. A step that
 * is `locked` overrides that — it renders muted with no connector fill however
 * far the student has got, so the paywall boundary reads as a wall rather than
 * as progress they have not made yet.
 */

export type StepperStep = {
  /** Stable key. Also the fragment when `href` is absent. */
  key: string;
  label: string;
  /** Shown under the label. The application journey uses it for a due date. */
  meta?: string | undefined;
  /** Makes the step a link. Omit for steps that cannot be jumped to. */
  href?: string | undefined;
  /** Behind a paywall or otherwise unreachable. Never renders as complete. */
  locked?: boolean | undefined;
  /**
   * Explicit completion state for editable journeys. When omitted, completion
   * is derived from `currentIndex` for backwards compatibility.
   */
  complete?: boolean | undefined;
};

type StepState = 'complete' | 'current' | 'upcoming' | 'locked';

function stateFor(index: number, currentIndex: number, step: StepperStep): StepState {
  if (step.locked) return 'locked';
  if (index === currentIndex) return 'current';
  if (step.complete !== undefined) return step.complete ? 'complete' : 'upcoming';
  if (index < currentIndex) return 'complete';
  return 'upcoming';
}

/** Marker fill and border, by state. */
const MARKER: Record<StepState, string> = {
  complete: 'bg-brand text-on-brand border-brand',
  current: 'bg-surface text-brand border-brand',
  upcoming: 'bg-surface text-fg-muted border-line-strong',
  locked: 'bg-surface-muted text-fg-muted border-line',
};

const LABEL: Record<StepState, string> = {
  complete: 'text-fg-secondary',
  current: 'text-brand',
  upcoming: 'text-fg-muted',
  locked: 'text-fg-muted',
};

/**
 * Whether the student has got as far as this step.
 *
 * A locked step is never "reached" however far they have progressed — the
 * paywall boundary has to read as a wall, not as a step they simply have not
 * done yet.
 */
function isReached(state: StepState): boolean {
  return state === 'complete' || state === 'current';
}

/**
 * The line between two markers is drawn in halves, one owned by each step, so
 * that every step can stay `flex-1` and the markers space evenly. Both halves
 * of a gap take their fill from the *later* of the two steps: the run from step
 * 2 to step 3 is only filled once step 3 has been reached.
 */
function connectorClass(reached: boolean): string {
  return reached ? 'bg-brand' : 'bg-line';
}

function Marker({ state, index }: { state: StepState; index: number }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-gb-4xl items-center justify-center rounded-gb-full border-2 text-gb-sm font-semibold ${MARKER[state]}`}
    >
      {state === 'complete' ? (
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M4 10.5 8 14.5 16 6"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : state === 'current' ? (
        <span className="size-gb-lg rounded-gb-full bg-brand" />
      ) : state === 'locked' ? (
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M6 9V6.5a4 4 0 0 1 8 0V9M5 9h10v7H5z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        index + 1
      )}
    </span>
  );
}

export function Stepper({
  steps,
  currentIndex,
  label = 'Progress through this journey',
  className,
  onStepSelect,
}: {
  steps: StepperStep[];
  /** Index of the step in progress. Everything before it reads as complete. */
  currentIndex: number;
  /** Accessible name for the navigation landmark. */
  label?: string;
  className?: string | undefined;
  /** Makes unlocked steps buttons for client-managed journeys. */
  onStepSelect?: ((key: string, index: number) => void) | undefined;
}) {
  return (
    <nav
      {...testId(TID.stepper)}
      aria-label={label}
      /* Scrolls rather than wraps: five labelled steps do not fit at 375px, and
         wrapping breaks the connector line into disconnected fragments. */
      className={`overflow-x-auto ${className ?? ''}`}
    >
      <ol className="flex min-w-max items-start">
        {steps.map((step, index) => {
          const state = stateFor(index, currentIndex, step);
          const nextStep = steps[index + 1];
          const nextState = nextStep ? stateFor(index + 1, currentIndex, nextStep) : null;

          const content = (
            <span className="flex flex-col items-center gap-gb-xs px-gb-md text-center">
              <Marker state={state} index={index} />
              <span className={`text-gb-sm font-semibold ${LABEL[state]}`}>{step.label}</span>
              {step.meta ? (
                <span className="text-gb-xs text-fg-muted">{step.meta}</span>
              ) : null}
            </span>
          );

          return (
            <li
              key={step.key}
              className="flex flex-1 items-start"
              aria-current={state === 'current' ? 'step' : undefined}
            >
              {/* Left half of the incoming gap. `mt-gb-xl` puts it on the
                  marker's centre line: size-gb-4xl is 32px, so half is 16px. */}
              {index === 0 ? (
                <span aria-hidden="true" className="min-w-gb-6xl flex-1" />
              ) : (
                <span
                  aria-hidden="true"
                  className={`mt-gb-xl h-[2px] min-w-gb-6xl flex-1 ${connectorClass(isReached(state))}`}
                />
              )}

              {step.href && state !== 'locked' ? (
                <a
                  href={step.href}
                  className="rounded-gb-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {content}
                </a>
              ) : onStepSelect && state !== 'locked' ? (
                <button
                  type="button"
                  onClick={() => onStepSelect(step.key, index)}
                  className="rounded-gb-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {content}
                </button>
              ) : (
                content
              )}

              {/* Right half of the outgoing gap, filled by the next step. */}
              {nextState === null ? (
                <span aria-hidden="true" className="min-w-gb-6xl flex-1" />
              ) : (
                <span
                  aria-hidden="true"
                  className={`mt-gb-xl h-[2px] min-w-gb-6xl flex-1 ${connectorClass(isReached(nextState))}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
