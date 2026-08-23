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
    <div className="flex flex-col gap-gb-lg">
      <div className="grid gap-gb-lg p-gb-xl md:grid-cols-3 xl:grid-cols-5">
        {KANBAN_COLUMNS.map((status) => {
          const items = columns[status];
          const isTarget = overColumn === status;
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
              className={`flex min-h-[16rem] flex-col gap-gb-lg rounded-gb-xl border p-gb-lg transition-colors ${
                isTarget ? 'border-brand bg-brand-subtle' : 'border-line bg-surface-muted'
              }`}
            >
              <header className="flex items-center justify-between gap-gb-md">
                <h3 className="text-gb-sm font-semibold text-fg">{KANBAN_COLUMN_LABEL[status]}</h3>
                <span className="rounded-gb-full bg-surface px-gb-md py-gb-xxs text-gb-xs font-semibold text-fg-tertiary">
                  {items.length}
                </span>
              </header>

              <div className="flex flex-col gap-gb-md">
                {items.map((rec) => (
                  <TaskCard
                    key={rec.id}
                    recommendation={rec}
                    applicationId={applicationId}
                    onDragStart={setDraggingId}
                  />
                ))}
                {items.length === 0 ? (
                  <p className="rounded-gb-lg border border-dashed border-line px-gb-lg py-gb-2xl text-center text-gb-xs text-fg-muted">
                    Drop a task here
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
