'use client';

import { useState } from 'react';
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
 * some earlier snapshot. Two edits in flight at once (a card dragged on the
 * board while a date is dragged on the calendar) can therefore fail and
 * recover independently.
 */
export function usePlannerRecommendations(
  applicationId: string,
  initial: readonly Recommendation[],
): PlannerRecommendationsController {
  const [recommendations, setRecommendations] = useState<Recommendation[]>(() => [...initial]);
  const [error, setError] = useState<string | null>(null);

  function applyLocally(id: string, fields: Partial<Pick<Recommendation, 'status' | 'deadline'>>) {
    setRecommendations((current) =>
      current.map((rec) => (rec.id === id ? { ...rec, ...fields } : rec)),
    );
  }

  async function save(
    id: string,
    body: Partial<Pick<Recommendation, 'status' | 'deadline'>>,
    rollback: Partial<Pick<Recommendation, 'status' | 'deadline'>>,
    failureMessage: string,
  ) {
    setError(null);
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
      // Put the field back where the server still has it — see the module doc.
      applyLocally(id, rollback);
      setError(failureMessage);
    }
  }

  async function updateStatus(id: string, status: ProgressStatus) {
    const original = recommendations.find((rec) => rec.id === id);
    if (!original || original.status === status) return;
    applyLocally(id, { status });
    await save(id, { status }, { status: original.status }, 'That change did not save. Please try again.');
  }

  async function updateDeadline(id: string, deadline: string | null) {
    const original = recommendations.find((rec) => rec.id === id);
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
