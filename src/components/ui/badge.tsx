/**
 * Glowbal Badge — small status / trust pill.
 *
 * Tones map to product meaning:
 *   neutral   informational, default
 *   verified  emerald — verified data, secure payment, mentor verified
 *   match     pink — university match score
 *   info      cyan — informational signals (rank, region)
 *   warning   amber — pending, attention, deadlines
 *   success   green — saved / confirmed / completed
 *   danger    rose — errors / urgent
 *
 * Use Badge for short factual labels. For interactive filter chips, use
 * the Chip primitive instead (separate file).
 */

import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeTone =
  | 'neutral'
  | 'verified'
  | 'match'
  | 'info'
  | 'warning'
  | 'success'
  | 'danger';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  icon?: ReactNode;
  children: ReactNode;
}

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-slate-50 text-slate-600 border-slate-200',
  verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  match: 'bg-pink-50 text-pink-700 border-pink-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
};

const SIZE: Record<NonNullable<BadgeProps['size']>, string> = {
  sm: 'text-[0.65rem] px-2 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
};

export function Badge({
  tone = 'neutral',
  size = 'md',
  icon,
  className = '',
  children,
  ...rest
}: BadgeProps) {
  const classes = [
    'inline-flex items-center rounded-full border font-semibold whitespace-nowrap',
    TONE[tone],
    SIZE[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...rest}>
      {icon ? <span aria-hidden className="shrink-0">{icon}</span> : null}
      {children}
    </span>
  );
}

/**
 * VerifiedBadge — preset for the most common trust signal.
 * A small shield icon + label, intended for cards / hero strips.
 */
export function VerifiedBadge({
  label = 'Verified data',
  size = 'sm',
}: {
  label?: string;
  size?: BadgeProps['size'];
}) {
  return (
    <Badge
      tone="verified"
      size={size}
      icon={
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2L4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      }
    >
      {label}
    </Badge>
  );
}
