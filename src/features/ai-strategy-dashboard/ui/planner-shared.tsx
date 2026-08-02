'use client';

import Link from 'next/link';
import type { Recommendation } from '../domain';
import { SEEDED_CATEGORIES, dueLabel, dueTone, type DueTone } from '../domain';
import { Badge, type BadgeVariant } from '@/shared/ui';

/**
 * Pieces shared by all three Application Planner views — the task card, the
 * priority and due-date chips, the category name.
 *
 * One definition each, because the three views are three renderings of the
 * same tasks: a priority that reads "High" in the list and "Urgent" on the
 * board would be a bug a student could see, and keeping the mapping here is
 * what stops it.
 */

export const PRIORITY_VARIANT: Record<Recommendation['priority'], BadgeVariant> = {
  urgent: 'reach',
  high: 'reach',
  medium: 'recommend',
  low: 'neutral',
};

export const PRIORITY_LABEL: Record<Recommendation['priority'], string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function categoryLabel(key: string | null): string {
  if (!key) return 'General';
  return SEEDED_CATEGORIES.find((category) => category.key === key)?.label ?? key;
}

/** Text colour for the "days left" cell. Overdue and due-today are the two a
    student needs to spot without reading, so only those two carry colour. */
const DUE_TONE_CLASS: Record<DueTone, string> = {
  overdue: 'text-fg-error font-semibold',
  today: 'text-fg-brand font-semibold',
  soon: 'text-fg-secondary',
  later: 'text-fg-tertiary',
  none: 'text-fg-muted',
};

export function DueChip({ days }: { days: number | null }) {
  return <span className={`text-gb-sm ${DUE_TONE_CLASS[dueTone(days)]}`}>{dueLabel(days)}</span>;
}

/** `2026-08-14` → `14 Aug 2026`. UTC, for the reason given in domain/planner.ts. */
export function formatDate(iso: string | null): string {
  if (iso === null) return '—';
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * One task, as it appears on the board and on the calendar.
 *
 * DRAGGABLE VIA NATIVE HTML5, not a library. The stack is fixed (CLAUDE.md),
 * and card-onto-column is exactly what the native API handles well. Its known
 * weakness — no keyboard equivalent — is covered elsewhere rather than
 * ignored: every card links through to its detail page, where the same status
 * and date can be changed with ordinary form controls. The drag is the
 * shortcut, never the only way.
 */
export function TaskCard({
  recommendation,
  applicationId,
  onDragStart,
  compact = false,
}: {
  recommendation: Recommendation;
  applicationId: string;
  onDragStart: (id: string) => void;
  /** Calendar cells are small: drop the reason and the chips. */
  compact?: boolean;
}) {
  return (
    <article
      draggable
      onDragStart={(event) => {
        // `setData` is what makes the drag valid in Firefox; the id in state
        // is what the drop handler actually reads.
        event.dataTransfer.setData('text/plain', recommendation.id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart(recommendation.id);
      }}
      className={`group cursor-grab rounded-gb-lg border border-line bg-surface shadow-gb-xs transition-shadow hover:shadow-gb-lg active:cursor-grabbing ${
        compact ? 'p-gb-md' : 'p-gb-lg'
      }`}
    >
      <Link
        href={`/ai-strategy/${applicationId}/strategy/recommendations/${recommendation.id}`}
        className="flex flex-col gap-gb-md rounded-gb-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        // A click that ends a drag should not also open the task.
        draggable={false}
      >
        <p
          className={`font-semibold text-fg ${compact ? 'line-clamp-2 text-gb-xs' : 'text-gb-sm'}`}
        >
          {recommendation.title}
        </p>

        {compact ? null : (
          <>
            {recommendation.reason ? (
              <p className="line-clamp-2 text-gb-xs text-fg-tertiary">{recommendation.reason}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-gb-md">
              <Badge variant={PRIORITY_VARIANT[recommendation.priority]}>
                {PRIORITY_LABEL[recommendation.priority]}
              </Badge>
              <span className="text-gb-xs text-fg-muted">
                {categoryLabel(recommendation.category)}
              </span>
              {recommendation.estimatedImpact != null ? (
                <span className="text-gb-xs font-medium text-fg-brand">
                  +{recommendation.estimatedImpact}
                </span>
              ) : null}
            </div>
          </>
        )}
      </Link>
    </article>
  );
}
