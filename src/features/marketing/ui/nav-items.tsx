import { BRAND_ICONS, BrandIcon, InstagramMark } from '@/shared/ui';
import type { FooterColumn, FooterSocial, TopNavItem } from '@/shared/ui';

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
 * ONE LIST SERVES BOTH STATES, still — but for a narrower reason than before.
 * The two frames no longer draw the same items: signed in drops "Lập kế hoạch
 * du học" because that frame promotes it to the CTA button. That is a property
 * of the CTA slot, not of the item list, and every page here already picks its
 * own `primaryAction` (the saved list and the applications list both use
 * "Search universities"). Splitting the list on the signed-in flag would delete
 * the only /apply link from pages whose CTA points elsewhere — a regression the
 * frame does not ask for. Note the guest frame duplicates the label in both
 * slots anyway, so the design is not consistent on the point.
 *
 * "Tìm trường đại học" is the sixth, added on the product owner's instruction so
 * the desktop bar matches the mobile sheet (375:12205, unchanged from 179:12826)
 * and the university directory keeps a direct entry for the two audiences the
 * design file names at 105:8246: people who want to look around first, and
 * people who already know what they want. The newest frames do not draw it;
 * kept on the owner's standing instruction.
 */
export const MARKETING_NAV_ITEMS: readonly TopNavItem[] = [
  // Figma "Về chúng tôi". The page itself is Figma 153:11401.
  { href: '/about', label: 'About us' },
  // Figma "Lên Chiến lược Du học" — renamed from "AI lên chiến lược" on the new
  // canvas. See the note below; this is a product pillar, not a dead link.
  // The FOOTER still says "Chiến lược AI" (its frame did not change), so the two
  // deliberately carry different labels for the same route.
  { href: '/ai-strategy', label: 'Build your strategy' },
  { href: '/universities', label: 'Search universities' },
  { href: '/apply', label: 'Plan your studies' },
  { href: '/mentors', label: 'Find a mentor' },
  // Figma "Blog". /guides and /news render the same listGeoGuides() data; the
  // nav points at /guides because its detail route (/guides/[slug]) is the one
  // the Blog detail frame (153:20197) maps onto.
  { href: '/guides', label: 'Blog' },
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
      { href: '/mentors', label: 'Student mentors' },
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
