/**
 * marketing/ui — the public-facing page compositions (Home, and later the
 * About / AI-strategy pages).
 *
 * These are compositions, not primitives: anything reusable across features
 * belongs in src/shared/ui instead.
 */
export { HomeContact } from './home-contact';
export type { ContactState } from './home-contact';
export { HOME_FAQ, HomeFaq } from './home-faq';
export type { FaqEntry } from './home-faq';
export { HomeFeatures } from './home-features';
export { HomeHero } from './home-hero';
export { HomeHowItWorks } from './home-how-it-works';
export { HomeMetrics } from './home-metrics';
export { HomePartners } from './home-partners';
export { HomeScholarships } from './home-scholarships';
export type { ScholarshipTeaser } from './home-scholarships';
export { HomeTestimonials } from './home-testimonials';
export type { Testimonial } from './home-testimonials';
export { MissingContent } from './missing-content';
export {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  MARKETING_NAV_ITEMS,
  MARKETING_NAV_ACTIONS,
} from './nav-items';
export { PARTNER_LOGOS } from './partner-logos';
export type { PartnerLogo } from './partner-logos';
