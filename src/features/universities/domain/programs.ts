import { splitList } from './highlights';

/**
 * What a student can pick in the "Chọn lại ngành" re-picker (Figma 375:13546).
 *
 * THE FRAME ASSUMES A COURSE CATALOGUE WE DO NOT HAVE. It draws two stacked
 * lists — schools with a specialization count ("Viện Khoa học Sức khỏe: 4
 * specializations") over subjects with a duration ("Tài chính (4 năm)") — which
 * is a `university → school → programme` tree. The live schema has no such
 * table: `universities` carries `strengths`, a comma-separated subject line, and
 * that is the whole of it. Verified against the database, not a .sql file:
 * 97 of 106 rows have `strengths`, and there is no `programs`, `majors` or
 * `university_programs` table at all.
 *
 * So this module returns the frame's shape where the data supports it and one
 * list where it does not, rather than inventing a hierarchy:
 *
 *   - VinUniversity has a real catalogue in `src/lib/vinuni-content.ts`
 *     (colleges → programmes → concentrations, with `durationYears`). Callers
 *     pass it in as `groups` and get the frame's two lists, counts and durations
 *     included, because every one of those numbers is a fact about VinUni.
 *   - Every other university gets a single list built from `strengths`. No
 *     invented school headings, no invented durations. The second list simply
 *     is not rendered.
 *
 * Pure: no React, no I/O. `groups` is passed in rather than imported so this
 * stays free of the VinUni content module (which is app-level) and testable.
 */

/** One pickable subject. */
export type ProgramOption = {
  /** The label, and the value stored in `user_universities.program`. */
  name: string;
  /**
   * Course length. Present only when the source data carries one — the frame's
   * "(4 năm)" is a fact about VinUni's catalogue, not a default to apply to the
   * other 96 universities.
   *
   * A number rather than a formatted string so the unit can be translated: the
   * dictionary holds "4 years", not "4 năm" spelled into the data.
   */
  durationYears?: number;
};

/** A school/college heading with the programmes under it. */
export type ProgramGroup = {
  name: string;
  options: ProgramOption[];
};

export type ProgramChoices = {
  /**
   * Schools, when the university has a catalogue. Empty for the other 96, and a
   * caller with an empty array must not draw the frame's first list — an empty
   * select is a dead control.
   */
  groups: ProgramGroup[];
  /**
   * The flat subject list. For a catalogue university these are the programmes
   * of the selected group; otherwise the `strengths` line.
   */
  options: ProgramOption[];
};

/** Source shape for a catalogue, structurally matching `vinuni-content.ts`. */
export type CatalogueCollege = {
  name: string;
  programs: readonly { name: string; durationYears: number }[];
};

/**
 * Build the picker's contents.
 *
 * @param strengths The university's `strengths` column — the fallback subject list.
 * @param catalogue A real school→programme catalogue, when one exists for this
 *   university. Anything empty or absent falls through to `strengths`.
 */
export function programChoices(
  strengths: string | null | undefined,
  catalogue?: readonly CatalogueCollege[] | null,
): ProgramChoices {
  const groups: ProgramGroup[] = [];

  for (const college of catalogue ?? []) {
    const options = college.programs
      .filter((program) => program.name.trim().length > 0)
      .map((program) => ({
        name: program.name.trim(),
        // A programme with no length in the catalogue gets no duration rather
        // than a default, because "4 năm" would then be a claim we invented.
        ...(Number.isFinite(program.durationYears) && program.durationYears > 0
          ? { durationYears: program.durationYears }
          : {}),
      }));
    // A school with nothing under it is a heading that leads nowhere.
    if (options.length > 0) groups.push({ name: college.name.trim(), options });
  }

  if (groups.length > 0) {
    // The flat list is the union, so a student who ignores the school list can
    // still find their programme by typing in the search box.
    return { groups, options: dedupe(groups.flatMap((group) => group.options)) };
  }

  return {
    groups: [],
    options: splitList(strengths).map((name) => ({ name })),
  };
}

/**
 * The programmes to show under a chosen school, or every programme when none is
 * chosen yet.
 *
 * Kept here rather than in the component so the "no school selected shows
 * everything" rule is testable — getting it backwards renders an empty second
 * list on first open, which reads as broken data.
 */
export function optionsForGroup(
  choices: ProgramChoices,
  groupName: string | null,
): ProgramOption[] {
  if (!groupName) return choices.options;
  const group = choices.groups.find((candidate) => candidate.name === groupName);
  return group ? group.options : choices.options;
}

/**
 * Case-insensitive substring filter for the search box.
 *
 * Matches on the name only. Including the duration would make typing "4" select
 * most of the list.
 */
export function filterOptions(options: readonly ProgramOption[], query: string): ProgramOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...options];
  return options.filter((option) => option.name.toLowerCase().includes(needle));
}

/**
 * Whether a pasted course link is safe to store and show.
 *
 * The picker's fallback field (375:13729, "Nếu không tìm thấy ngành mong muốn
 * thì paste link") takes a URL from the student, and the saved row then renders
 * it as a link. Anything that is not http(s) is rejected — `javascript:` in an
 * href is the obvious reason, but `data:` and `file:` are equally not a course
 * page.
 */
export function isCourseUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  /*
   * A dot in the host, because the parser is more forgiving than a course page
   * ever is: `new URL('http:///course')` does not fail, it normalises to
   * `http://course/` — a single-label host. So does anything the student typed
   * without a domain. A real course page lives on a registrable domain, and
   * requiring the dot also turns away `http://localhost/…`, which is a
   * developer's URL and not something to store on a student's row.
   */
  return url.hostname.includes('.');
}

function dedupe(options: readonly ProgramOption[]): ProgramOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = option.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
