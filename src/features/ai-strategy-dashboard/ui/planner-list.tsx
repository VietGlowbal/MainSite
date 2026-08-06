'use client';

import Link from 'next/link';
import type { Recommendation } from '../domain';
import { daysRemaining } from '../domain';
import {
  DeadlineControl,
  DueChip,
  HelpLink,
  PRIORITY_LABEL,
  PRIORITY_VARIANT,
  categoryLabel,
  categoryVariant,
  formatDate,
} from './planner-shared';
import { ProgressStatusControl } from './progress-status-control';
import type { PlannerRecommendationsController } from './use-planner-recommendations';
import { Badge } from '@/shared/ui';

/**
 * Application Planner — list view, from the supplied mockup's table.
 *
 * ─── TWO COLUMNS IN THE MOCKUP HAVE NO FIELD BEHIND THEM ─────────────────────
 *
 * Documented in full in domain/planner.ts; the short version:
 *
 *   - "Cấp độ" (Phase / Step / Micro Step) has no equivalent — recommendations
 *     are a flat list with a `category`, not a hierarchy. That column shows
 *     the category, which is the grouping the rest of the Strategy already
 *     uses.
 *   - "Ngày bắt đầu" (start date) is not recorded anywhere. The column shows
 *     `created_at` and is labelled **Added**, because that is what the value
 *     is — the day the task was generated, not the day work began on it.
 *
 * Both are honest substitutions rather than blanks: the column is useful and
 * the header does not overstate it. Real Phase/Step levels and a real start
 * date are schema work, not UI work.
 *
 * ─── STATUS IS THE SHARED CONTROL ────────────────────────────────────────────
 *
 * The mockup draws status as a coloured pill (Processing / Success /
 * Declined). Ours is `ProgressStatusControl`, the same control the board and
 * the detail page use, so a change made in any of the three cannot disagree
 * with the others. The five real statuses also carry more than the mockup's
 * three — "Needs review" and "Blocked" are states a student is genuinely in,
 * and collapsing them into "Declined" would lose the difference between
 * "waiting on someone" and "cannot start this".
 *
 * `ProgressStatusControl` PATCHes itself (it also runs standalone on the
 * detail page, which has no shared planner state to update); `onStatusSaved`
 * — `usePlannerRecommendations().syncStatus` — only records that result into
 * the array the board and the calendar also read from, so a change made here
 * shows up there without a second PATCH.
 *
 * ─── THE DEADLINE COLUMN IS NOW HOW A STUDENT SETS ONE ───────────────────────
 *
 * Previously read-only: the calendar was the only place a deadline could be
 * given, by dragging a card onto a day. `DeadlineControl` is a plain date
 * input wired to `onDeadlineChange` — `updateDeadline` — so typing a date
 * here PATCHes it exactly like a drag does, and the task appears on that day
 * on the calendar immediately, no reload required. Clearing the field (its
 * native "x", or deleting the text) unschedules it back into the calendar's
 * tray, same as dragging it off a day.
 */
export function PlannerList({
  applicationId,
  recommendations,
  today,
  onDeadlineChange,
  onStatusSaved,
}: {
  applicationId: string;
  recommendations: readonly Recommendation[];
  today: Date;
  onDeadlineChange: PlannerRecommendationsController['updateDeadline'];
  onStatusSaved: PlannerRecommendationsController['syncStatus'];
}) {
  if (recommendations.length === 0) {
    return (
      <p className="px-gb-3xl py-gb-6xl text-center text-gb-sm text-fg-tertiary">
        Nothing matches those filters.
      </p>
    );
  }

  return (
    /* The table scrolls sideways inside its own container rather than pushing
       the page wide — seven columns do not fit a narrow laptop otherwise. */
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-line bg-surface-muted">
            <th scope="col" className="px-gb-xl py-gb-lg">
              <span className="sr-only">Completed</span>
            </th>
            <th scope="col" className="px-gb-xl py-gb-lg text-gb-xs font-semibold uppercase tracking-wide text-fg-brand">
              Category
            </th>
            <th scope="col" className="px-gb-xl py-gb-lg text-gb-xs font-semibold uppercase tracking-wide text-fg-brand">
              Task
            </th>
            <th scope="col" className="px-gb-xl py-gb-lg text-gb-xs font-semibold uppercase tracking-wide text-fg-brand">
              Priority
            </th>
            <th scope="col" className="px-gb-xl py-gb-lg text-gb-xs font-semibold uppercase tracking-wide text-fg-brand">
              Status
            </th>
            <th scope="col" className="px-gb-xl py-gb-lg text-gb-xs font-semibold uppercase tracking-wide text-fg-brand">
              Added
            </th>
            <th scope="col" className="px-gb-xl py-gb-lg text-gb-xs font-semibold uppercase tracking-wide text-fg-brand">
              Deadline
            </th>
            <th scope="col" className="px-gb-xl py-gb-lg text-gb-xs font-semibold uppercase tracking-wide text-fg-brand">
              Remaining
            </th>
          </tr>
        </thead>
        <tbody>
          {recommendations.map((rec) => (
            <tr key={rec.id} className="border-b border-line last:border-b-0 hover:bg-surface-muted">
              <td className="px-gb-xl py-gb-lg align-top">
                {/* Read-only reflection of the Status column, not a second
                    control a student could set out of sync with it — see
                    the `STATUS_VARIANT`/`ProgressStatusControl` note. */}
                <span
                  aria-hidden="true"
                  className={`block h-gb-xl w-gb-xl rounded-gb-full border-2 ${
                    rec.status === 'completed'
                      ? 'border-tier-safe bg-tier-safe'
                      : 'border-line bg-surface'
                  }`}
                />
              </td>
              <td className="px-gb-xl py-gb-lg align-top">
                <Badge variant={categoryVariant(rec.category)}>{categoryLabel(rec.category)}</Badge>
              </td>

              <td className="px-gb-xl py-gb-lg align-top">
                <div className="flex max-w-md flex-col gap-gb-xxs">
                  <Link
                    href={`/ai-strategy/${applicationId}/strategy/recommendations/${rec.id}`}
                    className="flex flex-col gap-gb-xxs rounded-gb-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <span className="text-gb-sm font-semibold text-fg">{rec.title}</span>
                    {rec.reason ? (
                      <span className="line-clamp-1 text-gb-xs text-fg-tertiary">{rec.reason}</span>
                    ) : null}
                  </Link>
                  {/* The old table's "Help" column. Kept as a second link inside
                      the same cell rather than an eighth column — it resolves
                      to nothing on plenty of rows, so a whole column of dashes
                      bought nothing. Outside the title Link because nesting
                      anchors is invalid HTML. */}
                  <HelpLink
                    recommendation={rec}
                    applicationId={applicationId}
                    className="text-gb-xs"
                  />
                </div>
              </td>

              <td className="px-gb-xl py-gb-lg align-top">
                <Badge variant={PRIORITY_VARIANT[rec.priority]}>
                  {PRIORITY_LABEL[rec.priority]}
                </Badge>
              </td>

              <td className="px-gb-xl py-gb-lg align-top">
                <ProgressStatusControl
                  applicationId={applicationId}
                  recommendationId={rec.id}
                  status={rec.status}
                  label={`Status for ${rec.title}`}
                  onChange={(status) => onStatusSaved(rec.id, status)}
                />
              </td>

              <td className="px-gb-xl py-gb-lg align-top">
                <span className="whitespace-nowrap text-gb-sm text-fg-tertiary">
                  {formatDate(rec.createdAt.slice(0, 10))}
                </span>
              </td>

              <td className="px-gb-xl py-gb-lg align-top">
                <DeadlineControl
                  deadline={rec.deadline}
                  label={`Deadline for ${rec.title}`}
                  onChange={(deadline) => onDeadlineChange(rec.id, deadline)}
                />
              </td>

              <td className="px-gb-xl py-gb-lg align-top">
                <DueChip days={daysRemaining(rec.deadline, today)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
