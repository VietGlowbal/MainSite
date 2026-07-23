import { Container } from './container';

/**
 * Section — the outer band every Home section sits in.
 *
 * The design alternates dark and light bands down the page (hero and the
 * partner-logo wall are black; metrics, features and FAQ are white), and each
 * band wraps the same 1280px `Container`. This exists so that alternation is
 * one prop rather than a colour class repeated nine times.
 *
 * Vertical padding defaults to 96px (`spacing-9xl`), which is what the hero
 * (Figma 104:7126) uses. Pass `padded={false}` for a section that needs to
 * control its own rhythm.
 */
export function Section({
  tone = 'light',
  padded = true,
  className,
  containerClassName,
  children,
}: {
  tone?: 'light' | 'dark';
  padded?: boolean;
  className?: string;
  containerClassName?: string;
  children: React.ReactNode;
}) {
  const band =
    tone === 'dark' ? 'bg-surface-inverse-strong text-white' : 'bg-surface text-fg';

  return (
    <section className={`${band}${padded ? ' py-gb-9xl' : ''}${className ? ` ${className}` : ''}`}>
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}
