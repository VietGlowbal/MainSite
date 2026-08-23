'use client';

import { useState } from 'react';
import type { ProgressStatus, Recommendation } from '../domain';
import { KANBAN_COLUMNS, KANBAN_COLUMN_LABEL, groupByStatus } from '../domain';
import { BoardMobile } from './board-mobile';
import { TaskCard } from './planner-shared';
import { useMediaQuery } from './use-media-query';
import type { PlannerRecommendationsController } from './use-planner-recommendations';

/**
 * Application Planner — board view, from the supplied mockup's kanban.
 *
 * ─── ONE DOMAIN, TWO PRESENTATIONS (Part 5.2 + 5.3) ──────────────────────────
 *
 * This component is now a dispatcher. The shared controller's `recommendations`
 * and `onStatusChange` flow unchanged into whichever presentation the viewport
 * asks for: the ≥768px grid below or `BoardMobile`'s single-active-column
 * surface for narrow screens. Neither presentation owns data or mutations —
 * both read the same array and call the same `onStatusChange`, so a status
 * change made on either surface reaches the list and calendar identically,
 * with the hook's optimism and rollback intact.
 *
 * DESKTOP IS THE HYDRATION DEFAULT: `useMediaQuery` seeds `true` on the server
 * and first client paint, so the markup that hydrates is always this grid; a
 * narrow viewport then swaps to `BoardMobile` in an effect — an ordinary
 * post-hydration update, never a mismatch. The mobile selection state lives
 * inside `BoardMobile`, so seeding it cannot alter what the desktop tree
 * renders.
 *
 * ─── FIVE COLUMNS, NOT THE MOCKUP'S FOUR ─────────────────────────────────────
 *
 * The design draws Todo / Inprocess / Review / Done. `ProgressStatus` has a
 * fifth value, `blocked`, and a board that omitted it would make a blocked
 * task disappear entirely — the one task most needing attention. It sits
 * last, after Done, because it is an exception rather than a later stage.
 * See KANBAN_COLUMNS in domain/planner.ts.
 *
 * ─── DRAG IS OPTIMISTIC, AND PUTS THE CARD BACK IF THE SAVE FAILS ────────────
 *
 * `onStatusChange` — `usePlannerRecommendations().updateStatus` — moves the
 * card immediately and PATCHes in the background, so a status change does
 * not wait for the round trip and feel broken on a slow connection. The
 * optimism, the PATCH, and the rollback-on-failure all live in that shared
 * hook rather than here, which is also what makes a drag on the board show
 * up on the list and the calendar without a reload — see the hook's comment.
 * Mobile gets the same mutation through each card's own `<select>` — see
 * `BoardMobile`; drag stays a desktop shortcut, never the only way.
 *
 * Native HTML5 drag rather than a library — the stack is fixed (CLAUDE.md),
 * and this is the case the native API handles well. Keyboard users are not
 * stranded: every card opens its detail page, where the same status is an
 * ordinary control.
 */
export function PlannerBoard({
  applicationId,
  recommendations,
  onStatusChange,
}: {
  applicationId: string;
  recommendations: readonly Recommendation[];
  onStatusChange: PlannerRecommendationsController['updateStatus'];
}) {
  const isDesktop = useMediaQuery('(min-width: 768px)', true);

  if (isDesktop) {
    return (
      <PlannerBoardDesktop
        applicationId={applicationId}
        recommendations={recommendations}
        onStatusChange={onStatusChange}
      />
    );
  }

  return (
    <BoardMobile
      applicationId={applicationId}
      recommendations={recommendations}
      onStatusChange={onStatusChange}
    />
  );
}

const STATUS_ACCENTS: Record<ProgressStatus, { dot: string }> = {
  not_started: { dot: 'bg-slate-400' },
  in_progress: { dot: 'bg-blue-500' },
  needs_review: { dot: 'bg-amber-500' },
  completed: { dot: 'bg-emerald-500' },
  blocked: { dot: 'bg-rose-500' },
};

/**
 * The ≥768px kanban grid — DOM identical to the pre-5.3 single-tree version:
 * one section per status with its header, live count, cards and empty-column
 * drop target. The drag state is scoped here so the mobile tree never mounts
 * it.
 */
function PlannerBoardDesktop({
  applicationId,
  recommendations,
  onStatusChange,
}: {
  applicationId: string;
  recommendations: readonly Recommendation[];
  onStatusChange: PlannerRecommendationsController['updateStatus'];
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<ProgressStatus | null>(null);

  const columns = groupByStatus(recommendations);

  return (
    <div className="flex flex-col gap-gb-lg bg-surface-muted/20">
      <div className="grid gap-gb-md p-gb-lg md:grid-cols-3 xl:grid-cols-5">
        {KANBAN_COLUMNS.map((status) => {
          const items = columns[status];
          const isTarget = overColumn === status;
          const meta = STATUS_ACCENTS[status];

          return (
            <section
              key={status}
              onDragOver={(event) => {
                // Without preventDefault the browser refuses the drop outright.
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setOverColumn(status);
              }}
              onDragLeave={() => setOverColumn((current) => (current === status ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                const id = draggingId ?? event.dataTransfer.getData('text/plain');
                setOverColumn(null);
                setDraggingId(null);
                if (id) void onStatusChange(id, status);
              }}
              className={`flex min-h-[22rem] flex-col gap-gb-md rounded-gb-2xl border p-gb-md transition-all shadow-2xs ${
                isTarget
                  ? 'border-brand bg-brand-subtle/40 ring-2 ring-brand/20'
                  : 'border-line bg-surface-muted/60'
              }`}
            >
              <header className="flex items-center justify-between pb-gb-xs border-b border-line">
                <div className="flex items-center gap-gb-xs">
                  <span className={`size-2 rounded-full ${meta.dot}`} aria-hidden="true" />
                  <h3 className="text-gb-sm font-bold text-fg">
                    {KANBAN_COLUMN_LABEL[status]}
                  </h3>
                </div>
                <span className="rounded-gb-full bg-surface px-gb-sm py-gb-xxs text-gb-xs font-bold text-fg-tertiary border border-line shadow-2xs">
                  {items.length}
                </span>
              </header>

              <div className="flex flex-col gap-gb-sm flex-1">
                {items.map((rec) => (
                  <TaskCard
                    key={rec.id}
                    recommendation={rec}
                    applicationId={applicationId}
                    onDragStart={setDraggingId}
                  />
                ))}
                {items.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center rounded-gb-xl border border-dashed border-line/80 bg-surface/30 p-gb-md text-center text-gb-xs text-fg-muted">
                    Drop a task here
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
