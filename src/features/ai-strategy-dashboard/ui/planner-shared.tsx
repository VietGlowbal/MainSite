'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import type { Recommendation } from '../domain';
import {
  DEADLINE_MAX,
  DEADLINE_MIN,
  dueLabel,
  dueTone,
  isPlannerDeadline,
  recommendationHelp,
} from '../domain';
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
 * ─── TYPING A YEAR BY HAND ───────────────────────────────────────────────────
 *
 * A native date input is three segments, and it publishes a value the instant
 * all three hold something. Typing the year of 03/03/2026 therefore walks the
 * value through `0002-03-03` → `0020-03-03` → `0202-03-03` → `2026-03-03`,
 * firing a change event at every step. Two earlier decisions turned that into
 * a bug that made the year impossible to enter at all:
 *
 *   1. Every change was treated as a committed edit, so the first year digit
 *      PATCHed year 2 — a shape the old `YYYY-MM-DD` regex was happy with.
 *   2. That save set `disabled` on the input. **A disabled element loses
 *      focus**, so the segment editor closed and the remaining three digits
 *      went nowhere. The student was left staring at `03/03/0002`, saved.
 *
 * So this control now:
 *
 *   - commits only a value `isPlannerDeadline` accepts (a real calendar day
 *     between `DEADLINE_MIN` and `DEADLINE_MAX`) or an empty one, which means
 *     the half-typed years above are simply not events;
 *   - never disables itself, so focus stays where the student put it. Ordering
 *     — the reason `disabled` was there — moved to `usePlannerRecommendations`,
 *     which owns the state and the request and can serialize the second without
 *     freezing the first's input;
 *   - holds an editing draft rather than rendering the prop straight, so a
 *     re-render mid-edit cannot reset the segment the student is in. The prop
 *     still wins whenever it changes underneath (a calendar drag, a rollback).
 *
 * `min`/`max` mirror the same window into the native picker, so the browser's
 * own arrows and its `:invalid` styling agree with what will actually save.
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
  const [draft, setDraft] = useState(deadline ?? '');
  const [lastDeadline, setLastDeadline] = useState(deadline ?? '');
  const hintId = useId();

  /* Adjusting state during render, not in an effect: the draft has to follow
     an externally changed deadline (calendar drag, failed-save rollback)
     without a flash of the stale one, and without clobbering an edit in
     progress — this only runs when the prop itself moved. */
  if ((deadline ?? '') !== lastDeadline) {
    setLastDeadline(deadline ?? '');
    setDraft(deadline ?? '');
  }

  /** Not yet a date we would save — mid-typing, or outside the window. */
  const unsaved = draft !== '' && !isPlannerDeadline(draft);

  function handleChange(value: string) {
    setDraft(value);
    if (value !== '' && !isPlannerDeadline(value)) return;
    if (value === (deadline ?? '')) return;
    /* Straight through, every time. Ordering two saves for the same row is
       `usePlannerRecommendations`'s job, not this control's — see its module
       doc. Holding a queue here would have deferred the optimistic update
       along with the request, so a correction typed during a slow save would
       not have reached the calendar or the "days left" chip until it landed. */
    void onChange(value === '' ? null : value);
  }

  return (
    <span className="flex flex-col gap-gb-xxs">
      <input
        type="date"
        aria-label={label}
        min={DEADLINE_MIN}
        max={DEADLINE_MAX}
        value={draft}
        aria-invalid={unsaved || undefined}
        aria-describedby={unsaved ? hintId : undefined}
        onChange={(event) => handleChange(event.target.value)}
        className="rounded-gb-md border border-line bg-surface px-gb-md py-gb-xs text-gb-xs font-medium text-fg shadow-gb-xs hover:border-line-strong focus:border-brand focus:outline-none transition-all"
      />
      {unsaved ? (
        /* Never fail silently: without this, a student who typed a two-digit
           year and moved on would see the date sitting in the field and
           assume it saved. */
        <span id={hintId} className="max-w-[12rem] text-gb-xs text-fg-tertiary">
          Enter a four-digit year to save this deadline.
        </span>
      ) : null}
    </span>
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
