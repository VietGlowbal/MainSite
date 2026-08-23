'use client';

import { useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { ProgressStatus, Recommendation } from '../domain';
import { KANBAN_COLUMNS, KANBAN_COLUMN_LABEL, groupByStatus } from '../domain';
import { STATUS_SELECT_CLASS } from './planner-presentation';
import { TaskCard } from './planner-shared';
import type { PlannerRecommendationsController } from './use-planner-recommendations';
import { useT } from '@/lib/i18n';

/**
 * The Application Planner board's narrow-viewport presentation (<768px) —
 * Part 5.2's deliberate mobile interaction model.
 *
 * ─── ONE ACTIVE COLUMN, NOT FIVE STACKED ─────────────────────────────────────
 *
 * Stacking the five desktop columns vertically would put a student five
 * scroll-screens away from their "Review" work and turn every column header
 * into a landmark they must wade past. Instead this surface shows exactly one
 * status column at a time, chosen from a segmented control above it — one
 * button per status in `KANBAN_COLUMNS` order, each carrying its live count
 * so an empty status is visible before it is opened. The selection is local
 * `useState` seeded with `'not_started'`, the first column: switching tabs
 * only re-slices data the parent already passed in. Nothing here fetches,
 * ever — the shared controller (`usePlannerRecommendations`) stays the single
 * source of both data and mutations, which is what makes a change made on
 * mobile appear on the list and calendar views exactly like a desktop drag.
 *
 * ─── STATUS CHANGES NEVER REQUIRE DRAG ───────────────────────────────────────
 *
 * Native HTML5 drag has no touch equivalent, so every card carries its own
 * `<select>` listing all five statuses. It calls the SAME
 * `onStatusChange(id, status)` prop the desktop drop handlers call — no
 * second mutation path exists at this layer. Its colours come from
 * `STATUS_SELECT_CLASS`, the same mapping `ProgressStatusControl` uses, so
 * the control reads as the same coloured status pill students already know.
 * The card keeps its `draggable` attribute (TaskCard renders it); on a touch
 * screen nothing initiates it and nothing depends on it — it is inert here,
 * not an affordance the student needs.
 *
 * ─── TAB SEMANTICS ───────────────────────────────────────────────────────────
 *
 * The switcher is a real ARIA tablist (`role="tablist"`, `role="tab"` +
 * `aria-selected`, one `role="tabpanel"` for the active column). Each tab is
 * a native `<button>`, so Enter/Space activation and Tab focus come free;
 * ArrowLeft/ArrowRight additionally move the selection (with wrap), focusing
 * the tab it lands on. Only the active panel exists in the DOM — hidden
 * panels would keep every status's cards mounted and duplicate content for
 * assistive tech and tests alike.
 */

const tabId = (status: ProgressStatus): string => `board-mobile-tab-${status}`;
const panelId = (status: ProgressStatus): string => `board-mobile-panel-${status}`;

export function BoardMobile({
  applicationId,
  recommendations,
  onStatusChange,
}: {
  applicationId: string;
  recommendations: readonly Recommendation[];
  onStatusChange: PlannerRecommendationsController['updateStatus'];
}) {
  const t = useT();
  const [activeStatus, setActiveStatus] = useState<ProgressStatus>('not_started');

  // Pure projection over data the parent already owns — the same grouping the
  // desktop grid runs, recomputed per render. No state, no fetching.
  const columns = groupByStatus(recommendations);
  const items = columns[activeStatus];

  /** Arrow keys walk the tabs in `KANBAN_COLUMNS` order, wrapping at the ends. */
  function handleTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, status: ProgressStatus) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const index = KANBAN_COLUMNS.indexOf(status);
    const next =
      KANBAN_COLUMNS[(index + delta + KANBAN_COLUMNS.length) % KANBAN_COLUMNS.length];
    if (!next) return;
    setActiveStatus(next);
    document.getElementById(tabId(next))?.focus();
  }

  return (
    <div className="flex flex-col gap-gb-lg">
      <div role="tablist" aria-label={t('Task statuses')} className="flex flex-wrap gap-gb-md">
        {KANBAN_COLUMNS.map((status) => {
          const selected = status === activeStatus;
          return (
            <button
              key={status}
              type="button"
              role="tab"
              id={tabId(status)}
              aria-selected={selected}
              aria-controls={panelId(status)}
              onClick={() => setActiveStatus(status)}
              onKeyDown={(event) => handleTabKeyDown(event, status)}
              className={`flex items-center gap-gb-md rounded-gb-full border px-gb-lg py-gb-xs text-gb-sm transition-colors ${
                selected
                  ? 'border-brand bg-brand-subtle font-semibold text-fg-brand'
                  : 'border-line bg-surface-muted text-fg'
              }`}
            >
              <span>{KANBAN_COLUMN_LABEL[status]}</span>{' '}
              <span className="font-semibold text-fg-tertiary">
                ({columns[status].length})
              </span>
            </button>
          );
        })}
      </div>

      {/* Exactly one panel is mounted: switching tabs swaps its cards in place. */}
      <section
        role="tabpanel"
        id={panelId(activeStatus)}
        aria-labelledby={tabId(activeStatus)}
        className="flex min-h-[12rem] flex-col gap-gb-md"
      >
        {items.map((rec) => (
          <div key={rec.id} className="flex flex-col gap-gb-xs">
            <TaskCard recommendation={rec} applicationId={applicationId} onDragStart={() => undefined} />
            {/* The non-drag route into the SAME mutation the desktop drop uses. */}
            <select
              aria-label={t('Change status — {title}', { title: rec.title })}
              value={rec.status}
              onChange={(event) => void onStatusChange(rec.id, event.target.value as ProgressStatus)}
              className={`self-start rounded-gb-full border-0 px-gb-lg py-gb-xs text-gb-xs font-medium ${STATUS_SELECT_CLASS[rec.status]}`}
            >
              {KANBAN_COLUMNS.map((status) => (
                <option key={status} value={status}>
                  {KANBAN_COLUMN_LABEL[status]}
                </option>
              ))}
            </select>
          </div>
        ))}
        {items.length === 0 ? (
          /* Drag copy would mislead on a surface where drag is not the path in —
             shorter note, same dashed styling family as the desktop columns. */
          <p className="rounded-gb-lg border border-dashed border-line px-gb-lg py-gb-2xl text-center text-gb-xs text-fg-muted">
            {t('Nothing here yet')}
          </p>
        ) : null}
      </section>
    </div>
  );
}
