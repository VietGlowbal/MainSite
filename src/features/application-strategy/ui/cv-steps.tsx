import Link from 'next/link';
import { ProgressBar } from '@/shared/ui';
import { CV_STEPS, type CvStepKey } from '../domain';

/**
 * The four-step CV indicator: Target Profile → Nội dung → Bản CV → Layout - PDF.
 *
 * WHY THIS IS NOT A SECOND `Stepper`. The global five-stage journey indicator is
 * the spine of the whole product and it is already on the page, rendered by the
 * layout. The requirement is that the document-level progress reads as
 * subordinate to it — and two full steppers stacked would read as two competing
 * journeys, which is the exact confusion this is meant to prevent. So it borrows
 * `ReflectionShell`'s treatment instead: a compact numbered row over a thin
 * `ProgressBar`, at `text-gb-xs` against the global stepper's larger type.
 *
 * Completed steps are links, upcoming ones are not. A student who wants to revise
 * their target profile after seeing the review should be able to click back, but
 * offering step 4 before step 2 exists sends them to an empty page.
 */
export function CvSteps({
  applicationId,
  current,
  /** How far the student has actually got, if further than `current`. */
  furthestReached,
}: {
  applicationId: string;
  current: CvStepKey;
  furthestReached?: CvStepKey | undefined;
}) {
  const index = CV_STEPS.findIndex((s) => s.key === current);
  const reachedIndex = furthestReached
    ? Math.max(
        index,
        CV_STEPS.findIndex((s) => s.key === furthestReached),
      )
    : index;
  const percent = Math.round(((index + 1) / CV_STEPS.length) * 100);
  const currentLabel = CV_STEPS[index]?.label ?? '';

  return (
    <nav className="flex flex-col gap-gb-md" aria-label="CV steps">
      <div className="flex items-center justify-between gap-gb-lg">
        <ol className="flex flex-wrap items-center gap-gb-md text-gb-xs">
          {CV_STEPS.map((step, i) => {
            const isCurrent = i === index;
            const navigable = i <= reachedIndex && !isCurrent;
            const text = `${i + 1}. ${step.label}`;

            return (
              <li key={step.key} className="flex items-center gap-gb-md">
                {navigable ? (
                  <Link
                    href={`/ai-strategy/${applicationId}/cv/${step.key}`}
                    className="text-fg-secondary underline decoration-line-strong underline-offset-4 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    {text}
                  </Link>
                ) : (
                  <span
                    aria-current={isCurrent ? 'step' : undefined}
                    className={
                      isCurrent
                        ? 'font-semibold text-fg-brand'
                        : i < index
                          ? 'text-fg-secondary'
                          : 'text-fg-muted'
                    }
                  >
                    {text}
                  </span>
                )}
                {i < CV_STEPS.length - 1 ? (
                  <span aria-hidden className="text-fg-muted">
                    ·
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
        <span className="shrink-0 text-gb-xs text-fg-muted">
          Step {index + 1} of {CV_STEPS.length}
        </span>
      </div>
      <ProgressBar
        value={percent}
        size="sm"
        label={`CV step ${index + 1} of ${CV_STEPS.length}: ${currentLabel}`}
      />
    </nav>
  );
}
