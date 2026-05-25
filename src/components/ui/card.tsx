/**
 * Glowbal Card — standardised surface container.
 *
 * Three sizes / paddings to choose from:
 *   sm   compact stat cards / inline info
 *   md   default — university results, mentor results
 *   lg   page sections, forms, hero panels
 *
 * Padding controls vertical density. Pass `padding="none"` if you need a
 * full-bleed media area (e.g. cover image flush to the edge) and add your
 * own internal padding.
 */

import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Render a subtle bordered surface without the elevated shadow. */
  flat?: boolean;
  /** Make the card behave as an interactive surface (hover lift). */
  interactive?: boolean;
  children?: ReactNode;
}

const RADIUS: Record<NonNullable<CardProps['size']>, string> = {
  sm: 'rounded-2xl',     // 16px-ish
  md: 'rounded-[1.5rem]', // 24px
  lg: 'rounded-[2rem]',   // 32px
};

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  size = 'md',
  padding,
  flat,
  interactive,
  className = '',
  children,
  ...rest
}: CardProps) {
  const pad = padding ?? (size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md');

  const classes = [
    'bg-white border border-slate-200/80',
    RADIUS[size],
    PADDING[pad],
    flat ? '' : 'shadow-[0_12px_30px_rgba(30,40,80,0.06)]',
    interactive
      ? 'transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(30,40,80,0.10)]'
      : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
