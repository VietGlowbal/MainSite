/**
 * The header/footer half of `marketing/ui`, as its own slice.
 *
 * Why this exists rather than everyone importing `@/features/marketing/ui`:
 * that barrel also re-exports the Home page compositions, and `home-metrics`
 * pulls framer-motion. Reaching it for a footer constant put **247 KB of
 * animation library into the first-load bundle of all 260 routes** — including
 * `/terms`, which animates nothing. `nav-items` itself pulls only icons, types
 * and the locale helper.
 *
 * ⚠️ So: anything mounted globally — the root layout, `SiteNavigation`,
 * `NavReveal` — and any page that only wants chrome must import from here.
 * `@/features/marketing/ui` is for pages that genuinely render the Home
 * compositions. Deep-importing `@/features/marketing/ui/nav-items` is not the
 * workaround: ESLint's `NO_DEEP_FEATURE_IMPORT` blocks three-segment feature
 * paths, and this slice is the sanctioned way through. See
 * `docs/performance.md`.
 */
export {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  getLocalizedFooter,
  getMarketingNavPresentation,
  MARKETING_NAV_ACTIONS,
  MARKETING_NAV_ITEMS,
} from './ui/nav-items';
export type {
  MarketingNavPresentation,
  MarketingNavState,
  MarketingNavTranslator,
} from './ui/nav-items';
