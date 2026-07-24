import { FormField } from './form-field';

/**
 * Checkbox — Figma "_Checkbox base" (223:9431): a 24px square, 1px
 * border-primary, 4px radius.
 *
 * The design only draws the UNCHECKED state — the instance is an empty frame.
 * The checked fill below (brand + white tick) is therefore inferred from the
 * kit rather than copied from a frame, which is worth knowing before treating
 * it as signed off. The tick is drawn with `accent-color` rather than a custom
 * SVG so the control stays a real <input type="checkbox">: keyboard, form
 * submission and the indeterminate state all keep working.
 *
 * Used by the onboarding answer lists (câu 1–9) and the universities filters.
 */

type Props = Omit<React.ComponentProps<'input'>, 'className' | 'name' | 'type'> & {
  name: string;
  /** Sits to the right of the box, and is the click target. */
  label: string;
  /** Secondary line under the label — the "12 users" in Figma 223:9369. */
  description?: string | undefined;
  className?: string | undefined;
};

export function Checkbox({ label, description, className, ...rest }: Props) {
  const id = rest.id ?? `${rest.name}-${String(rest.value ?? label)}`;

  return (
    <div className={className ? `flex items-start gap-gb-md ${className}` : 'flex items-start gap-gb-md'}>
      <input
        {...rest}
        type="checkbox"
        id={id}
        className="mt-gb-xxs size-gb-3xl shrink-0 cursor-pointer rounded-gb-xs border border-line-strong accent-brand disabled:cursor-not-allowed disabled:opacity-60"
      />
      <label htmlFor={id} className="cursor-pointer select-none">
        <span className="block text-gb-sm font-medium text-fg">{label}</span>
        {description ? (
          <span className="block text-gb-sm text-fg-muted">{description}</span>
        ) : null}
      </label>
    </div>
  );
}

/**
 * CheckboxGroup — a labelled set of checkboxes.
 *
 * A <fieldset>, not a div: without it a screen reader reads each box's label in
 * isolation and never announces the question they answer, which on the
 * onboarding screens is the only context there is.
 */
export function CheckboxGroup({
  id,
  legend,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  legend: string;
  hint?: string | undefined;
  error?: string | undefined;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-gb-sm font-medium text-fg-secondary">{legend}</legend>
      <FormField id={id} hint={hint} error={error} className="mt-gb-sm">
        <div className={className ? `flex flex-col gap-gb-lg ${className}` : 'flex flex-col gap-gb-lg'}>
          {children}
        </div>
      </FormField>
    </fieldset>
  );
}
