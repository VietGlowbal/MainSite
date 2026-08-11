import Link from 'next/link';
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
  HomePainPoints,
  HomePartners,
  HomeTeam,
  HomeTestimonials,
  MARKETING_NAV_ACTIONS,
  MARKETING_NAV_ITEMS,
  type ContactState,
} from '@/features/marketing/ui';
import { Footer, MobileNav, TopNav } from '@/shared/ui';

/**
 * Development-only mirror of the Home flow from Figma 884:12026. It keeps the
 * form inert, partner links generic, and team roster empty so visual checks do
 * not depend on Supabase.
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
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface-inverse-strong">
      <TopNav
        logo={<GlowbalLogo height={28} />}
        items={MARKETING_NAV_ITEMS}
        secondaryAction={MARKETING_NAV_ACTIONS.secondary}
        primaryAction={MARKETING_NAV_ACTIONS.primary}
      />
      {/* Mirrors "/" — TopNav is desktop-only, so without this the preview has
          no navigation on a phone. */}
      <MobileNav
        logo={
          <Link href="/" aria-label="GlowBal home" className="inline-flex items-center">
            <GlowbalLogo height={28} />
          </Link>
        }
        items={MARKETING_NAV_ITEMS}
        primaryAction={MARKETING_NAV_ACTIONS.primary}
        secondaryAction={MARKETING_NAV_ACTIONS.secondary}
        openLabel="Menu"
        closeLabel="Close menu"
      />
      <main>
        <HomeHero />
        <HomePartners />
        <HomeMetrics />
        <HomePainPoints />
        <HomeHowItWorks />
        <HomeFeatures />
        <HomeTestimonials />
        <HomeTeam />
        <HomeContact action={previewAction} />
        <HomeFaq />
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
