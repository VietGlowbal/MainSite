import { notFound } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import {
  HomeFeatures,
  HomeHero,
  HomeHowItWorks,
  HomeMetrics,
  HomePartners,
  MARKETING_NAV_ACTIONS,
  MARKETING_NAV_ITEMS,
} from '@/features/marketing/ui';
import { TopNav } from '@/shared/ui';

/**
 * Home, rebuilt from Figma 104:7113 — development only.
 *
 * The real "/" is untouched until all nine sections land here and the designer
 * has signed each one off; the swap is then one line in src/app/page.tsx. That
 * ordering is deliberate: "/" is the main entry point, and a half-migrated
 * landing page is worse for a real visitor than an old one.
 *
 * Sections land in the order set out in the plan:
 *   [x] 104:7114  header nav
 *   [x] 104:7126  hero
 *   [x] 104:7135  partner logos
 *   [x] 104:7148  metrics
 *   [~] 104:7164  features        — blocks 2 and 3 await copy, see HomeFeatures
 *   [x] 104:7211  how it works
 *   [ ] 104:7225  testimonials
 *   [ ] 104:7347  FAQ
 *   [ ] 104:7361  contact
 *   [ ] 104:7404  footer
 */
export default function HomePreviewPage() {
  // Same gate as /dev/kitchen-sink: hidden in production, but reachable by the
  // E2E suite, which runs a production build on purpose.
  const enabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_ROUTES === '1';
  if (!enabled) notFound();

  return (
    /* gb-page-full-bleed tells globals.css to drop the sidebar gutter and the
       mobile header offset — this page owns its own chrome. */
    <div className="gb-page-full-bleed bg-surface-inverse-strong">
      <TopNav
        logo={<GlowbalLogo height={28} />}
        items={MARKETING_NAV_ITEMS}
        secondaryAction={MARKETING_NAV_ACTIONS.secondary}
        primaryAction={MARKETING_NAV_ACTIONS.primary}
      />
      <main>
        <HomeHero />
        <HomePartners />
        <HomeMetrics />
        <HomeFeatures />
        <HomeHowItWorks />
      </main>
    </div>
  );
}
