import { notFound } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  HomeContact,
  HomeFaq,
  HomeFeatures,
  HomeHero,
  HomeHowItWorks,
  HomeMetrics,
  HomePartners,
  HomeScholarships,
  HomeTestimonials,
  MARKETING_NAV_ACTIONS,
  MARKETING_NAV_ITEMS,
  type ContactState,
} from '@/features/marketing/ui';
import { Footer, TopNav } from '@/shared/ui';

/**
 * Home, rebuilt from Figma 104:7113 — development only.
 *
 * The real "/" is untouched until all ten sections land here and the designer
 * has signed each one off; the swap is then one line in src/app/page.tsx. That
 * ordering is deliberate: "/" is the main entry point, and a half-migrated
 * landing page is worse for a real visitor than an old one.
 *
 *   [x] 104:7114  header nav
 *   [x] 104:7126  hero
 *   [x] 104:7135  partner logos
 *   [x] 104:7148  metrics
 *   [~] 104:7164  features        — blocks 2 and 3 await copy, see HomeFeatures
 *   [x] 104:7211  how it works
 *   [~] 104:7225  scholarship rail — cards await copy, see HomeScholarships
 *   [~] 104:7265  testimonials     — quotes await consent, see HomeTestimonials
 *   [~] 104:7347  FAQ              — answers await copy, see HomeFaq
 *   [x] 104:7361  contact
 *   [x] 104:7404  footer
 *
 * ⚠️ FOUR SECTIONS STILL RENDER MissingContent, so this page is not ready to
 * become "/". The swap gate is `grep -rn MissingContent src/features/marketing`
 * returning nothing. Every one of the four is blocked on copy the owner has to
 * write, not on code.
 */
export default function HomePreviewPage() {
  // Same gate as /dev/kitchen-sink: hidden in production, but reachable by the
  // E2E suite, which runs a production build on purpose.
  const enabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_ROUTES === '1';
  if (!enabled) notFound();

  // The preview has no server action to hand the contact form, so it gets one
  // that only ever reports back. The real "/" passes the Supabase-backed action.
  async function previewAction(): Promise<ContactState> {
    'use server';
    return {
      status: 'error',
      message: 'This is the design preview — the form is not wired up here.',
    };
  }

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
        <HomeScholarships />
        <HomeTestimonials />
        <HomeFaq />
        <HomeContact action={previewAction} />
      </main>
      <Footer
        logo={<GlowbalLogo height={28} />}
        tagline={FOOTER_TAGLINE}
        columns={FOOTER_COLUMNS}
        social={FOOTER_SOCIAL}
        copyright={FOOTER_COPYRIGHT}
        ratings={FOOTER_RATINGS}
      />
    </div>
  );
}
