'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Recommendation } from '../domain';
import {
  SEEDED_CATEGORIES,
  dueLabel,
  dueTone,
  recommendationHelp,
  type DueTone,
} from '../domain';
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

/**
 * The list view's deadline cell — a plain date input, styled to match
 * `ProgressStatusControl`'s `<select>` so the two editable cells in the same
 * row read as one family of control.
 *
 * `onChange` is the list's route into `usePlannerRecommendations.updateDeadline`
 * — the same PATCH, the same optimism, the same rollback the calendar's drag
 * uses, just triggered by typing a date instead of dropping a card. Because
 * both write to the one shared array, a deadline set here appears on the
 * calendar (and its "days left" on the list itself) without a reload.
 *
 * Clearing the field sends `null` — the native date input's own "x" already
 * does this, so there is no separate clear button to build or explain.
 *
 * `disabled` while a save is in flight, the same reason `ProgressStatusControl`
 * disables its `<select>`: a second edit landing before the first PATCH
 * resolves could send the two out of order.
 */
export function DeadlineControl({
  deadline,
  label,
  onChange,
}: {
  deadline: string | null;
  /** Accessible name — the list passes the row's title. */
  label: string;
  onChange: (deadline: string | null) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  async function handleChange(value: string) {
    setSaving(true);
    try {
      await onChange(value === '' ? null : value);
    } finally {
      setSaving(false);
    }
  }

  return (
    <input
      type="date"
      aria-label={label}
      value={deadline ?? ''}
      disabled={saving}
      onChange={(event) => void handleChange(event.target.value)}
      className="rounded-gb-md border border-line bg-surface px-gb-md py-gb-xs text-gb-sm text-fg"
    />
  );
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
 * The "Help" link for a task — the workspace that finishes it.
 *
 * Carried over from the recommendation table this planner replaces. It does
 * NOT render `actionTarget` directly: that comes from the match-insights
 * prompt, and the model has never been told GlowBal's internal routes exist,
 * so it was almost always a dash. `recommendationHelp` resolves a first-party
 * tool from the row's pillar and falls back to the AI's link only when there
 * is no tool for the job. See domain/strategy-tool.ts.
 *
 * A first-party tool is a `next/link` — client-side nav, keeps the student
 * inside the Strategy. An external one is a plain anchor with the usual
 * new-tab safety.
 */
export function HelpLink({
  recommendation,
  applicationId,
  className,
}: {
  recommendation: Recommendation;
  applicationId: string;
  className?: string;
}) {
  const help = recommendationHelp(recommendation, applicationId);
  if (!help) return null;

  const classes = `self-start rounded-gb-sm font-semibold text-fg-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${className ?? ''}`;

  if (help.external) {
    return (
      <a href={help.href} target="_blank" rel="noopener noreferrer" className={classes}>
        {help.label}
      </a>
    );
  }

  return (
    <Link href={help.href} className={classes}>
      {help.label}
    </Link>
  );
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
