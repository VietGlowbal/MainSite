import { FormField } from './form-field';

/**
 * Radio — the single-answer control on the onboarding questionnaire
 * (Figma 107:10066 through 118:10240, "câu 1" to "câu 9").
 *
 * Same box metrics as Checkbox but round, and the same caveat: the design draws
 * the unselected state only, so the selected fill is the kit's rather than a
 * frame's. `accent-color` for the same reason — it stays a real
 * <input type="radio">, so arrow-key navigation within the group keeps working,
 * which is the whole point of a radio group.
 */

type Props = Omit<React.ComponentProps<'input'>, 'className' | 'name' | 'type'> & {
  name: string;
  label: string;
  /** A node, not just a string — see the note on Checkbox's. */
  description?: React.ReactNode;
  className?: string | undefined;
};

export function Radio({ label, description, className, ...rest }: Props) {
  const id = rest.id ?? `${rest.name}-${String(rest.value ?? label)}`;

  return (
    <div className={className ? `flex items-start gap-gb-md ${className}` : 'flex items-start gap-gb-md'}>
      <input
        {...rest}
        type="radio"
        id={id}
        className="mt-gb-xxs size-gb-3xl shrink-0 cursor-pointer border border-line-strong accent-brand disabled:cursor-not-allowed disabled:opacity-60"
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
 * RadioGroup — the question wrapper on each onboarding step.
 *
 * `role` is left to the native radios: a <fieldset> with a <legend> already
 * gives the group an accessible name, and adding role="radiogroup" on top of
 * real inputs makes some screen readers announce the set twice.
 */
export function RadioGroup({
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
