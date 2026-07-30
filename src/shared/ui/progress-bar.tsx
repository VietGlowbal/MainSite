/**
 * ProgressBar — a horizontal track, either measuring something or plainly busy.
 *
 * WHY BOTH MODES LIVE HERE. The two are the same object to a user, and keeping
 * them together is what stops the indeterminate one being faked with a
 * determinate bar animated to 90%. That fake is the standard way progress bars
 * become untrustworthy: it always stalls just short of done, and a student who
 * has seen it once reads every later bar as decoration.
 *
 * So: pass a `value` when there is a real fraction to show, and omit it when
 * there is not. Omitting it gives a travelling segment that sweeps the track —
 * honest about "running", silent about "how much longer".
 *
 * ACCESSIBILITY. `role="progressbar"` either way. With a value it carries the
 * usual min/max/now trio; without one it carries no `aria-valuenow`, which is
 * precisely how ARIA spells "indeterminate" — assistive tech announces it as
 * busy rather than inventing a percentage. `label` is required in both cases
 * because a bare bar announces as "progress bar" and nothing else.
 */
export function ProgressBar({
  value,
  label,
  size = 'md',
  className,
}: {
  /**
   * Completion as a percentage, 0–100. Omit for indeterminate.
   *
   * Clamped rather than trusted: these come from task counts, and a rounding
   * error that renders a bar 3% past its track is a visible bug.
   */
  value?: number | undefined;
  /** Accessible name. What the bar is measuring, e.g. "Checklist progress". */
  label: string;
  size?: 'sm' | 'md';
  className?: string | undefined;
}) {
  const height = size === 'sm' ? 'h-gb-sm' : 'h-gb-md';
  const indeterminate = value === undefined;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      {...(indeterminate ? {} : { 'aria-valuenow': clamp(value) })}
      className={`${height} w-full overflow-hidden rounded-gb-full bg-surface-muted ${className ?? ''}`}
    >
      {indeterminate ? (
        /* Reduced motion gets a static third-width segment rather than nothing:
           an empty track reads as "0% and stuck", which is the opposite of what
           this state means. */
        <div className="animate-gb-progress-sweep h-full w-2/5 rounded-gb-full bg-brand motion-reduce:w-1/3 motion-reduce:animate-none" />
      ) : (
        <div
          className="h-full rounded-gb-full bg-brand transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${clamp(value)}%` }}
        />
      )}
    </div>
  );
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
