import type { DueTone, ProgressStatus, Recommendation } from '../domain';
import { SEEDED_CATEGORIES } from '../domain';
import type { BadgeVariant } from '@/shared/ui';

/**
 * The Planner's pure presentation mappings — priority/status/category → the
 * `Badge` variant, label or class that renders it, plus the one date
 * formatter these surfaces share.
 *
 * ⚠️ THIS FILE MUST NEVER GAIN `'use client'`. That is the entire reason it
 * exists as a file separate from `planner-shared.tsx`.
 *
 * These mappings are needed on BOTH sides of the server/client boundary: the
 * three Planner views are client components, but the task detail page
 * (`app/ai-strategy/[applicationId]/strategy/recommendations/[recommendationId]`)
 * and `dashboard-summary.tsx` are server components, and a task's chips must
 * read identically wherever it appears. They used to live in
 * `planner-shared.tsx`, which is `'use client'` — and a `'use client'` module's
 * exports are not real values to a server component, they are client
 * references. The failure is asymmetric and that is what made it survive a
 * previous fix attempt:
 *
 *   - Calling one (`categoryLabel(...)`, `categoryVariant(...)`,
 *     `formatDate(...)`) THROWS: "Attempted to call categoryLabel() from the
 *     server but categoryLabel is on the client." Every task detail page 500'd,
 *     because a generated recommendation essentially always has a category.
 *   - Reading one (`PRIORITY_VARIANT[priority]`) does NOT throw — it silently
 *     evaluates to `undefined`, so the badge quietly renders with no variant
 *     and no label rather than failing loudly.
 *
 * A plain module with no directive is usable from both graphs, which is what
 * these need to be. Anything here must stay pure: no hooks, no state, no
 * event handlers, no JSX. The components that consume them stay in
 * `planner-shared.tsx`. See `docs/known-issues.md §5l`.
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

/**
 * Status → Badge variant, for the Planner's read-only status pills (the
 * hero and category cards' progress text, and the list's leading indicator).
 * `ProgressStatusControl` itself stays an editable `<select>` — this is only
 * for the places status is shown, not changed.
 */
export const STATUS_VARIANT: Record<ProgressStatus, BadgeVariant> = {
  not_started: 'neutral-chip',
  in_progress: 'info-chip',
  completed: 'safe-chip',
  needs_review: 'brand-chip',
  blocked: 'reach',
};

/**
 * The same colours as `STATUS_VARIANT`, as plain classes rather than a
 * `Badge`'s markup — `ProgressStatusControl` is a `<select>`, which can't be
 * wrapped in `Badge`'s `<span>` and stay a real form control.
 */
export const STATUS_SELECT_CLASS: Record<ProgressStatus, string> = {
  not_started: 'bg-surface-muted text-fg-muted',
  in_progress: 'bg-info-subtle text-fg-info',
  completed: 'bg-tier-safe text-on-tier-safe',
  needs_review: 'bg-brand-subtle text-fg-brand',
  blocked: 'bg-tier-reach text-on-tier-reach',
};

/**
 * Category → Badge variant, for the list view's Category column. Only the
 * three categories the Planner's hero board surfaces get a distinct colour;
 * everything else (Impact, Personal, CV/Portfolio, or an unrecognised key)
 * reads as a plain neutral pill rather than inventing more colours than the
 * hero board uses.
 */
const CATEGORY_VARIANT: Partial<Record<string, BadgeVariant>> = {
  academics: 'safe-chip',
  activities: 'info-chip',
  'personal-statement': 'brand-chip',
};

export function categoryVariant(key: string | null): BadgeVariant {
  if (!key) return 'neutral-chip';
  return CATEGORY_VARIANT[key] ?? 'neutral-chip';
}

/** Text colour for the "days left" cell. Overdue and due-today are the two a
    student needs to spot without reading, so only those two carry colour. */
export const DUE_TONE_CLASS: Record<DueTone, string> = {
  overdue: 'text-fg-error font-semibold',
  today: 'text-fg-brand font-semibold',
  soon: 'text-fg-secondary',
  later: 'text-fg-tertiary',
  none: 'text-fg-muted',
};

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
