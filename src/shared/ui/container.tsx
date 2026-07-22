/**
 * Container — the fixed measure every section in the Figma file sits inside:
 * 1280px max width, 32px gutters on desktop.
 *
 * The mobile gutter is 16px, taken from the `container-padding-mobile` variable
 * on the mobile nav frame; the desktop 32px is `container-padding-desktop`.
 */
export function Container({
  as: Tag = 'div',
  className,
  children,
}: {
  as?: 'div' | 'section' | 'header' | 'footer' | 'nav';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag
      className={`mx-auto w-full max-w-gb-desktop px-gb-xl md:px-gb-4xl${className ? ` ${className}` : ''}`}
    >
      {children}
    </Tag>
  );
}
