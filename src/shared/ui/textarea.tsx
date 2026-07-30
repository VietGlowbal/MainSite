import { FormField, controlClasses } from './form-field';

/**
 * Textarea — the Input box (Figma I105:8028;3285:380392) with a free height.
 *
 * The design has no dedicated textarea frame; the SOP and reflection screens
 * (94:8622, 110:17958) use the same bordered box taller, which is what this is.
 * Same id-from-name rule as Input — see the note there.
 */

type Props = Omit<React.ComponentProps<'textarea'>, 'className' | 'name'> & {
  name: string;
  label?: string | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  className?: string | undefined;
  fieldClassName?: string | undefined;
};

export function Textarea({
  label,
  hint,
  error,
  className,
  fieldClassName,
  required,
  rows = 4,
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
      <textarea
        {...rest}
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={described ? `${id}-message` : undefined}
        className={controlClasses(error != null, className ? `resize-y ${className}` : 'resize-y')}
      />
    </FormField>
  );
}
