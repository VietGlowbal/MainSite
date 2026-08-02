'use client';

import { useState } from 'react';
import type { ProgressStatus, Recommendation } from '../domain';
import { KANBAN_COLUMNS, KANBAN_COLUMN_LABEL, groupByStatus } from '../domain';
import { TaskCard } from './planner-shared';

/**
 * Application Planner — board view, from the supplied mockup's kanban.
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
 * Dropping a card moves it immediately and PATCHes in the background. A
 * status change that waited for the round trip would feel broken on a slow
 * connection — the card would sit under the cursor for a beat before jumping.
 * The trade is that a failed save has to be undone visibly rather than
 * silently: `pending` holds the override, and a rejection clears it so the
 * card returns to where the server still has it, with an error message. A
 * silent revert would be worse than no optimism at all, because the student
 * would believe work was saved that wasn't.
 *
 * Native HTML5 drag rather than a library — the stack is fixed (CLAUDE.md),
 * and this is the case the native API handles well. Keyboard users are not
 * stranded: every card opens its detail page, where the same status is an
 * ordinary control.
 */
export function PlannerBoard({
  applicationId,
  recommendations,
}: {
  applicationId: string;
  recommendations: readonly Recommendation[];
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<ProgressStatus | null>(null);
  /** Optimistic status overrides, by recommendation id. */
  const [pending, setPending] = useState<Record<string, ProgressStatus>>({});
  const [error, setError] = useState<string | null>(null);

  const withPending = recommendations.map((rec) => {
    const override = pending[rec.id];
    return override === undefined ? rec : { ...rec, status: override };
  });
  const columns = groupByStatus(withPending);

  async function moveTo(id: string, status: ProgressStatus) {
    const original = recommendations.find((rec) => rec.id === id);
    if (!original || original.status === status) return;

    setPending((current) => ({ ...current, [id]: status }));
    setError(null);

    try {
      const response = await fetch(
        `/api/applications/${applicationId}/strategy/recommendations/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok) throw new Error('save failed');
    } catch {
      // Put it back where the server still has it, and say so — see the header.
      setPending((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setError('That change did not save. Please try again.');
    }
  }

  return (
    <div className="flex flex-col gap-gb-lg">
      {error ? (
        <p role="alert" className="px-gb-xl text-gb-sm text-fg-error">
          {error}
        </p>
      ) : null}

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
                if (id) void moveTo(id, status);
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
