/**
 * Container — the fixed measure every section in the Figma file sits inside:
 * 1280px max width, 32px gutters on desktop.
 *
 * The mobile gutter is 16px, taken from the `container-padding-mobile` variable
 * on the mobile nav frame; the desktop 32px is `container-padding-desktop`.
 *
 * ⚠️ The class list is a constant, and that is load-bearing. It used to be
 * inline, ending `... px-gb-xl md:px-gb-4xl${className ? ...}`, and because
 * `md:px-gb-4xl` was touching the `${` with no space, Tailwind's scanner never
 * extracted it as a candidate and never emitted the rule. No error anywhere —
 * the class sat in the DOM doing nothing, and every section on the site kept
 * its 16px mobile gutter at all widths. Keep whole class strings apart from
 * interpolation.
 */
const CLASSES = 'mx-auto w-full max-w-gb-desktop px-gb-xl md:px-gb-4xl';
export function Container({
  as: Tag = 'div',
  className,
  children,
  ...rest
}: {
  as?: 'div' | 'section' | 'header' | 'footer' | 'nav';
  // `| undefined` is required by exactOptionalPropertyTypes: callers forward an
  // optional className straight through, and that is a `string | undefined`.
  className?: string | undefined;
  children: React.ReactNode;
  /**
   * Forwarded to the rendered element. Landmark elements need this: `as="nav"`
   * with no accessible name is an unlabelled landmark, and the label was being
   * silently swallowed before these were passed through.
   */
  id?: string | undefined;
  'aria-label'?: string | undefined;
  'aria-labelledby'?: string | undefined;
}) {
  return (
    <Tag {...rest} className={className ? `${CLASSES} ${className}` : CLASSES}>
      {children}
    </Tag>
  );
}
