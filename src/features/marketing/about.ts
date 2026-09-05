/**
 * The two compositions `/about` renders, as their own slice.
 *
 * `HomeFaq` is shared with Home, which is why it lives under `ui/` with the
 * Home sections rather than beside the About page. Re-exported here so `/about`
 * can have it without also pulling `home-metrics` → framer-motion through the
 * `marketing/ui` barrel. See docs/performance.md.
 */
export { AboutTeam } from './ui/about-team';
export { HOME_FAQ, HomeFaq } from './ui/home-faq';
export type { FaqEntry } from './ui/home-faq';
