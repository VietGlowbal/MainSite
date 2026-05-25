/**
 * Glowbal EmptyState — warm, intentional empty-state component.
 *
 * Replaces the bare "No results" / "Nothing here yet" plaintext that used
 * to sit alone on otherwise blank pages. Pairs an emoji-led headline with
 * a one-line guidance message and an optional primary action.
 *
 * Design principles:
 *   - Always show a next step ("Reset filters", "Add a deadline", …)
 *   - Use friendly, confident microcopy — never apologetic
 *   - Keep the visual height bounded; this is a reset point, not a hero
 */

import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** Single emoji or small illustration. Decorative — receives aria-hidden. */
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Primary call-to-action — usually a Button. */
  action?: ReactNode;
  /** Optional secondary action shown alongside the primary one. */
  secondaryAction?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-[1.5rem] border border-slate-200 bg-white px-6 py-12 text-center shadow-[0_8px_24px_rgba(30,40,80,0.04)] ${className}`}
    >
      {icon ? (
        <div aria-hidden className="mb-4 text-4xl leading-none">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p>
      ) : null}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
