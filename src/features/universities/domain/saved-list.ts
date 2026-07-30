import { parseCoveragePercent } from './pricing';

/**
 * Saved-list logic — /my-universities (Figma 375:12701, applied state 375:12841).
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

/** The fields a coverage percentage can be read from. Structural, as above. */
export interface CoverageLike extends SavedListScholarship {
  coverage: string | null;
  fundingType: string[] | null;
}

/**
 * The scholarships a student has attached to this row, as full options.
 *
 * `attached` carries only ids and display labels — it is built from
 * `ScholarshipQueries.byIds`, whose projection has no `coverage` or
 * `fundingType`. The same awards are already present in `options` (both sides
 * come from `scholarship_universities`), which does carry them, so the discount
 * maths joins the two in memory rather than issuing a second query per row.
 *
 * An attached award with no matching option is skipped, not defaulted: it means
 * the directory link was removed after the student attached it, and guessing a
 * coverage there would put a number on the page with nothing behind it.
 */
export function attachedOptions<S extends SavedListScholarship>(
  row: SavedListUniversity<S>,
): S[] {
  const attached = new Set(row.attached.map((s) => s.id));
  return row.options.filter((option) => attached.has(option.id));
}

/**
 * The highest scholarship coverage the student has actually secured, as a
 * percentage — the "Học bổng 50%" headline on 375:12841.
 *
 * BEST SINGLE AWARD, NOT A TOTAL. Percentages across different universities
 * cannot be added: 50% of MIT and 50% of NUS is not "100% off". Each row is a
 * separate bill, so the bar reports the best one and the rows carry their own
 * net figures.
 *
 * Returns null when no attached award states a percentage — many are cash sums
 * ("2,000USD"), and those reduce a bill without being a proportion of it. The
 * caller falls back to a count rather than converting one into the other.
 */
export function bestCoveragePercent(
  rows: readonly SavedListUniversity<CoverageLike>[],
): number | null {
  let best: number | null = null;

  for (const row of rows) {
    for (const option of attachedOptions(row)) {
      const pct = parseCoveragePercent(option.coverage, option.fundingType);
      if (pct != null && (best == null || pct > best)) best = pct;
    }
  }

  return best;
}
