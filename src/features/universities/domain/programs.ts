import { splitList } from './highlights';

/**
 * What a student can pick in the "Chọn lại ngành" re-picker (Figma 375:13546).
 *
 * The frame draws two stacked lists — schools with a specialization count
 * ("Viện Khoa học Sức khỏe: 4 specializations") over programmes with a duration
 * ("Tài chính (4 năm)") — a `university → school → programme` tree.
 *
 * ⚠️ AN EARLIER VERSION OF THIS COMMENT SAID THAT TREE DID NOT EXIST IN THE
 * DATABASE. It does: `catalog_programmes` carries the programme, its
 * `degree_level`, and a denormalised `academic_units` array that is exactly the
 * school layer. The claim came from probing three guessed table names and
 * missing on all three. **The lesson is in `api/programme-queries.ts`:
 * enumerate the schema, do not guess at it.**
 *
 * What is true is that coverage is PARTIAL, and that is what this module exists
 * to handle. Measured live on 2026-07-31:
 *
 *   - 404 programmes across **24** of the 106 universities. Those get the
 *     frame's two lists, with a real programme count per school.
 *   - The other 82 get a single list from `universities.strengths`, the
 *     comma-separated subject line (present on 97 of 106).
 *   - `duration` is null on 400 of the 404, so the frame's "(4 năm)" renders
 *     for almost nothing. It is shown where it exists and never defaulted.
 *   - `degree_level` IS well populated, and it is the useful discriminator —
 *     the same subject appears as a bachelor's and a master's — so it takes the
 *     secondary line the frame gave to duration.
 *
 * Pure: no React, no I/O. The catalogue is passed in rather than fetched so this
 * stays testable and free of the api slice.
 */

/** One pickable subject. */
export type ProgramOption = {
  /** The label, and the value stored in `user_universities.program`. */
  name: string;
  /**
   * "Bachelor" / "Master" / "PhD", already folded to one spelling by
   * `degreeLabel` in the api slice. Absent when the row does not say.
   *
   * A known label rather than the raw column, so the picker's secondary line
   * stays a static dictionary string — this route gets no machine-translation
   * fallback.
   */
  degree?: string;
  /**
   * Course length in years. Present only when the source carries one — the
   * frame's "(4 năm)" is a fact about a particular programme, never a default.
   *
   * A number rather than a formatted string so the unit can be translated: the
   * dictionary holds "4 years", not "4 năm" spelled into the data.
   */
  durationYears?: number;
  /**
   * The university's own page for this programme, when the catalogue has one.
   *
   * Shown once a programme is chosen rather than on every row: it is the way a
   * student checks a crawled listing against the source, which matters because
   * these rows are collected rather than curated.
   */
  officialUrl?: string;
};

/** A school/college heading with the programmes under it. */
export type ProgramGroup = {
  name: string;
  options: ProgramOption[];
};

/**
 * Facet words that only ever appear in a crawled programme name's TAIL.
 *
 * `catalog_programmes.programme_name` is frequently every facet of a listing
 * concatenated — degree level, study modes, the administering school, sometimes
 * twice. Median length is 35 characters but p90 is 85 and the longest is 154:
 *
 *   "Health Education and Health Communication, MSPH Bloomberg School of Public
 *    Health Master's Full-time Part-time Bloomberg School of Public Health
 *    In-person"
 *
 * The subject is always at the head, and the soup always starts at one of these.
 * Ordered longest-first so "In Person" is found before "Person" could be.
 */
const FACET_MARKERS = [
  'Professional Degree',
  'Online/Hybrid',
  'Postgraduate',
  'Undergraduate',
  'Non-Degree',
  'On-Campus',
  'On Campus',
  'In-person',
  'In Person',
  'Full-time',
  'Full Time',
  'Part-time',
  'Part Time',
  'Bachelors',
  "Bachelor's",
  'Doctoral',
  'Graduate',
  'Masters',
  "Master's",
  'Hybrid',
  'Online',
  'Distance',
  // Penn ends its listings with these. Safe only because this peels the TAIL —
  // as a mid-string cut they would wreck "Major Works of Western Literature".
  'Major',
  'Minor',
] as const;

/**
 * A crawled programme name, cut back to the subject.
 *
 * LOSSY AND ONLY EVER A PREFIX, the same contract as `leadFragment`: this
 * returns the head of its input, never a rewrite of it. It is what the student
 * picks and what gets written to `user_universities.program`, so it has to stay
 * recognisable as the thing the university calls it.
 *
 * @param schools Names of the schools administering it. They are cut too — the
 *   picker already shows the school as the list heading above, and the crawler
 *   repeats it inline (sometimes twice).
 */
export function tidyProgrammeName(
  raw: string,
  schools: readonly string[] = [],
): string {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (!name) return name;

  const markers = [...FACET_MARKERS, ...schools.map((school) => school.trim()).filter(Boolean)];
  let head = name;

  /*
   * PEEL THE TAIL, NEVER CUT IN THE MIDDLE — and this is the whole design.
   *
   * The first version cut at the EARLIEST facet word anywhere in the string.
   * That mangles a name that legitimately contains one: Georgia Tech's
   * "Computer Science – Online Degree (MS)" became "Computer Science", which
   * both lost the distinguishing clause and collided with the real "Computer
   * Science (MS)" two rows below it. Caught in the browser, not by a test.
   *
   * Peeling only a TRAILING run of facets cannot do that: anything sitting
   * before a word the vocabulary does not recognise is left alone, whatever it
   * says. The cost is that some tails survive — NYU ends its names with "Arts &
   * Science", which is not quite any of its unit names — and a long name is a
   * far smaller problem than a wrong one.
   */
  for (let guard = 0; guard < 24; guard += 1) {
    const previous = head;

    head = head.replace(/[\s,;:|–-]+$/, '');

    for (const marker of markers) {
      const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const trailing = new RegExp(`\\s${escaped}\\s*$`, 'i');
      if (trailing.test(head)) {
        head = head.replace(trailing, '');
        break;
      }
    }

    /*
     * A bare credential the tail repeats: "Computer Science Courant (MS) MS
     * Masters …" peels back to "… (MS) MS". Only an ALL-CAPS token, and only
     * when it does not follow a comma or a bracket — "Applied Economics, MA"
     * and "Computer Science (BS)" are how a university writes it, and stay.
     */
    const credential = /\s([A-Z]{2,6}(?:\/[A-Z]{2,6})*)\s*$/.exec(head);
    if (credential) {
      const preceding = head[credential.index - 1];
      if (preceding !== ',' && preceding !== '(' && preceding !== '/') {
        head = head.slice(0, credential.index);
      }
    }

    if (head === previous) break;
  }

  head = head.trim();

  /*
   * Never destroy a name. A length check is not enough: a name made only of
   * facet words peels to another facet word ("Graduate Full-time Online" ->
   * "Graduate"), which passes any length test and means nothing as a subject.
   * The head has to still contain something that is not a facet.
   */
  return head.length >= 3 && hasSubjectWord(head) ? head : name;
}

/** Whether anything survives once the facet vocabulary is removed. */
function hasSubjectWord(head: string): boolean {
  let rest = head;
  for (const marker of FACET_MARKERS) {
    rest = rest.replace(new RegExp(`(?:^|\\s)${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'gi'), ' ');
  }
  return /[A-Za-z]{2}/.test(rest);
}

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
  /**
   * Where the list came from, so the caller can say so.
   *
   * `catalogue` rows are crawler output — collected from the university's own
   * pages rather than curated — and the picker tells the student that once,
   * under the heading. `strengths` is our own editorial subject line and makes
   * no such claim. `none` means there is nothing to pick from and only the
   * paste-a-link fallback applies.
   */
  source: 'catalogue' | 'strengths' | 'none';
};

/**
 * One catalogued programme, as the api slice hands it over.
 *
 * Structural and already normalised: `degree` is a known label rather than the
 * raw `degree_level`, and `durationYears` a number rather than the free text.
 * Doing that conversion at the edge keeps this module free of the database's
 * two spellings of "bachelor".
 */
export type CatalogueEntry = {
  name: string;
  degree?: string | null;
  durationYears?: number | null;
  officialUrl?: string | null;
  /** The schools administering it. Empty is normal and handled. */
  units?: readonly { name: string; isPrimary?: boolean }[];
};

/**
 * Build the picker's contents.
 *
 * @param strengths The university's `strengths` column — the fallback subject
 *   list, used when the catalogue has nothing for this university.
 * @param catalogue Catalogued programmes for this university, if any.
 */
export function programChoices(
  strengths: string | null | undefined,
  catalogue?: readonly CatalogueEntry[] | null,
): ProgramChoices {
  const entries = (catalogue ?? []).filter((entry) => entry.name.trim().length > 0);

  if (entries.length === 0) {
    const options = splitList(strengths).map((name) => ({ name }));
    return {
      groups: [],
      options,
      source: options.length > 0 ? 'strengths' : 'none',
    };
  }

  const options = dedupe(entries.map(toOption));

  /*
   * Group by school. A programme can be administered by more than one — Penn's
   * joint degrees are — so it appears under each, which is what a student
   * browsing by school expects. `isPrimary` orders the units but does not
   * exclude the others.
   */
  const byUnit = new Map<string, ProgramOption[]>();
  for (const entry of entries) {
    const units = [...(entry.units ?? [])].sort(
      (a, b) => Number(b.isPrimary ?? false) - Number(a.isPrimary ?? false),
    );
    for (const unit of units) {
      const name = unit.name.trim();
      if (!name) continue;
      const bucket = byUnit.get(name);
      if (bucket) bucket.push(toOption(entry));
      else byUnit.set(name, [toOption(entry)]);
    }
  }

  const groups: ProgramGroup[] = [...byUnit.entries()]
    .map(([name, groupOptions]) => ({ name, options: dedupe(groupOptions) }))
    // A school with nothing under it is a heading that leads nowhere.
    .filter((group) => group.options.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return { groups, options, source: 'catalogue' };
}

function toOption(entry: CatalogueEntry): ProgramOption {
  return {
    // Cut back to the subject, with this programme's own schools stripped —
    // they are the heading it sits under, not part of its name.
    name: tidyProgrammeName(entry.name, (entry.units ?? []).map((unit) => unit.name)),
    ...(entry.degree ? { degree: entry.degree } : {}),
    ...(entry.officialUrl ? { officialUrl: entry.officialUrl } : {}),
    // Never defaulted: null on 400 of 404 rows, and "4 years" on a programme
    // that does not say so would be a claim we invented.
    ...(entry.durationYears != null && Number.isFinite(entry.durationYears) && entry.durationYears > 0
      ? { durationYears: entry.durationYears }
      : {}),
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

/** A usable saved-list label when a student supplies only an official course URL. */
export function courseNameFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    const segment = url.pathname.split('/').filter(Boolean).at(-1);
    if (!segment) return null;
    const label = decodeURIComponent(segment)
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return label ? label.replace(/\b\w/g, (letter) => letter.toUpperCase()) : null;
  } catch {
    return null;
  }
}

/**
 * Drop repeats, keyed on name AND degree.
 *
 * Name alone would be wrong here: a university commonly catalogues the same
 * subject at two levels ("Applied Economics" as both a bachelor's and a
 * master's), and collapsing those would silently remove one of the two things
 * the student came to choose between.
 *
 * Repeats do occur — a programme administered by two schools appears once per
 * school, and the flat list is the union of those.
 */
function dedupe(options: readonly ProgramOption[]): ProgramOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = `${option.name.toLowerCase()}|${option.degree ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
