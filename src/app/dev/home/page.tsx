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
  HomePartners,
  HomeScholarships,
  HomeTestimonials,
  MARKETING_NAV_ACTIONS,
  MARKETING_NAV_ITEMS,
  type ContactState,
} from '@/features/marketing/ui';
import { Footer, MobileNav, TopNav } from '@/shared/ui';

/**
 * Home, rebuilt from Figma 375:9844 — development only.
 *
 * THE SWAP HAS HAPPENED: "/" now renders this composition (src/app/page.tsx).
 * This route did not go away with it, because the two are deliberately not the
 * same page. "/" drops the sections whose copy is still missing; this one keeps
 * every section, placeholders included, so the gaps stay visible to us instead
 * of quietly disappearing from the only place anyone would notice them.
 *
 *   [x] 375:9845  header nav
 *   [x] 375:9857  hero              — rewritten, scholarship-first
 *   [x] 104:7135  partner logos
 *   [x] 375:9879  metrics           — five figures, supplied by the designer
 *   [~] 104:7164  features          — blocks 2 and 3 await copy; "/" hides them
 *   [x] 104:7211  how it works
 *   [x] 104:7225  scholarship rail  — "/" feeds it real published rows
 *   [~] 104:7265  testimonials      — quotes await consent; NOT on "/"
 *   [~] 104:7347  FAQ               — answers await copy; NOT on "/"
 *   [x] 104:7361  contact
 *   [x] 104:7404  footer
 *
 * ⚠️ THE PREVIEW RENDERS NO REAL DATA. The rail is empty here, the contact form
 * is inert, and the partner crests all link to /universities rather than to
 * eleven specific pages — all three need server reads that belong to the route,
 * not to a design preview. Check any of them against "/", not against this page.
 * The orbit's animation, the heading's flip and the shockwave are unaffected;
 * they are the reason this preview exists.
 *
 * Two sections are still blocked on copy the owner has to write, not on code.
 * When both land, delete the showPlaceholders prop and the two omissions in
 * src/app/page.tsx, and this file becomes a plain duplicate worth removing.
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
