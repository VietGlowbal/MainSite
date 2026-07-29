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
