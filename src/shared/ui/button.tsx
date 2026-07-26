import Link from 'next/link';

/**
 * Button — the Untitled UI `Buttons/Button` instance the Figma file uses
 * everywhere (nav actions, hero CTA, form submits).
 *
 * Measurements are the bound Figma variables: 12px / 8px padding, radius-md,
 * Text sm/Semibold, and `Shadows/shadow-xs-skeuomorphic` — the drop shadow plus
 * two inner shadows that give the kit its slight bevel. That bevel is easy to
 * mistake for noise and drop; it is in every button instance in the design.
 *
 * Renders an <a> when `href` is set and a <button> otherwise, because roughly
 * half the design's "buttons" navigate.
 */

export type ButtonVariant = 'primary' | 'primary-on-dark' | 'secondary' | 'secondary-on-dark';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const BASE =
  'inline-flex items-center justify-center gap-gb-xs rounded-gb-md font-semibold ' +
  'shadow-gb-xs-skeuomorphic transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ' +
  'disabled:pointer-events-none disabled:opacity-60';

const SIZES: Record<ButtonSize, string> = {
  /** 8 + 20 + 8 = 36px. The nav actions and most inline CTAs. */
  sm: 'px-gb-lg py-gb-md text-gb-sm',
  /** 40px flat, matching the mobile nav's stacked actions. */
  md: 'h-gb-5xl px-gb-xl text-gb-sm',
  /**
   * 12 + 20 + 12 = 44px on 14/20 text. The kit's `lg`, and the size the
   * saved-list scholarship bar uses (Figma 223:9677, drawn at h-44 with
   * px-12/py-8 — the 8 is the frame's own padding, not the text box's).
   */
  lg: 'px-gb-lg py-gb-lg text-gb-sm',
  /** 12 + 24 + 12 = 48px on 16/24 text. The Home hero CTA (Figma 104:7133). */
  xl: 'px-gb-btn-xl py-gb-lg text-gb-md',
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-hover',
  /*
   * Both primary instances in the design sit on the black bar/hero and carry a
   * 2px translucent white border. It is not decoration — without it the rose
   * fill bleeds into pure black at the edges.
   */
  'primary-on-dark': 'border-2 border-white/12 bg-brand text-on-brand hover:bg-brand-hover',
  secondary: 'border border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover',
  /*
   * Same white fill as `secondary`, but on the black nav bar the design swaps
   * the grey border for a 2px translucent white one — a grey hairline
   * disappears against black.
   */
  'secondary-on-dark': 'border-2 border-white/12 bg-surface text-fg-secondary hover:bg-surface-hover',
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
};

type Props = CommonProps &
  (
    | ({ href: string } & Omit<React.ComponentProps<typeof Link>, 'href' | 'className' | 'children'>)
    | ({ href?: undefined } & Omit<React.ComponentProps<'button'>, 'className' | 'children'>)
  );

export function Button({ variant = 'primary', size = 'sm', className, children, ...rest }: Props) {
  const classes = `${BASE} ${SIZES[size]} ${VARIANTS[variant]}${className ? ` ${className}` : ''}`;

  if (rest.href !== undefined) {
    const { href, ...linkProps } = rest;
    return (
      <Link href={href} className={classes} {...linkProps}>
        {children}
      </Link>
    );
  }

  // `href` is statically undefined on this branch; strip it so it never lands
  // on the DOM node as an attribute.
  const buttonProps: Omit<typeof rest, 'href'> = rest;
  return (
    <button type="button" className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
