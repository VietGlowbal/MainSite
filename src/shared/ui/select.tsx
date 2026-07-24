import { FormField, controlClasses } from './form-field';
import { ICONS, KitIcon } from './icons';

/**
 * Select — Figma "Select" (105:8270 and siblings), the country / subject /
 * degree pickers on the universities page and the profile forms.
 *
 * A native <select> under kit styling rather than a custom listbox: it keeps
 * keyboard handling, mobile's native picker, and form submission for free, and
 * nothing in the design's closed state needs markup a native control cannot
 * produce.
 *
 * The multi-select with checkboxes and a "Select all" footer (105:8247) is a
 * genuinely different control and is NOT this component.
 *
 * `appearance-none` removes the platform arrow so the kit's chevron (2:384) can
 * take its place; `pr` is widened to leave room for it.
 */

type Props = Omit<React.ComponentProps<'select'>, 'className' | 'name'> & {
  name: string;
  label?: string | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  /** Shown as a disabled first option when the control has no value yet. */
  placeholder?: string | undefined;
  className?: string | undefined;
  fieldClassName?: string | undefined;
};

export function Select({
  label,
  hint,
  error,
  placeholder,
  className,
  fieldClassName,
  required,
  children,
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
      <div className="relative">
        <select
          {...rest}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={described ? `${id}-message` : undefined}
          className={controlClasses(
            error != null,
            className ? `appearance-none pr-gb-5xl ${className}` : 'appearance-none pr-gb-5xl',
          )}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {children}
        </select>
        {/* neutral-400 is the stroke the export carries (#A3A3A3). */}
        <span className="pointer-events-none absolute inset-y-0 right-gb-input-x flex items-center text-gb-neutral-400">
          <KitIcon art={ICONS.chevronDown} frame={16} />
        </span>
      </div>
    </FormField>
  );
}
