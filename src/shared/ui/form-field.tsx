/**
 * FormField — the label / control / message stack from Figma's "Input field"
 * component (105:8028), which draws a 360x70 field as label + 6px + control.
 *
 * Split out from the controls themselves because Input, Textarea and Select all
 * wear exactly this chrome, and because the universities page needs it around a
 * control this file does not own (the subject multi-select, 105:8247).
 *
 * ⚠️ The error styling has no Figma source — no frame in the redesign draws an
 * invalid field. See the error-ramp note in tokens.css.
 */

export function FormField({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  /** Must match the control's id, or the label will not be clickable. */
  id: string;
  label?: string | undefined;
  /** Helper text under the control. Hidden while an error is showing. */
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className={className ? `flex flex-col gap-gb-sm ${className}` : 'flex flex-col gap-gb-sm'}>
      {label ? (
        <label htmlFor={id} className="text-gb-sm font-medium text-fg-secondary">
          {label}
          {required ? (
            <span className="text-fg-error" aria-hidden="true">
              {' *'}
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {/* One slot, not two: an error replaces the hint rather than stacking
          under it, so the control never jumps height between the two states. */}
      {error ? (
        <p id={`${id}-message`} className="text-gb-sm text-fg-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-message`} className="text-gb-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The control box every form primitive shares — Figma I105:8028;3285:380392.
 *
 * 14/10 padding on text-md/24 gives the 44px height the design uses for every
 * field and for the auth submit button next to them.
 *
 * Exported so a control this file does not own (a custom combobox trigger) can
 * sit flush with the real ones instead of approximating them.
 */
export const CONTROL_BASE =
  'w-full rounded-gb-md border bg-surface px-gb-input-x py-gb-input-y text-gb-md text-fg ' +
  'shadow-gb-xs transition-colors placeholder:text-fg-muted ' +
  'focus:outline-2 focus:outline-offset-0 focus:outline-brand ' +
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-fg-muted';

export const CONTROL_IDLE = 'border-line-strong';
export const CONTROL_INVALID = 'border-line-error focus:outline-line-error';

/** Pick the border treatment for a control. */
export function controlClasses(invalid: boolean, className?: string | undefined): string {
  const state = invalid ? CONTROL_INVALID : CONTROL_IDLE;
  return className ? `${CONTROL_BASE} ${state} ${className}` : `${CONTROL_BASE} ${state}`;
}
