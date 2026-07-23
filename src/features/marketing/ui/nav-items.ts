import type { TopNavItem } from '@/shared/ui';

/**
 * The marketing navigation — what a signed-out visitor sees.
 *
 * Figma node 104:7114 draws five items. "Tìm trường đại học" is the sixth,
 * added on the product owner's instruction so the desktop bar matches the
 * mobile sheet (179:12826) and the university directory keeps a direct entry
 * for the two audiences the design file names at 105:8246: people who want to
 * look around first, and people who already know what they want.
 *
 * Two hrefs point at routes that do not exist yet — the designer has not drawn
 * the About or AI-strategy pages. They are listed here rather than omitted so
 * the gap is visible; wiring this list into the global nav is blocked until
 * both pages ship.
 */
export const MARKETING_NAV_ITEMS: readonly TopNavItem[] = [
  // TODO(nav): /about does not exist yet — designer has not drawn the page.
  { href: '/about', label: 'About us' },
  // TODO(nav): /ai-strategy does not exist yet — designer has not drawn it.
  { href: '/ai-strategy', label: 'AI strategy' },
  { href: '/universities', label: 'Search universities' },
  { href: '/apply', label: 'Plan your studies' },
  { href: '/mentors', label: 'Find a mentor' },
  { href: '/news', label: 'Blog' },
];

export const MARKETING_NAV_ACTIONS = {
  secondary: { href: '/auth', label: 'Sign in' },
  primary: { href: '/onboarding', label: 'Plan your studies' },
} satisfies Record<'secondary' | 'primary', TopNavItem>;
