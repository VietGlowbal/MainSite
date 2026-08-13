import { ProgressBar } from '@/shared/ui';
import { useT } from '@/lib/i18n';
import {
  REFLECTION_STEP_COUNT,
  reflectionProgress,
  reflectionStep,
  type ReflectionStepKey,
} from '../domain';

/**
 * "Thông tin ứng viên" — the header both reflection steps share.
 *
 * The title, the step badge and the progress bar all derive from one step key,
 * so the two pages cannot disagree about where the student is. In the mockups
 * they did: the achievements page was badged "1/2" while drawing a full bar,
 * and the personal-information page was badged "2/3" — a different total for
 * the same flow.
 *
 * The bar is `ProgressBar` with a real value rather than the two hand-drawn
 * segments the frames show. Two segments only works for a two-step flow, and
 * the whole reason this component exists is that the step count was not being
 * treated as one fact.
 */
export function ReflectionShell({
  step,
  progress,
  caption,
  children,
}: {
  step: ReflectionStepKey;
  /**
   * How full the bar is, 0–1, overriding the whole-step default.
   *
   * Step 1 asks one question per screen and passes `aboutQuestionProgress`, so
   * the bar advances a notch per answer instead of sitting at half from the
   * moment the student arrives — which is what it did before, telling someone
   * who had answered nothing that they were halfway. Step 2 passes nothing and
   * keeps the per-step behaviour.
   */
  progress?: number | undefined;
  /** Replaces the step name under the bar, e.g. "Question 3 of 12". */
  caption?: string | undefined;
  children: React.ReactNode;
}) {
  const t = useT();
  const current = reflectionStep(step);
  const fraction = progress ?? reflectionProgress(step);
  const percent = Math.round(Math.min(Math.max(fraction, 0), 1) * 100);

  return (
    <div data-no-auto-translate className="flex flex-col gap-gb-4xl">
      <header className="flex flex-col gap-gb-lg">
        <div className="flex items-center justify-between gap-gb-xl">
          <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
            {t('Candidate information')}
          </h1>
          <span className="shrink-0 rounded-gb-full bg-brand-subtle px-gb-lg py-gb-xs text-gb-sm font-semibold text-fg-brand">
            {current.number}/{REFLECTION_STEP_COUNT}
          </span>
        </div>

        <ProgressBar
          value={percent}
          label={`${t('Step {current} of {total}', {
            current: current.number,
            total: REFLECTION_STEP_COUNT,
          })}: ${t(current.en)}`}
        />

        <p className="text-gb-md text-fg-tertiary">{caption ?? t(current.en)}</p>
      </header>

      {children}
    </div>
  );
}

/**
 * One titled block of the form — "Thông tin cá nhân", "Điểm số", "Nguyện vọng".
 *
 * The frames set these headings in brand rose, which is unusual for a section
 * label and is why it is pinned here rather than left to each caller.
 */
export function ReflectionSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-gb-2xl rounded-gb-2xl bg-surface-muted p-gb-3xl">
      <h2 className="text-gb-lg font-semibold text-fg-brand">{title}</h2>
      <div className="flex flex-col gap-gb-2xl">{children}</div>
    </section>
  );
}
