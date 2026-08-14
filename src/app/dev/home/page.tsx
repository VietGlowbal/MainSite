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
  getOfficialScholarshipBranding,
  HomeHero,
  HomeHowItWorks,
  HomeMetrics,
  HomePainPoints,
  HomePartners,
  HomeScholarships,
  HomeTeam,
  HomeTestimonials,
  MARKETING_NAV_ACTIONS,
  MARKETING_NAV_ITEMS,
  type ContactState,
} from '@/features/marketing/ui';
import { Footer, MobileNav, TopNav } from '@/shared/ui';

function previewBranding(title: string) {
  const branding = getOfficialScholarshipBranding(title);
  return {
    scholarshipLogoUrl: branding?.logoUrl ?? null,
    scholarshipLogoTone: branding?.logoTone ?? null,
  };
}

const PREVIEW_SCHOLARSHIPS = [
  {
    id: 147,
    title: 'Rhodes Scholarship',
    href: '/scholarships?q=Rhodes%20Scholarship',
    organization: 'University of Oxford',
    ...previewBranding('Rhodes Scholarship'),
    universityLogoUrl: 'https://uooshbumyilwvbgmbixx.supabase.co/storage/v1/object/public/university-images/universities/00022-university-of-oxford/logo.webp',
    value: 'Full ride',
    valueLabel: 'What it covers',
    ranking: 'Most prestigious',
    deadline: 'Aug–Oct',
    fundingTypes: ['full_ride', 'merit'],
    country: 'United Kingdom',
  },
  {
    id: 140,
    title: 'Gates Cambridge',
    href: '/scholarships?q=Gates%20Cambridge',
    organization: 'University of Cambridge',
    ...previewBranding('Gates Cambridge'),
    universityLogoUrl: 'https://uooshbumyilwvbgmbixx.supabase.co/storage/v1/object/public/university-images/universities/00023-university-of-cambridge/logo.webp',
    value: 'Full ride',
    valueLabel: 'What it covers',
    ranking: 'Top global',
    deadline: 'Oct–Dec',
    fundingTypes: ['full_ride', 'need_based'],
    country: 'United Kingdom',
  },
  {
    id: 129,
    title: 'Lester B. Pearson Scholarship',
    href: '/scholarships?q=Lester%20B.%20Pearson%20Scholarship',
    organization: 'University of Toronto',
    universityLogoUrl: 'https://uooshbumyilwvbgmbixx.supabase.co/storage/v1/object/public/university-images/universities/00032-university-of-toronto/logo.webp',
    value: 'Full tuition + residence + books',
    valueLabel: 'What it covers',
    ranking: 'Top Canada',
    deadline: 'Oct–Nov',
    fundingTypes: ['full_tuition', 'merit'],
    country: 'Canada',
  },
  {
    id: 139,
    title: 'Knight-Hennessy',
    href: '/scholarships?q=Knight-Hennessy',
    organization: 'Stanford University',
    ...previewBranding('Knight-Hennessy'),
    universityLogoUrl: 'https://uooshbumyilwvbgmbixx.supabase.co/storage/v1/object/public/university-images/universities/00003-stanford-university/logo.webp',
    value: 'Full ride',
    valueLabel: 'What it covers',
    ranking: 'Top global',
    deadline: 'Oct',
    fundingTypes: ['merit', 'leadership'],
    country: 'United States',
  },
  {
    id: 136,
    title: 'Nanyang Scholarship',
    href: '/scholarships?q=Nanyang%20Scholarship',
    organization: 'Nanyang Technological University',
    universityLogoUrl: 'https://uooshbumyilwvbgmbixx.supabase.co/storage/v1/object/public/university-images/universities/00072-nanyang-technological-university-ntu/logo.webp',
    value: 'Full package',
    valueLabel: 'What it covers',
    ranking: 'Top Singapore',
    deadline: 'Mar',
    fundingTypes: ['full_tuition', 'merit'],
    country: 'Singapore',
  },
  {
    id: 153,
    title: 'Yenching Academy',
    href: '/scholarships?q=Yenching%20Academy',
    organization: 'Peking University',
    ...previewBranding('Yenching Academy'),
    universityLogoUrl: 'https://uooshbumyilwvbgmbixx.supabase.co/storage/v1/object/public/university-images/universities/00058-peking-university/logo.webp',
    value: 'Full ride',
    valueLabel: 'What it covers',
    ranking: 'Top China Studies',
    deadline: 'Dec',
    fundingTypes: ['full_ride', 'merit'],
    country: 'China',
  },
] as const;

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
        <HomeScholarships entries={PREVIEW_SCHOLARSHIPS} total={2_877} />
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
