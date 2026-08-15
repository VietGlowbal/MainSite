import { BRAND_ICONS, BrandIcon, InstagramMark } from '@/shared/ui/icons';
import type { FooterColumn, FooterSocial } from '@/shared/ui/footer';
import type { TopNavEntry, TopNavItem } from '@/shared/ui/top-nav';

/**
 * The site chrome's link configuration — what the header and footer point at.
 *
 * Labels are English because English is the default language and the VI
 * translations come from src/lib/i18n-dictionary.ts. A label here must match
 * its dictionary key character for character, or the string falls through to
 * machine translation.
 *
 * Figma draws these in Vietnamese; the mapping to the English source strings is
 * noted where it is not obvious.
 */

/**
 * The incomplete-state list from the supplied new-user navigation matrix.
 * Completed students use the same list without Strategy Master because that
 * destination is promoted into the red primary-action slot.
 */
const INCOMPLETE_MARKETING_NAV_ITEMS: readonly TopNavEntry[] = [
  { href: '/', label: 'Home' },
  // /guides permanently redirects here; /news is the canonical destination.
  { href: '/news', label: 'GlowBal News' },
  /*
   * The one grouped entry. Scholarships, Universities and Advisors are the three
   * browse-and-compare surfaces; they were three of the six top-level items and
   * competed with the two things a student is actually meant to DO. Behind one
   * label they stop competing and the bar retains room for the two actions.
   *
   * "Search" is a group, so it has no href and nothing to navigate to. See the
   * note on NavGroup for why that is deliberate rather than an omission.
   */
  {
    label: 'Search',
    items: [
      { href: '/scholarships', label: 'Scholarships' },
      { href: '/universities', label: 'Universities' },
      { href: '/advisors', label: 'Advisors' },
    ],
  },
  // Removed from this list only after onboarding, when it becomes the CTA.
  { href: '/ai-strategy', label: 'Strategy Master' },
  /*
   * Was "Plan your studies", then "Application" (31/07, when /apply absorbed
   * the saved list), now "My Portal" on the owner's instruction (01/08). The
   * page is everything the student owns — applications, deadlines, saved
   * universities and scholarships — and "Application" undersold it as one form.
   */
  /*
   * The explicit top anchor matters when the student is already on /apply at
   * #saved. Next.js preserves the current scroll position when the Page is
   * still visible, so a plain /apply link does not reliably mean "back to the
   * top". The heart uses the sibling #saved anchor.
   */
  { href: '/apply#portal', label: 'My Portal' },
];

export type MarketingNavState = Readonly<{
  signedIn: boolean;
  completed: boolean;
}>;

export type MarketingNavPresentation = Readonly<{
  items: readonly TopNavEntry[];
  primaryAction: TopNavItem;
  /** Register for guests; the Profile destination for authenticated students. */
  accountAction: TopNavItem;
}>;

export type MarketingNavTranslator = (label: string) => string;

const COMPLETED_MARKETING_NAV_ITEMS: readonly TopNavEntry[] =
  INCOMPLETE_MARKETING_NAV_ITEMS.filter(
    (item) => !('href' in item && item.href === '/ai-strategy'),
  );

const STRATEGY_ACTION = {
  href: '/ai-strategy',
  label: 'Strategy Master',
} satisfies TopNavItem;
const REGISTER_ACTION = {
  href: '/auth?mode=signup',
  label: 'Register',
} satisfies TopNavItem;
const PROFILE_ACTION = { href: '/profile', label: 'User Profile' } satisfies TopNavItem;
const ONBOARDING_ACTION = {
  href: '/onboarding',
  label: 'Plan your Global Education',
} satisfies TopNavItem;

const identity: MarketingNavTranslator = (label) => label;

function translateEntry(entry: TopNavEntry, t: MarketingNavTranslator): TopNavEntry {
  if ('items' in entry) {
    return {
      label: t(entry.label),
      items: entry.items.map((item) => ({ href: item.href, label: t(item.label) })),
    };
  }

  return { href: entry.href, label: t(entry.label) };
}

function translateAction(action: TopNavItem, t: MarketingNavTranslator): TopNavItem {
  return { href: action.href, label: t(action.label) };
}

/**
 * Resolve everything about the navigation that depends on account/onboarding
 * state. The function is deliberately pure so every header implementation can
 * consume the same decision without owning another copy of the matrix.
 */
export function getMarketingNavPresentation(
  state: MarketingNavState,
  t: MarketingNavTranslator = identity,
): MarketingNavPresentation {
  // Completion can only belong to an authenticated profile. Failing closed on
  // an impossible guest/completed combination keeps onboarding available.
  const isCompletedStudent = state.signedIn && state.completed;
  const sourceItems = isCompletedStudent
    ? COMPLETED_MARKETING_NAV_ITEMS
    : INCOMPLETE_MARKETING_NAV_ITEMS;

  return {
    items: sourceItems.map((item) => translateEntry(item, t)),
    primaryAction: translateAction(
      isCompletedStudent ? STRATEGY_ACTION : ONBOARDING_ACTION,
      t,
    ),
    accountAction: translateAction(state.signedIn ? PROFILE_ACTION : REGISTER_ACTION, t),
  };
}

/** Guest/incomplete defaults retained for existing call sites during rollout. */
export const MARKETING_NAV_ITEMS: readonly TopNavEntry[] = INCOMPLETE_MARKETING_NAV_ITEMS;

export const MARKETING_NAV_ACTIONS = {
  secondary: REGISTER_ACTION,
  primary: ONBOARDING_ACTION,
} satisfies Record<'secondary' | 'primary', TopNavItem>;

/** Figma 104:7410. */
export const FOOTER_TAGLINE =
  'Helping students find global universities, scholarships, and application strategies.';

/** Figma 104:7413–104:7415. */
export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    heading: 'Product',
    links: [
      { href: '/universities', label: 'Search universities' },
      { href: '/scholarships', label: 'Find scholarships' },
      // Figma "Chiến lược AI", and the one link in the design that carries the
      // Badge (I104:7413;3288:570947).
      { href: '/ai-strategy', label: 'AI strategy', badge: 'New' },
      { href: '/advisors', label: 'Student advisors' },
      { href: '/plus', label: 'GlowBal Plus' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About us' },
      // The anchor is a contract with the About page (Figma 153:11401): it must
      // render an element with id="team".
      { href: '/about#team', label: 'Our team' },
      { href: '/achievers', label: 'Student stories' },
      // Same contract with the Home contact section (Figma 104:7361).
      { href: '/#contact', label: 'Contact' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/terms', label: 'Terms of service' },
    ],
  },
];

/**
 * Figma 104:7422 draws three marks: X, LinkedIn and Facebook. The accounts that
 * actually exist are a different set, confirmed by the product owner on
 * 2026-07-25: Facebook and Instagram, no LinkedIn.
 *
 * So the row follows the accounts, not the mockup — a link to an account that
 * does not exist is worse than a missing icon. Two consequences worth knowing:
 *   - LinkedIn's art stays in BRAND_ICONS unused, ready if an account appears.
 *   - Instagram has no art anywhere in the design, hence InstagramMark. See the
 *     ⚠️ on it in shared/ui/icons.tsx.
 *
 * TODO(social): X is still drawn in Figma with no handle supplied. Add it, or
 * ask the designer to drop it from 104:7422.
 */
export const FOOTER_SOCIAL: readonly FooterSocial[] = [
  {
    href: 'https://www.facebook.com/glowbal.education',
    label: 'Facebook',
    icon: <BrandIcon art={BRAND_ICONS.facebook} frame={20} />,
  },
  {
    href: 'https://www.instagram.com/glowbal_education/',
    label: 'Instagram',
    icon: <InstagramMark frame={20} />,
  },
];

/** Figma 104:7421. */
export const FOOTER_COPYRIGHT = '© 2026 GlowBal. Student-first global guidance.';

/**
 * Figma 104:7411, the ratings badge.
 *
 * ⚠️ PLACEHOLDER COPY. GLOWBAL has not launched, so neither the award nor the
 * review count is real yet. Kept because the product owner asked for the
 * mockup's wording on 2026-07-25 with the explicit note that they will replace
 * it ("cứ ghi tạm như thế đi có gì chúng tôi sẽ sửa sau").
 *
 * Whoever replaces it: these two strings appear in the footer of every page, so
 * they are a public claim about the product. Either make them true or pass
 * `ratings={undefined}` to Footer and the badge disappears cleanly.
 */
export const FOOTER_RATINGS = {
  headline: 'Best AI Tool',
  supporting: '2,000+ reviews',
} as const;
