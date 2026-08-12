'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Recommendation } from '../domain';
import { dueLabel, dueTone, recommendationHelp } from '../domain';
import {
  DUE_TONE_CLASS,
  PRIORITY_LABEL,
  PRIORITY_VARIANT,
  categoryLabel,
} from './planner-presentation';
import { Badge, KitIcon, type KitIconArt } from '@/shared/ui';

/**
 * The Application Planner's shared React components — the task card, the
 * due-date chip, the deadline control, the help link.
 *
 * The priority/status/category mappings these render with live next door in
 * `planner-presentation.ts`, NOT here. This file is `'use client'`, and the
 * task detail page and `dashboard-summary.tsx` are server components that
 * need the same mappings — importing them across that boundary throws on
 * call and silently yields `undefined` on property access. See that file's
 * header comment and `docs/known-issues.md §5l`.
 */

/**
 * A colour-toned circle around a `KitIcon` — the Planner hero's Next
 * Priority/Final Deadline stats and the category board's per-category icon.
 * Three tones only, matching the token pairs `Badge`'s chip variants already
 * use (`brand-subtle`/`fg-brand`, `info-subtle`/`fg-info`,
 * `tier-safe`/`on-tier-safe`) — no new colour is introduced at this layer,
 * matching the rule `Panel`'s header comment sets for this feature slice.
 */
const ICON_CIRCLE_TONE = {
  brand: 'bg-brand-subtle text-fg-brand',
  info: 'bg-info-subtle text-fg-info',
  safe: 'bg-tier-safe text-on-tier-safe',
} as const;

export function IconCircle({
  icon,
  tone,
  size = 48,
}: {
  icon: KitIconArt;
  tone: keyof typeof ICON_CIRCLE_TONE;
  size?: number;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-gb-full ${ICON_CIRCLE_TONE[tone]}`}
      style={{ width: size, height: size }}
    >
      <KitIcon art={icon} frame={Math.round(size * 0.42)} />
    </div>
  );
}

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
