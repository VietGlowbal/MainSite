import { Avatar } from '@/shared/ui/avatar';
import { ResearchingInline } from './research-progress';

/**
 * The workspace banner: the university's mark over the course title, on a
 * muted plate.
 *
 * Replaces `ApplicationHeader`, which drew a breadcrumb, a pill row
 * ("Bachelor of Science", "In person", "On track") and a kebab menu that opened
 * nothing. The frame keeps the crest and the title and drops the rest, which is
 * the right call — "On track" was a static string, not a computed state, and a
 * kebab with no menu behind it is worse than no kebab.
 *
 * The crest falls back to initials for the same reason as the list row: most
 * applications are imported from a pasted URL and never resolve to a university
 * record, so `logo_url` is usually absent.
 *
 * WHAT THE HEADING SAYS WHEN NOTHING IS KNOWN YET. Best available, in order:
 * the course, then the university, then the URL's host. The old build printed
 * whatever the columns held, which during a parse meant the literal strings
 * "Unknown University" and "Loading course details..." — as the first thing on
 * the page, and the reason a working parse looked like a failed one. Callers
 * pass names already filtered through the domain helpers, so a placeholder
 * cannot reach here; `researching` then supplies the reason the heading is thin.
 */
export function ApplicationBanner({
  universityName,
  courseName,
  urlLabel,
  logoUrl,
  researching = false,
}: {
  /** Absent when the pasted URL never resolved to a university record. */
  universityName?: string | undefined;
  /** Absent while the course page is still being read. */
  courseName?: string | undefined;
  /** The course URL's host — the last-resort heading. */
  urlLabel?: string | null | undefined;
  logoUrl?: string | null | undefined;
  /** Whether the parse is still running, which explains any missing name. */
  researching?: boolean;
}) {
  const heading = courseName ?? universityName ?? urlLabel ?? 'Your application';

  // Only when there is a *distinct* second line to show. Repeating the heading
  // under itself is noise, which is what an unparsed application used to get.
  const subheading = courseName && universityName ? universityName : null;

  return (
    <div className="flex flex-col gap-gb-2xl rounded-gb-2xl bg-surface-muted p-gb-4xl">
      <Avatar name={universityName ?? urlLabel ?? 'Course'} src={logoUrl ?? null} size="lg" />

      <div className="flex flex-col gap-gb-xs">
        <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
          {heading}
        </h1>
        {subheading ? <p className="text-gb-md text-fg-tertiary">{subheading}</p> : null}
        {researching ? (
          <ResearchingInline className="mt-gb-xs">
            {universityName
              ? 'Reading the course page…'
              : 'Working out which university and course this is…'}
          </ResearchingInline>
        ) : null}
      </div>
    </div>
  );
}
