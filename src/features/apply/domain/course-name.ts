/**
 * Whether a parse is still in flight, and what to call the course while it is.
 *
 * `course_name` is inserted as the literal string "Loading course details..."
 * when an application is created from a pasted URL (see
 * app/api/applications/from-course-url/route.ts), so the column holds a
 * placeholder masquerading as data until the worker has read the page.
 *
 * The applications list already learned this the hard way — a stalled parse
 * rendered the placeholder verbatim and looked like a spinner that never
 * resolved. The workspace made the same mistake with worse consequences: the
 * placeholder was its `<h1>`. Both now go through here.
 */

const PLACEHOLDER = /^loading course details/i;

/**
 * `university_name` gets the same treatment, for the same reason.
 *
 * The insert falls back to the literal "Unknown University" whenever the pasted
 * URL did not resolve to a row in the directory — which is most pastes, since a
 * course URL is matched by hostname and the directory is far from complete.
 * Shown verbatim it reads as a failure, and it was the first thing on the page.
 */
const UNIVERSITY_PLACEHOLDER = /^unknown university$/i;

/** True while the worker has not finished (or started) reading the course page. */
export function isParsePending(parseStatus: string | null | undefined): boolean {
  return parseStatus === 'pending' || parseStatus === 'processing';
}

/**
 * The course name to render, or `null` when there isn't a real one yet.
 *
 * A row that is still parsing has no course name whatever the column holds —
 * the value there is the placeholder, and a half-written one is not better than
 * none. Once the parse settles the column is trusted, minus a belt-and-braces
 * placeholder check for rows that failed before the name was overwritten.
 */
export function displayCourseName(
  courseName: string | null | undefined,
  parseStatus: string | null | undefined,
): string | null {
  if (isParsePending(parseStatus)) return null;
  if (!courseName) return null;
  return PLACEHOLDER.test(courseName) ? null : courseName;
}

/**
 * The university name to render, or `null` when the insert never resolved one.
 *
 * Unlike the course name this is NOT withheld while the parse runs: when the
 * URL did match the directory, the name is real from the moment the row is
 * created and is the most useful thing on the screen. Only the placeholder is
 * suppressed.
 */
export function displayUniversityName(universityName: string | null | undefined): string | null {
  if (!universityName) return null;
  return UNIVERSITY_PLACEHOLDER.test(universityName.trim()) ? null : universityName;
}

/**
 * A human-readable stand-in for an application with no resolved names yet:
 * the course URL's host, minus `www.`.
 *
 * Better than "Unknown University" and better than a blank heading — it is the
 * one fact we hold with certainty about an unparsed row, and it is the thing
 * the student themselves pasted, so they recognise it.
 */
export function courseUrlLabel(courseUrl: string | null | undefined): string | null {
  if (!courseUrl) return null;
  try {
    return new URL(courseUrl).hostname.replace(/^www\./, '');
  } catch {
    // The column is not constrained, and a row predating URL validation can
    // hold anything. A broken heading is worse than none.
    return null;
  }
}
