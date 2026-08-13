/**
 * The shape both navigations read.
 *
 * `TopNav` and `MobileNav` render the same list two very different ways, and
 * each used to declare its own near-identical item type. One model is what
 * stops a destination being added to the desktop bar and going missing from the
 * hamburger sheet — the drift the nav rewrite was done to end.
 */

/** A destination. */
export type NavLink = {
  href: string;
  /** Already-translated label. */
  label: string;
};

/**
 * A label that opens a menu instead of navigating — "Search", which gathers
 * Scholarships / Universities / Mentors behind one item.
 *
 * It deliberately has NO `href`. There is no page that is "Search", and giving
 * the trigger one would make it a link pretending to be a menu button: it would
 * announce as a link, navigate on Enter, and offer a middle-click that opens
 * nothing. The disclosure button in `TopNav` is the honest control.
 */
export type NavGroup = {
  /** Already-translated label. */
  label: string;
  items: readonly NavLink[];
};

export type NavEntry = NavLink | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry;
}

/**
 * Which destination is the current one.
 *
 * Shared so the desktop pill and the mobile row can never disagree. `/` is
 * excluded from the prefix test because every path starts with it.
 */
export function isNavLinkActive(pathname: string, href: string): boolean {
  // Navigation destinations may carry a query or fragment to express where a
  // link should land within a page. Active state is still a pathname concern:
  // /apply#portal is the /apply page, just as /news?tag=visa is /news.
  const hrefPathname = href.split(/[?#]/, 1)[0] || '/';
  return (
    pathname === hrefPathname ||
    (hrefPathname !== '/' && pathname.startsWith(`${hrefPathname}/`))
  );
}
