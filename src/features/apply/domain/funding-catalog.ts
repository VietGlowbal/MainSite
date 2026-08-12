/**
 * How the student expects to pay for their study.
 *
 * ─── WHY THIS IS A CATALOGUE AND NOT A LIST OF LABELS ────────────────────────
 *
 * The previous question stored the option's display string — `"Personal
 * savings or parents"` — in `student_profiles.funding_source`. That works
 * exactly until the copy changes or the question is translated, at which point
 * every stored answer stops matching the option set and the field silently
 * reads back as unanswered. The subject and destination catalogues already
 * made this call (see `subject-catalog.ts`); this is the same one, applied to
 * the last question still storing prose as a key.
 *
 * So the id is what is stored and what any downstream rule matches on, and the
 * label is presentation. `fundingSourceFromStored` understands both, so
 * students who answered before this change keep their answer and the column
 * converges as they revisit.
 *
 * ─── THE DESCRIPTIONS EARN THEIR PLACE ───────────────────────────────────────
 *
 * "Scholarship" alone makes a student wonder whether an intention counts or
 * only a confirmed award. The gloss answers that in the option itself rather
 * than in a help link nobody opens — and answering it matters, because this is
 * the field that decides how hard the scholarship finder works.
 */

export type FundingSourceId =
  | 'personal_savings_or_parents'
  | 'scholarship'
  | 'student_loan'
  | 'employer_or_sponsor'
  | 'not_decided_yet';

export type FundingSource = {
  id: FundingSourceId;
  label: string;
  description: string;
  /** A key for `questionIcon` — see `question-chrome.tsx`. */
  icon: string;
};

export const FUNDING_SOURCE_CATALOG: readonly FundingSource[] = [
  {
    id: 'personal_savings_or_parents',
    label: 'Personal savings or parents',
    description: 'Family funds or your own savings will cover most of the cost.',
    icon: 'usersTwo',
  },
  {
    id: 'scholarship',
    label: 'Scholarship',
    description: 'You are hoping to fund some or all of it with a scholarship.',
    icon: 'zapFast',
  },
  {
    id: 'student_loan',
    label: 'Student loan',
    description: 'A government or private loan you will repay after graduating.',
    icon: 'chartBreakoutSquare',
  },
  {
    id: 'employer_or_sponsor',
    label: 'Employer or sponsor',
    description: 'A company, government body or organisation is paying.',
    icon: 'gift01',
  },
  {
    id: 'not_decided_yet',
    label: 'Not decided yet',
    description: 'You are still working it out — that is a normal answer here.',
    icon: 'edit02',
  },
] as const;

export const FUNDING_SOURCE_IDS = FUNDING_SOURCE_CATALOG.map((source) => source.id) as [
  FundingSourceId,
  ...FundingSourceId[],
];

export function fundingSource(id: FundingSourceId): FundingSource {
  // Non-null: the parameter type only admits ids in the catalogue.
  return FUNDING_SOURCE_CATALOG.find((source) => source.id === id)!;
}

/** The display label, for anywhere that shows the answer back. */
export function fundingSourceLabel(id: FundingSourceId): string {
  return fundingSource(id).label;
}

/**
 * A stored `funding_source` → an id, or `undefined` if it is neither.
 *
 * Reads an id directly, and falls back to matching the display strings the
 * previous form wrote. The comparison is case- and whitespace-insensitive
 * because those labels were rendered through the translator before being
 * stored in at least one earlier revision, and a stray non-breaking space
 * should not cost a student their answer.
 */
export function fundingSourceFromStored(
  stored: string | null | undefined,
): FundingSourceId | undefined {
  const value = stored?.trim();
  if (!value) return undefined;

  const direct = FUNDING_SOURCE_CATALOG.find((source) => source.id === value);
  if (direct) return direct.id;

  const normalised = normalise(value);
  const byLabel = FUNDING_SOURCE_CATALOG.find(
    (source) => normalise(source.label) === normalised,
  );
  return byLabel?.id;
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
