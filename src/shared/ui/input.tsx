import { FormField, controlClasses } from './form-field';

/**
 * Input — Figma "Input field" (105:8028), the field used on every auth and
 * profile form in the design.
 *
 * `name` is required rather than optional: it doubles as the element id when
 * one is not given, which is what wires the label to the control. Deriving the
 * id instead of generating one keeps this a Server Component — `useId` would
 * force `'use client'` onto every form page that renders a text box.
 */

type Props = Omit<React.ComponentProps<'input'>, 'className' | 'name'> & {
  name: string;
  label?: string | undefined;
  hint?: string | undefined;
  /** Present => the control renders invalid and the hint is replaced. */
  error?: string | undefined;
  /** Applied to the <input>, not the wrapper. */
  className?: string | undefined;
  /** Applied to the wrapper. */
  fieldClassName?: string | undefined;
};

export function Input({
  label,
  hint,
  error,
  className,
  fieldClassName,
  required,
  ...rest
}: Props) {
  const id = rest.id ?? rest.name;
  const described = error ?? hint;

  return (
    <FormField
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={fieldClassName}
    >
      <input
        {...rest}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={described ? `${id}-message` : undefined}
        className={controlClasses(error != null, className)}
      />
    </FormField>
  );
}
