import type { Metadata } from 'next';
import { Suspense } from 'react';
import { unstable_cache } from 'next/cache';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { SiteNavigation } from '@/components/site-navigation';
import { getUniversityQueries } from '@/features/universities/api';
import { getScholarshipQueries } from '@/features/scholarships/api';
import { CACHE_TAGS, CACHE_TTL_LONG } from '@/server/cache';
import {
  HOME_BANDS_CLASS,
  HomeConsultationProvider,
  HomeFeatures,
  getOfficialScholarshipBranding,
  HomeHero,
  HomeJourney,
  HomeMetrics,
  HomePartners,
  HomePricing,
  HomeStories,
  HomeTeam,
  PARTNER_LOGOS,
  type ContactState,
  getLocalizedFooter,
} from '@/features/marketing/ui';
import {
  consultationNotes,
  dialCodeFor,
  validateConsultation,
  type GlobeCountry,
} from '@/features/marketing/domain';
import { recordWaitlistSignup } from '@/features/marketing/api';
import { waitlistConfirmationEmail } from '@/lib/emails/waitlist-confirmation';
import { HomeContactSection } from './home-contact-section';
import { sendEmail } from '@/lib/send-email';
import { Footer } from '@/shared/ui';
import { RateLimiter } from '@/lib/rate-limiter/rate-limiter';
import { headers } from 'next/headers';
import { getTeamMembers } from '@/lib/team';
import { SITE_URL } from '@/lib/site-url';
import { buildOrganizationJsonLd, buildWebSiteJsonLd, serializeJsonLd } from '@/lib/seo/json-ld';
import { buildLocaleAlternates } from '@/lib/seo/alternates';
import { homeCopy, type Locale } from '@/lib/i18n/locale';

/**
 * Five consultation requests per IP per hour. Generous for a person filling the
 * form in twice, useless for a script. See the note in `submitContact`.
 */
const contactLimiter = new RateLimiter({ maxRequests: 5, windowMs: 60 * 60 * 1000 });

/**
 * "/" — Home, the sales-journey redesign (design handoff
 * `design_handoff_home_redesign/`, brief
 * docs/plans/2026-09-27-home-sales-journey-design-brief.md). One funnel: every
 * CTA on the page ends at the consultation form (`#contact`).
 *
 * Order: Hero · Scholarship showcase · Success stories · Standout numbers ·
 * Team · Your GlowBal journey · Product features · Pricing · Consultation form.
 * Removed from Home by the brief: the pain points and the five-step how-it-works
 * (both replaced by the journey), the scholarship pillars, and the FAQ (which
 * still renders on /about).
 */

export const metadata: Metadata = {
  title: homeCopy.en.metadataTitle,
  description: homeCopy.en.metadataDescription,
  keywords: [
    'study abroad scholarships',
    'university scholarships',
    'international student scholarships',
    'find universities abroad',
    'AI scholarship application strategy',
    'study abroad support',
    'scholarships for Vietnamese students',
    'global university search',
    'GlowBal education',
    'học bổng du học',
    'du học',
  ],
  alternates: buildLocaleAlternates('/'),
  openGraph: {
    title: homeCopy.en.metadataTitle,
    description: homeCopy.en.metadataDescription,
    url: SITE_URL,
    siteName: 'GlowBal',
    images: [
      {
        url: '/glowbal-logo.png',
        width: 1200,
        height: 630,
        alt: 'GlowBal - Find Universities, Scholarships & Study Abroad Support',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: homeCopy.en.metadataTitle,
    description: homeCopy.en.metadataDescription,
    images: ['/glowbal-logo.png'],
  },
};

// ⚠️ THIS PAGE NO LONGER PRERENDERS, and this line does not make it. Nothing
// *here* reads per-request state, but `app/layout.tsx` awaits `headers()` for
// the locale, and a dynamic API in the root layout takes every route with it:
// `next build` marks 257 of 261 routes `ƒ Dynamic`, this one included. So "/"
// is server-rendered per request and `revalidate` only bounds the
// `unstable_cache` entries below, not a full-route cache. Measured 2026-09-08:
// TTFB 21-66ms once those caches are warm, 603ms on the first request after
// they expire — and with no `loading.tsx` or `<Suspense>` here, that 603ms is
// blank screen, because nothing flushes before the three reads resolve.
// The 12h window was kept from the previous landing page "ready for the first
// section that does take a Supabase read" — the partner orbit below is that
// section. See docs/performance.md.
export const revalidate = 43200;

/**
 * Row ids for the eleven crests in the partner orbit, so each one can link to
 * its university's page.
 *
 * The ids cannot live next to the logos: `/universities/[id]` is keyed on the
 * numeric row id (there is no slug column — see that page's header), and the
 * logo list is a static file. So the names are matched to rows here, once, and
 * handed down positionally.
 *
 * Cached rather than read per render for the obvious reason, but note the two
 * layers are not redundant: `revalidate` above regenerates the page, while this
 * entry is also tagged, so `revalidateUniversities()` after an import corrects
 * the links immediately instead of up to twelve hours later.
 *
 * Unresolved names come back absent, and HomePartners falls back to the
 * directory index for those — see the ⚠️ on `findIdsByNames`. That is what keeps
 * a rename in the `universities` table from turning a crest into a 404.
 */
const getPartnerUniversityIdsCached = unstable_cache(
  async (): Promise<(number | null)[]> => {
    const idsByName = await getUniversityQueries().findIdsByNames(
      PARTNER_LOGOS.map((logo) => logo.name),
    );
    return PARTNER_LOGOS.map((logo) => idsByName[logo.name] ?? null);
  },
  ['home-partner-university-ids'],
  { revalidate: CACHE_TTL_LONG, tags: [CACHE_TAGS.universities] },
);

/**
 * Countries the hero globe lights, with their scholarship counts. Fail-soft:
 * with no data the globe is simply grey land, never a broken hero.
 */
async function getGlobeCountries(): Promise<GlobeCountry[]> {
  try {
    const counts = await getScholarshipQueries().countryCounts();
    return counts.map(({ country, count }) => ({ name: country, count }));
  } catch (error) {
    console.error('Home globe countries failed:', error);
    return [];
  }
}

/**
 * The all-null fallback lives OUTSIDE the cache on purpose: a database error
 * throws through `unstable_cache` uncached, so the next request retries instead
 * of serving unlinked crests for twelve hours.
 */
async function getPartnerUniversityIds(): Promise<(number | null)[]> {
  try {
    return await getPartnerUniversityIdsCached();
  } catch (error) {
    console.error('Home partner university ids failed:', error);
    return PARTNER_LOGOS.map(() => null);
  }
}

function compactCoverage(value: string | null): string {
  if (!value) return 'Funding support available';
  const firstLine = value
    .split(/\r?\n|\|/)
    .map((part) => part.trim())
    .find(Boolean) ?? value.trim();
  return firstLine.length > 76 ? `${firstLine.slice(0, 73).trimEnd()}…` : firstLine;
}

/**
 * Home needs six records and one count, not the full scholarship directory.
 * The repository ranks the explicitly editorialised records and caches the
 * result with the same invalidation tag as `/scholarships`.
 */
async function getHomeScholarshipSpotlight() {
  try {
    const result = await getScholarshipQueries().homeHighlights(6);
    return {
      total: result.total,
      entries: result.items.map((scholarship) => {
        const university = scholarship.universities[0];
        const officialBranding = getOfficialScholarshipBranding(scholarship.name);
        return {
          id: scholarship.id,
          title: scholarship.name,
          href: `/scholarships?q=${encodeURIComponent(scholarship.name)}`,
          organization:
            university?.name ??
            officialBranding?.organization ??
            scholarship.provider ??
            scholarship.country ??
            'Global scholarship',
          scholarshipLogoUrl: officialBranding?.logoUrl ?? null,
          scholarshipLogoTone: officialBranding?.logoTone ?? null,
          universityLogoUrl: university?.logo_url ?? null,
          value: scholarship.amountLabel ?? compactCoverage(scholarship.coverage),
          valueLabel: scholarship.amountLabel ? 'Award value' : 'What it covers',
          coverage: scholarship.amountLabel ? compactCoverage(scholarship.coverage) : null,
          ranking: scholarship.ranking_note,
          deadline: scholarship.deadlineLabel,
          fundingTypes: scholarship.funding_type,
          country:
            scholarship.country ?? university?.country ?? officialBranding?.country ?? null,
          kind: scholarship.scope === 'university' ? ('university' as const) : ('provider' as const),
          eligibility: scholarship.eligibility,
        };
      }),
    };
  } catch (error) {
    console.error('Home scholarship spotlight failed:', error);
    return { total: 0, entries: [] };
  }
}

/**
 * The consultation form (sales-journey handoff §9).
 *
 * It writes to `waitlist_signups`, the same table the pre-launch /coming-soon
 * gate uses, through the marketing repository rather than a second inline
 * admin-client insert. That is what took this file off ADMIN_CLIENT_DEBT in
 * eslint.config.mjs — a list that may shrink and must never grow.
 *
 * Validation is the same `validateConsultation` the form runs in the browser —
 * the browser's run is for instant feedback, this one is the one that counts.
 *
 * ⚠️ WHERE EACH FIELD GOES. Name, email, phone and date of birth go to their
 * columns. Destination, budget and package go to their own columns added by
 * sql/supabase-waitlist-consultation-fields.sql (a follow-up, never an edit to
 * the already-run sql/supabase-waitlist.sql) AND into `notes` as one labelled
 * line via `consultationNotes`. The line is what a person reads in the
 * dashboard, and it is also what keeps the answers if this deploys before the
 * migration runs — the repository then retries without the new columns.
 * `source` is 'home_consultation', so these leads are distinguishable from the
 * /coming-soon waitlist's 'website_waitlist'.
 */
async function submitContact(
  _prevState: ContactState,
  formData: FormData,
): Promise<ContactState> {
  'use server';

  /*
   * ⚠️ RATE LIMITED BECAUSE THIS ACTION SENDS MAIL TO AN ADDRESS THE CALLER
   * TYPES. Without a limit it is an open relay in miniature: a script can post
   * this form in a loop and have our domain deliver "You're on the GLOWBAL
   * waitlist" to any inbox it likes. That burns sender reputation, and it is on
   * "/", the most reachable page on the site.
   *
   * Keyed on the client IP rather than the email, because the email is the
   * attacker-controlled part — limiting per-address stops nothing.
   *
   * ⚠️ In-memory, so the limit is per server instance. On multi-instance
   * hosting the effective ceiling multiplies by the instance count. That is a
   * real weakening, not a fix to skip: it turns an unbounded amplifier into a
   * bounded one. A durable fix is a shared store (the limiter's README covers
   * Upstash) or a captcha.
   */
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for') ?? '';
  const clientIp = forwarded.split(',')[0]?.trim() || headerList.get('x-real-ip') || 'unknown';

  const limit = contactLimiter.checkLimit(`contact:${clientIp}`);
  if (!limit.allowed) return { status: 'rate-limited' };

  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === 'string' ? value : '';
  };
  const validation = validateConsultation({
    name: field('name'),
    dob: field('dob'),
    email: field('email'),
    dialCode: field('dialCode'),
    phone: field('phone'),
    destination: field('destination'),
    budget: field('budget'),
    package: field('package'),
    consent: formData.get('consent') !== null,
  });
  if (!validation.ok) return { status: 'invalid', errors: validation.errors };

  const { request } = validation;
  const result = await recordWaitlistSignup({
    email: request.email,
    firstName: request.name,
    notes: consultationNotes(request),
    phone: `${dialCodeFor(request.dialCode)} ${request.phone}`.trim(),
    dateOfBirth: request.dateOfBirth,
    source: 'home_consultation',
    consultation: {
      destination: request.destination,
      budget: request.budget,
      package: request.package,
    },
  });

  if (result.outcome === 'table-missing' || result.outcome === 'error') {
    return { status: 'server-error' };
  }

  // Only a genuinely new signup gets the confirmation mail; re-submitting the
  // form must not send it a second time. The success panel only says "we've
  // emailed you" when the mailer actually accepted one.
  let emailed = false;
  if (result.outcome === 'inserted') {
    const sent = await sendEmail({
      to: request.email,
      subject: "We've received your GlowBal consultation request",
      html: waitlistConfirmationEmail(request.name),
    });
    emailed = sent.ok && sent.skipped !== true;
  }

  return { status: 'ok', email: request.email, emailed };
}

async function HomeHeroData({ data, locale }: {
  data: ReturnType<typeof getGlobeCountries>;
  locale: Locale;
}) {
  return <HomeHero locale={locale} countries={await data} />;
}

async function HomePartnersData({ data, locale }: {
  data: Promise<[Awaited<ReturnType<typeof getPartnerUniversityIds>>, Awaited<ReturnType<typeof getHomeScholarshipSpotlight>>]>;
  locale: Locale;
}) {
  const [universityIds, spotlight] = await data;
  return <HomePartners universityIds={universityIds} locale={locale} scholarships={spotlight.entries} scholarshipTotal={spotlight.total} />;
}

async function HomeTeamData({ data, locale }: {
  data: ReturnType<typeof getTeamMembers>;
  locale: Locale;
}) {
  return <HomeTeam members={await data} locale={locale} />;
}

export async function MarketingHome({ locale = 'en' }: { locale?: Locale } = {}) {
  // Start every read together, but let the actual sections stream independently.
  // The existing views reserve their layout while the data is pending.
  const globeCountries = getGlobeCountries();
  const partners = Promise.all([getPartnerUniversityIds(), getHomeScholarshipSpotlight()]);
  const team = getTeamMembers();

  const copy = homeCopy[locale];
  const footer = getLocalizedFooter(locale);
  const homeJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      buildOrganizationJsonLd({ description: copy.metadataDescription }),
      buildWebSiteJsonLd({ description: copy.metadataDescription, inLanguage: [locale] }),
    ],
  };

  return (
    /* gb-page-full-bleed tells globals.css to drop the sidebar gutter and the
       mobile header offset — this page owns its own chrome. It also has to be
       listed in OWN_CHROME_ROUTES in src/components/nav-reveal.tsx, or the
       legacy app sidebar renders on top of it. */
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface-inverse-strong">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(homeJsonLd) }}
      />
      <SiteNavigation tone="dark" locale={locale} />
      {/* TopNav is desktop-only (hidden below md). Without this the landing
          page has NO navigation on a phone at all: "/" is in OWN_CHROME_ROUTES,
          so the legacy mobile nav is suppressed too. `gb-has-mobile-header` on
          the wrapper is what offsets the content past the fixed 64px bar. */}
      {/* The provider carries a Pricing CTA's package down to the form. Every
          section between them is still a server component — a client provider
          passes server-rendered children straight through. */}
      <HomeConsultationProvider>
        {/* The sections are one black → rose → white background ramp; see
            HOME_BANDS_CLASS for why each one overlaps the next by 1px. */}
        <main className={HOME_BANDS_CLASS}>
          <Suspense fallback={<HomeHero locale={locale} />}>
            <HomeHeroData locale={locale} data={globeCountries} />
          </Suspense>
          {/* The six highlighted records feed the library preview the
              "Find scholarships" button opens. */}
          <Suspense fallback={<HomePartners locale={locale} />}>
            <HomePartnersData locale={locale} data={partners} />
          </Suspense>
          <HomeStories locale={locale} />
          <HomeMetrics locale={locale} />
          <Suspense fallback={<HomeTeam locale={locale} />}>
            <HomeTeamData locale={locale} data={team} />
          </Suspense>
          <HomeJourney locale={locale} />
          <HomeFeatures locale={locale} />
          <HomePricing locale={locale} />
          <HomeContactSection action={submitContact} locale={locale} />
        </main>
      </HomeConsultationProvider>
      <Footer
        logo={<GlowbalLogo height={28} />}
        tagline={footer.tagline}
        columns={footer.columns}
        social={footer.social}
        copyright={footer.copyright}
        ratings={footer.ratings}
      />
    </div>
  );
}

export default async function Home() {
  return <MarketingHome locale="en" />;
}
