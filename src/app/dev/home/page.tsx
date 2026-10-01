import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  HOME_BANDS_CLASS,
  HomeConsultationProvider,
  HomeContact,
  HomeFeatures,
  getOfficialScholarshipBranding,
  HomeHero,
  HomeJourney,
  HomeMetrics,
  HomePartners,
  HomePricing,
  HomeStories,
  HomeTeam,
  MARKETING_NAV_ACTIONS,
  MARKETING_NAV_ITEMS,
  type ContactState,
} from '@/features/marketing/ui';
import type { GlobeCountry } from '@/features/marketing/domain';
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

/** The seventeen countries `countryCounts()` returned on 2026-09-27. */
const PREVIEW_GLOBE_COUNTRIES: readonly GlobeCountry[] = [
  { name: 'United Kingdom', count: 89 },
  { name: 'United States', count: 83 },
  { name: 'Australia', count: 62 },
  { name: 'Canada', count: 39 },
  { name: 'China', count: 16 },
  { name: 'New Zealand', count: 13 },
  { name: 'Germany', count: 11 },
  { name: 'Ireland', count: 11 },
  { name: 'Singapore', count: 11 },
  { name: 'South Korea', count: 11 },
  { name: 'Hong Kong', count: 9 },
  { name: 'Japan', count: 9 },
  { name: 'France', count: 8 },
  { name: 'Netherlands', count: 7 },
  { name: 'Italy', count: 5 },
  { name: 'Czech Republic', count: 4 },
  { name: 'Hungary', count: 4 },
];

/**
 * Development-only mirror of the sales-journey Home. It keeps the form inert,
 * partner links generic, and the team roster without portraits (initials) so
 * visual checks do not depend on Supabase.
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
    return { status: 'server-error' };
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
      <HomeConsultationProvider>
        <main className={HOME_BANDS_CLASS}>
          <HomeHero countries={PREVIEW_GLOBE_COUNTRIES} />
          <HomePartners scholarships={PREVIEW_SCHOLARSHIPS} scholarshipTotal={2_877} />
          <HomeStories />
          <HomeMetrics />
          <HomeTeam />
          <HomeJourney />
          <HomeFeatures />
          <HomePricing />
          <HomeContact action={previewAction} />
        </main>
      </HomeConsultationProvider>
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
