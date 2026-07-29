import { Avatar } from '@/shared/ui';

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
 */
export function ApplicationBanner({
  universityName,
  courseName,
  logoUrl,
}: {
  universityName: string;
  /** Absent while the course page is still being read. */
  courseName?: string | undefined;
  logoUrl?: string | null | undefined;
}) {
  return (
    <div className="flex flex-col gap-gb-2xl rounded-gb-2xl bg-surface-muted p-gb-4xl">
      <Avatar name={universityName} src={logoUrl ?? null} size="lg" />

      <div className="flex flex-col gap-gb-xs">
        <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
          {courseName ?? universityName}
        </h1>
        {/* Only a second line when there is a distinct one to show — repeating
            the university under itself is noise on an unparsed application. */}
        {courseName ? <p className="text-gb-md text-fg-tertiary">{universityName}</p> : null}
      </div>
    </div>
  );
}
