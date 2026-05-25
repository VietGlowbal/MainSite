/**
 * Glowbal Button — the single source of truth for in-app button styles.
 *
 * Variants
 *   primary    pink/blue gradient — main CTAs (Search, Save, Book session)
 *   secondary  white with border — neutral actions (View details, More filters)
 *   dark       navy — admin / serious actions
 *   success    green — saved / confirmed states
 *   danger     red outline — destructive (delete, remove)
 *   ghost      transparent — subtle inline actions
 *
 * Sizes
 *   sm   36px / 12px text
 *   md   42px / 13–14px text   (default)
 *   lg   48px / 14–15px text
 *
 * The component renders <button> by default but accepts `as="a"` (or any
 * Link) via composition: pass children including a wrapping <Link/>, or use
 * the `asChild` pattern by spreading className on a custom element.
 *
 * Usage (in a Server Component or Client Component is fine; no client-only APIs):
 *
 *   <Button variant="primary">Save university</Button>
 *   <Button variant="secondary" size="sm" leftIcon={<SearchIcon/>}>Filters</Button>
 */

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'dark'
  | 'success'
  | 'danger'
  | 'ghost';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const VARIANT: Record<ButtonVariant, string> = {
  // Brand gradient — pink → soft pink. Use for one primary action per surface.
  primary:
    'text-white bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] shadow-[0_8px_22px_rgba(255,77,140,0.28)] hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(255,77,140,0.34)] focus-visible:ring-pink-300',
  // Calm neutral — used for "View details", "More filters", chip-style buttons.
  secondary:
    'text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-slate-300',
  // Heavy navy — admin/internal/serious.
  dark:
    'text-white bg-slate-900 hover:bg-slate-800 shadow-[0_6px_16px_rgba(15,23,42,0.18)] focus-visible:ring-slate-400',
  // Confirmed / saved.
  success:
    'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 focus-visible:ring-emerald-300',
  // Destructive (outline so it never competes with primary).
  danger:
    'text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 hover:border-rose-300 focus-visible:ring-rose-300',
  // Inline / very subtle.
  ghost:
    'text-slate-600 bg-transparent hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-300',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-xs',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-6 text-sm md:text-[0.95rem]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    leftIcon,
    rightIcon,
    fullWidth,
    className = '',
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const classes = [
    BASE,
    VARIANT[variant],
    SIZE[size],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
      {children}
      {rightIcon ? <span className="shrink-0">{rightIcon}</span> : null}
    </button>
  );
});
