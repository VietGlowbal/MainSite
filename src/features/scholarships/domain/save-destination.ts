export type ScholarshipSaveDestination =
  | { kind: 'automatic'; universityId: number }
  | { kind: 'choose-linked'; universityIds: number[] }
  | { kind: 'choose-directory' };

/**
 * Decide how a scholarship can be attached to My Portal.
 *
 * A scholarship with one structured university link is unambiguous. Awards
 * with several links need a student choice, and country/provider/consortium
 * awards with no structured link need a university chosen from the directory.
 * Keeping this decision independent of the UI prevents the old `ids[0]`
 * fallback from silently assigning a multi-university award to the wrong row.
 */
export function scholarshipSaveDestination(
  universityIds: readonly number[],
): ScholarshipSaveDestination {
  const unique = [
    ...new Set(universityIds.filter((id) => Number.isInteger(id) && id > 0)),
  ];

  if (unique.length === 1) {
    return { kind: 'automatic', universityId: unique[0]! };
  }
  if (unique.length > 1) {
    return { kind: 'choose-linked', universityIds: unique };
  }
  return { kind: 'choose-directory' };
}
