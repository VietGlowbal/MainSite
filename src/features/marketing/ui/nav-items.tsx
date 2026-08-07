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
 * Primary navigation. Figma 375:9845 (guest) and 375:10151 (signed in), both on
 * the "Khanh Linh - Chi" canvas, which supersedes 104:7114 / 203:12356.
 *
 * ⚠️ THE ORDER AND THE GROUPING BELOW ARE THE OWNER'S, NOT THE FRAME'S
 * (01/08). Both frames still draw a flat row of six; the owner asked for four
 * entries with the three "go and look at something" destinations folded behind
 * one "Search" dropdown, and for that same bar to serve signed-out and
 * signed-in alike. Where this file and the frames disagree, this is current —
 * ask the designer to redraw 375:9845, do not "restore" the flat list.
 *
 * The order, left to right: News · Search · Build your strategy · My Portal.
 * It reads as a funnel — what's happening, what exists, what you should do,
 * what you have done — and it is the reason "My Portal" is last rather than
 * beside the other authenticated page.
 *
 * ONE LIST SERVES BOTH AUDIENCES. The signed-in frame drops an item only
 * because it promotes it to the CTA button, which is a property of the CTA
 * slot: every page picks its own `primaryAction` already.
 *
 * ⚠️ /apply AND /ai-strategy STAY VISIBLE TO GUESTS, on the owner's instruction
 * (31/07). Both were briefly hidden behind a signed-in check on the grounds
 * that a visitor with no account has no application progress; the owner's call
 * is the opposite and it is the better one — the links are how a guest finds
 * out the features exist. Each page forces sign-in when it is opened, which is
 * where that belongs. Do not reintroduce an auth filter on this list.
 *
 * ⚠️ "About us" IS NO LONGER HERE. It was the first item; the owner's list of
 * four does not include it. It is still reachable from the footer's Company
 * column, which is the conventional home for it, and /about itself is
 * untouched. Removing it is the only deletion in this change — everything else
 * moved or was renamed.
 */
export const MARKETING_NAV_ITEMS: readonly TopNavEntry[] = [
  /*
   * Figma "Blog", relabelled "News" on the owner's instruction (01/08) to match
   * the destination: /guides and /news used to render the same listGeoGuides()
   * data through two designs and were merged on 31/07 — the redesign is the UI,
   * /news is the URL, and /guides now 308s here.
   */
  { href: '/news', label: 'News' },
  /*
   * The one grouped entry. Scholarships, Universities and Mentors are the three
   * browse-and-compare surfaces; they were three of the six top-level items and
   * competed with the two things a student is actually meant to DO. Behind one
   * label they stop competing, and the bar drops from six labels to four —
   * which is also what bought back the width the header was short of below
   * 1280 (see the ⚠️ in shared/ui/top-nav.tsx).
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
  /*
   * ⚠️ WAS "Build your strategy" -> /ai-strategy UNTIL 03/08. The owner split the
   * one explainer in two: /how-it-works is the help page for the whole product
   * and /ai-strategy is stage 3 (the Strategy) on its own. The nav points at the
   * help page, which is the owner's instruction and also the better of the two
   * for a visitor who has just arrived — it explains all three stages and links
   * on to the Strategy.
   *
   * IT REPLACES THAT ENTRY RATHER THAN JOINING IT, and that is a width
   * constraint, not a preference: the bar clips silently below 1280 (see the ⚠️
   * on `overflow-hidden` in shared/ui/top-nav.tsx) and four labels is what it
   * fits. "How GlowBal works" is two characters shorter than the label it
   * replaces, so it costs nothing. /ai-strategy is still reachable — from this
   * page, from the footer's "AI strategy" link, and from the strategy prompt on
   * every application.
   *
   * Figma drew this slot as "Lên Chiến lược Du học" (375:9845). The frame is
   * now behind the product on this item; the VI string for the new label is in
   * src/lib/i18n-dictionary.ts.
   */
  { href: '/how-it-works', label: 'How GlowBal works' },
  /*
   * Was "Plan your studies", then "Application" (31/07, when /apply absorbed
   * the saved list), now "My Portal" on the owner's instruction (01/08). The
   * page is everything the student owns — applications, deadlines, saved
   * universities and scholarships — and "Application" undersold it as one form.
   */
  { href: '/apply', label: 'My Portal' },
];

/**
 * On the strategy link, because it was briefly dropped from this list on the
 * grounds that it was undesigned. It is not, and as of the "Khanh Linh - Chi"
 * canvas it is no longer even a provenance risk: the whole flow has been
 * REDRAWN onto the dev canvas under a banner frame labelled "Apply"
 * (375:18836). That migration is the signal docs/redesign-status.md calls the
 * only objective one — a frame on the dev canvas is safe to build.
 *
 * The flow, in stepper order (Reflection -> Output report design -> University
 * Detail -> Applycation Strategy -> Submit Audit):
 *
 *   landing 375:18445 · candidate info 375:19260 · achievements 375:18839 ·
 *   reflection modals 407:17291, 408:17403, 409:17502, 409:17626 ·
 *   reflection output 375:18328 · profile portrait 375:18185 ·
 *   university fit 375:18645 · per-university strategy 375:19502, 405:6526 ·
 *   essay feedback 375:17961 · CV analysis 375:18038 · pricing 375:19705 ·
 *   submit 375:18117 · confirmation 375:18594 · major re-picker 375:13546
 *
 * It is NOT /apply. /apply is the applications dashboard — shortlist,
 * deadlines, saved scholarships. The two are separate destinations and must
 * stay separate here. (The sitemap frame that used to be cited for this,
 * 123:2864 "Dg-final", is gone from the file; the separation now rests on the
 * two flows being drawn as two distinct banner groups, "Apply" and "Trang my
 * apply".)
 *
 * The route does not exist yet, so this link 404s until the flow is built.
 * That is deliberate and tracked, unlike the dead link it replaces.
 */

export const MARKETING_NAV_ACTIONS = {
  secondary: { href: '/auth', label: 'Sign in' },
  primary: { href: '/onboarding', label: 'Plan your studies' },
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
