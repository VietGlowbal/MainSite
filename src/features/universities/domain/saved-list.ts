/**
 * Saved-list logic — /my-universities (Figma 223:8824).
 *
 * Pure, so the one piece of decision-making on that page can be tested without
 * a database, a browser, or a signed-in session (the route is behind both an
 * auth gate and the onboarding gate, which makes it the hardest page in the app
 * to reach from a test).
 *
 * Types are structural on purpose: the page's row type carries a dozen display
 * fields these functions have no business knowing about.
 */

export interface SavedListScholarship {
  id: number;
}

export interface SavedListUniversity<S extends SavedListScholarship = SavedListScholarship> {
  universityId: number;
  name: string;
  /**
   * Every scholarship linked to this university in the directory. Generic so the
   * caller's richer option type flows through to the returned candidates instead
   * of being widened to `{ id }`.
   */
  options: readonly S[];
  /** The ones the student has already attached to it. Only the ids are read. */
  attached: readonly SavedListScholarship[];
}

export interface ScholarshipCandidate<S extends SavedListScholarship> {
  option: S;
  universityId: number;
  universityName: string;
}

/**
 * The scholarships offerable for the ticked universities, flattened.
 *
 * Two rules, and both are load-bearing:
 *   - only ticked rows contribute, because the dialog's whole purpose is to
 *     attach an award to a specific saved university;
 *   - anything already attached is dropped, because re-offering it leads the
 *     student to a no-op upsert that looks like a successful action.
 *
 * Order follows the rows, then each row's own option order, so the dialog is
 * stable across re-renders.
 */
export function scholarshipCandidates<S extends SavedListScholarship>(
  rows: readonly SavedListUniversity<S>[],
  selectedUniversityIds: readonly number[],
): Array<ScholarshipCandidate<S>> {
  const selected = new Set(selectedUniversityIds);
  return rows
    .filter((row) => selected.has(row.universityId))
    .flatMap((row) => {
      const attached = new Set(row.attached.map((s) => s.id));
      return row.options
        .filter((option) => !attached.has(option.id))
        .map((option) => ({
          option,
          universityId: row.universityId,
          universityName: row.name,
        }));
    });
}
