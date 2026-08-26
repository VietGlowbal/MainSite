'use client';

import { useRef, useState } from 'react';
import type { ProgressStatus, Recommendation } from '../domain';

export type PlannerRecommendationsController = {
  /** The current, post-edit set — what every view should render from. */
  recommendations: Recommendation[];
  /** The most recent save failure, or null. One banner for all three views. */
  error: string | null;
  /** Board drag: optimistic status change, PATCHed, rolled back on failure. */
  updateStatus: (id: string, status: ProgressStatus) => Promise<void>;
  /** Calendar drag: optimistic deadline change, PATCHed, rolled back on failure. */
  updateDeadline: (id: string, deadline: string | null) => Promise<void>;
  /**
   * Record a status that a DIFFERENT control already persisted — the list's
   * `ProgressStatusControl` does its own optimistic PATCH (it is also used
   * standalone on the detail page, which has no shared state to update). This
   * folds its result into the shared set without PATCHing a second time.
   */
  syncStatus: (id: string, status: ProgressStatus) => void;
};

/**
 * The one array of recommendations that the list, calendar and board all
 * read from and write to.
 *
 * WHY THIS EXISTS. Before it, each view kept its own local "pending" overrides
 * on top of the `recommendations` prop the dashboard page fetched once on
 * load. A status dragged on the board or a date dragged on the calendar
 * PATCHed correctly — the database was never wrong — but the change lived
 * only inside that view's own state. Switching to another view unmounted it,
 * the override was discarded, and the other view rendered the page's original
 * server snapshot until a hard reload. Lifting the array (and the two edits
 * that mutate it) up to one hook shared by all three views is what makes an
 * edit in one place visible in the other two without a reload.
 *
 * SEEDED ONCE, NOT RESYNCED FROM PROPS. `initial` only matters on mount: the
 * dashboard page is a Server Component that fetches recommendations on
 * navigation, and this hook is what takes over from there for the lifetime of
 * the page. Re-seeding on every prop change would fight the optimistic state
 * this hook exists to hold.
 *
 * ROLLBACK IS PER-FIELD, NOT A FULL SNAPSHOT. A failed save restores only the
 * one field (`status` or `deadline`) on the one recommendation that failed,
 * to the value it had immediately before that edit — not the whole array to
 * some earlier snapshot. Two edits to different fields (a card dragged on the
 * board while a date is dragged on the calendar) therefore fail and recover
 * independently.
 *
 * THE ARRAY IS READ FROM A REF, NOT FROM RENDER STATE. `updateStatus` and
 * `updateDeadline` need the value a field held *immediately before this edit*
 * in order to roll back to it. Reading that from `recommendations` would read
 * whatever the render that created the callback closed over, which can be
 * several edits stale by the time the callback runs — `DeadlineControl` can
 * fire an edit per spinner tick. `latest` is updated synchronously by
 * `applyLocally`, so the rollback base is always the value actually on screen.
 *
 * REQUESTS ARE SERIALIZED PER HOOK; OPTIMISM IS NOT. The optimistic update runs
 * immediately — a correction made while an earlier save is still open shows up
 * in all three views at once — but the PATCH itself queues behind any request
 * still open, so two writes to the same row cannot reach Postgres in the
 * opposite order to the one the student made them in. This is where that guard
 * belongs: `DeadlineControl` used to hold it, which meant the control had to
 * choose between correct ordering and letting the student keep typing.
 *
 * A SUPERSEDED FAILURE DOES NOT ROLL BACK. If an edit fails after a later edit
 * to the same field has already been applied, restoring the old value would
 * discard the newer one the student can see. The later edit's own result
 * governs the field instead; `editSeq` is what tells the two apart.
 */
export function usePlannerRecommendations(
  applicationId: string,
  initial: readonly Recommendation[],
): PlannerRecommendationsController {
  const [recommendations, setRecommendations] = useState<Recommendation[]>(() => [...initial]);
  const [error, setError] = useState<string | null>(null);
  /** The array as it is *now* — see the module doc. */
  const latest = useRef(recommendations);
  /** The most recent edit per `id:field`, so a stale failure can stand down. */
  const editSeq = useRef(new Map<string, number>());
  /** The request currently open, if any; the next one queues behind it. */
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  function applyLocally(id: string, fields: Partial<Pick<Recommendation, 'status' | 'deadline'>>) {
    latest.current = latest.current.map((rec) => (rec.id === id ? { ...rec, ...fields } : rec));
    setRecommendations(latest.current);
  }

  async function save(
    id: string,
    body: Partial<Pick<Recommendation, 'status' | 'deadline'>>,
    rollback: Partial<Pick<Recommendation, 'status' | 'deadline'>>,
    failureMessage: string,
  ) {
    // Per field, not per row: a status edit must not cancel out a deadline
    // edit made a moment later on the same task.
    const scope = `${id}:${Object.keys(body).sort().join(',')}`;
    const seq = (editSeq.current.get(scope) ?? 0) + 1;
    editSeq.current.set(scope, seq);
    setError(null);

    const send = async () => {
      try {
        const response = await fetch(
          `/api/applications/${applicationId}/strategy/recommendations/${id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        );
        if (!response.ok) throw new Error('save failed');
      } catch {
        // A later edit to this same field has since been applied; rolling back
        // now would discard it, and its own save will report its own result.
        if (editSeq.current.get(scope) !== seq) return;
        // Put the field back where the server still has it — see the module doc.
        applyLocally(id, rollback);
        setError(failureMessage);
      }
    };

    chain.current = chain.current.then(send, send);
    await chain.current;
  }

  async function updateStatus(id: string, status: ProgressStatus) {
    const original = latest.current.find((rec) => rec.id === id);
    if (!original || original.status === status) return;
    applyLocally(id, { status });
    await save(id, { status }, { status: original.status }, 'That change did not save. Please try again.');
  }

  async function updateDeadline(id: string, deadline: string | null) {
    const original = latest.current.find((rec) => rec.id === id);
    if (!original || original.deadline === deadline) return;
    applyLocally(id, { deadline });
    await save(
      id,
      { deadline },
      { deadline: original.deadline },
      'That date did not save. Please try again.',
    );
  }

  function syncStatus(id: string, status: ProgressStatus) {
    applyLocally(id, { status });
  }

  return { recommendations, error, updateStatus, updateDeadline, syncStatus };
}
