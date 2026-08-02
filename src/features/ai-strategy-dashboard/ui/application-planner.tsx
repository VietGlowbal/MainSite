'use client';

import { useMemo, useState } from 'react';
import type { ProgressStatus, Recommendation } from '../domain';
import {
  PLANNER_VIEWS,
  PLANNER_VIEW_LABEL,
  PROGRESS_STATUS_LABEL,
  matchesQuery,
  sortByPriority,
  type PlannerView,
} from '../domain';
import { PlannerBoard } from './planner-board';
import { PlannerCalendar } from './planner-calendar';
import { PlannerList } from './planner-list';

/**
 * Application Planner — the shell from the supplied mockups: a title, the
 * view switcher, a search-and-filter toolbar, and whichever of the three
 * views is selected.
 *
 * ─── ONE FILTERED SET, THREE VIEWS ───────────────────────────────────────────
 *
 * Search and the status filter are applied HERE, above the view, so all three
 * are looking at the same tasks. Filtering inside each view would let the list
 * and the board disagree about how many tasks exist, which is the kind of
 * difference a student notices and cannot explain.
 *
 * The board is the one exception to the status filter, and deliberately: its
 * columns ARE the statuses, so filtering to one status would leave four empty
 * columns and one full. The control is hidden rather than ignored on that
 * view, so it never looks like it is on and doing nothing.
 *
 * ─── VIEW STATE IS LOCAL, NOT IN THE URL ─────────────────────────────────────
 *
 * Deliberate for now: the three views are a way of looking at one plan, not
 * three destinations, and a student switching to the board and back does not
 * expect that in their history. If sharing a link to "my board" becomes a real
 * need, this is one `useSearchParams` away — but the page is a server
 * component today and adding a query param would make it dynamic, which is a
 * cost worth paying only for a feature someone asked for.
 *
 * ─── `today` IS A PROP ───────────────────────────────────────────────────────
 *
 * Passed in rather than `new Date()` here, so the server and the client agree
 * on what day it is. Computing it during render would give a different answer
 * on each side and hydrate mismatched — the exact bug that makes "3d left"
 * flicker to "2d left" on load.
 */
export function ApplicationPlanner({
  applicationId,
  recommendations,
  today,
}: {
  applicationId: string;
  recommendations: readonly Recommendation[];
  today: Date;
}) {
  const [view, setView] = useState<PlannerView>('list');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProgressStatus | 'all'>('all');

  const filtered = useMemo(() => {
    const matching = recommendations.filter(
      (rec) =>
        matchesQuery(rec, query) &&
        // The board ignores the status filter — see the header.
        (view === 'kanban' || statusFilter === 'all' || rec.status === statusFilter),
    );
    return sortByPriority(matching);
  }, [recommendations, query, statusFilter, view]);

  if (recommendations.length === 0) {
    return (
      <section className="rounded-gb-2xl border border-line bg-surface p-gb-4xl">
        <h2 className="font-display text-gb-xl font-semibold text-fg">Application Planner</h2>
        <p className="mt-gb-md text-gb-sm text-fg-tertiary">
          No tasks yet. Once your strategy has been analysed, everything it recommends appears here
          as a plan you can work through.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-gb-xl">
      <div className="flex flex-wrap items-center justify-between gap-gb-lg">
        <h2 className="font-display text-gb-display-xs font-semibold text-fg">
          Application Planner
        </h2>

        {/* View switcher — the segmented control from the mockup. */}
        <div
          role="tablist"
          aria-label="Planner view"
          className="flex items-center gap-gb-xxs rounded-gb-lg border border-line bg-surface-muted p-gb-xxs"
        >
          {PLANNER_VIEWS.map((candidate) => {
            const isActive = view === candidate;
            return (
              <button
                key={candidate}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setView(candidate)}
                className={`rounded-gb-md px-gb-xl py-gb-sm text-gb-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  isActive
                    ? 'bg-surface text-fg shadow-gb-xs'
                    : 'text-fg-muted hover:text-fg-secondary'
                }`}
              >
                {PLANNER_VIEW_LABEL[candidate]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-gb-2xl border border-line bg-surface">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-gb-lg border-b border-line p-gb-xl">
          <label className="flex min-w-[14rem] flex-1 items-center gap-gb-md rounded-gb-lg border border-line px-gb-lg py-gb-sm focus-within:border-brand">
            <span className="sr-only">Search tasks</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks"
              className="w-full bg-transparent text-gb-sm text-fg outline-none placeholder:text-fg-muted"
            />
          </label>

          {/* Hidden on the board, where the columns already are the statuses. */}
          {view === 'kanban' ? null : (
            <label className="flex items-center gap-gb-md">
              <span className="text-gb-sm text-fg-tertiary">Status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as ProgressStatus | 'all')
                }
                className="rounded-gb-lg border border-line bg-surface px-gb-lg py-gb-sm text-gb-sm text-fg focus:border-brand focus:outline-none"
              >
                <option value="all">All</option>
                {(Object.keys(PROGRESS_STATUS_LABEL) as ProgressStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {PROGRESS_STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </label>
          )}

          <span className="text-gb-sm text-fg-muted">
            {filtered.length} of {recommendations.length}
          </span>
        </div>

        {view === 'list' ? (
          <PlannerList
            applicationId={applicationId}
            recommendations={filtered}
            today={today}
          />
        ) : null}
        {view === 'calendar' ? (
          <PlannerCalendar
            applicationId={applicationId}
            recommendations={filtered}
            today={today}
          />
        ) : null}
        {view === 'kanban' ? (
          <PlannerBoard applicationId={applicationId} recommendations={filtered} />
        ) : null}
      </div>
    </section>
  );
}
