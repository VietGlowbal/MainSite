import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { SiteNavigation } from '@/components/site-navigation';
import { getUniversityQueries } from '@/features/universities/api';
import { getScholarshipQueries } from '@/features/scholarships/api';
import { CACHE_TAGS, CACHE_TTL_LONG } from '@/server/cache';
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
  PARTNER_LOGOS,
  type ContactState,
} from '@/features/marketing/ui';
import { recordWaitlistSignup } from '@/features/marketing/api';
import { waitlistConfirmationEmail } from '@/lib/emails/waitlist-confirmation';
import { sendEmail } from '@/lib/send-email';
import { Footer } from '@/shared/ui';
import { RateLimiter } from '@/lib/rate-limiter/rate-limiter';
import { headers } from 'next/headers';
import { getTeamMembers } from '@/lib/team';

/**
 * Five consultation requests per IP per hour. Generous for a person filling the
 * form in twice, useless for a script. See the note in `submitContact`.
 */
const contactLimiter = new RateLimiter({ maxRequests: 5, windowMs: 60 * 60 * 1000 });

/**
 * "/" — Home, rebuilt from Figma 884:12026. Home.md owns the final copy and
 * the Figma frame owns the section order and responsive visual direction.
 */

export const metadata: Metadata = {
  title: 'GlowBal | Find Universities, Scholarships & Study Abroad Support',
  description:
    'GlowBal helps students discover global universities, find scholarships, and build application strategies with AI and real student supporters.',
  keywords: [
    'study abroad scholarships',
    'university scholarships',
    'international student scholarships',
    'find universities abroad',
    'AI scholarship application strategy',
    'study abroad support',
    'scholarships for Vietnamese students',
    'global university search',
  ],
};

// Nothing on this page reads PER-REQUEST state, so it still prerenders. The 12h
// window was kept from the previous landing page "ready for the first section
// that does take a Supabase read" — the partner orbit below is now that section.
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
const getPartnerUniversityIds = unstable_cache(
  async (): Promise<(number | null)[]> => {
    const idsByName = await getUniversityQueries().findIdsByNames(
      PARTNER_LOGOS.map((logo) => logo.name),
    );
    return PARTNER_LOGOS.map((logo) => idsByName[logo.name] ?? null);
  },
  ['home-partner-university-ids'],
  { revalidate: CACHE_TTL_LONG, tags: [CACHE_TAGS.universities] },
);

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
        };
      }),
    };
  } catch (error) {
    console.error('Home scholarship spotlight failed:', error);
    return { total: 0, entries: [] };
  }
}

/**
 * The consultation form (Figma 104:7361).
 *
 * It writes to `waitlist_signups`, the same table the pre-launch /coming-soon
 * gate uses, through the marketing repository rather than a second inline
 * admin-client insert. That is what took this file off ADMIN_CLIENT_DEBT in
 * eslint.config.mjs — a list that may shrink and must never grow.
 *
 * ⚠️ The table has three columns (email, first_name, notes), while the form also
 * captures a phone number. The phone number is appended to the notes so nothing
 * the student typed is silently dropped. The
 * real fix is columns; until then this is lossy-but-visible rather than lossy-
 * and-silent.
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
  if (!limit.allowed) {
    return {
      status: 'error',
      message: `Too many requests. Please try again in ${limit.retryAfter} seconds.`,
    };
  }

  const email = String(formData.get('email') || '').trim().toLowerCase();
  const firstName = String(formData.get('firstName') || '').trim();
  const lastName = String(formData.get('lastName') || '').trim();
  const notes = String(formData.get('notes') || '').trim();
  const dialCode = String(formData.get('dialCode') || '').trim();
  const phone = String(formData.get('phone') || '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'error', message: 'Please enter a valid email address.' };
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  const result = await recordWaitlistSignup({
    email,
    firstName: fullName,
    notes,
    phone: phone ? `${dialCode} ${phone}`.trim() : '',
    dateOfBirth: '',
  });

  if (result.outcome === 'table-missing' || result.outcome === 'error') {
    return {
      status: 'error',
      message: 'Something went wrong saving your details. Please try again.',
    };
  }

  // Only a genuinely new signup gets the confirmation mail; re-submitting the
  // form must not send it a second time.
  if (result.outcome === 'inserted') {
    await sendEmail({
      to: email,
      subject: "You're on the GLOWBAL waitlist",
      html: waitlistConfirmationEmail(firstName),
    });
  }

  return { status: 'ok', message: "Thanks — we'll be in touch shortly." };
}

export default async function Home() {
  const [partnerUniversityIds, team, scholarshipSpotlight] = await Promise.all([
    getPartnerUniversityIds(),
    getTeamMembers(),
    getHomeScholarshipSpotlight(),
  ]);

  return (
    /* gb-page-full-bleed tells globals.css to drop the sidebar gutter and the
       mobile header offset — this page owns its own chrome. It also has to be
       listed in OWN_CHROME_ROUTES in src/components/nav-reveal.tsx, or the
       legacy app sidebar renders on top of it. */
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface-inverse-strong">
      <SiteNavigation tone="dark" />
      {/* TopNav is desktop-only (hidden below md). Without this the landing
          page has NO navigation on a phone at all: "/" is in OWN_CHROME_ROUTES,
          so the legacy mobile nav is suppressed too. `gb-has-mobile-header` on
          the wrapper is what offsets the content past the fixed 64px bar. */}
      <main>
        <HomeHero />
        <HomePartners universityIds={partnerUniversityIds} />
        <HomeMetrics />
        <HomeScholarships
          entries={scholarshipSpotlight.entries}
          total={scholarshipSpotlight.total}
        />
        <HomePainPoints />
        <HomeHowItWorks />
        <HomeFeatures />
        <HomeTestimonials />
        <HomeTeam members={team} />
        <HomeContact action={submitContact} />
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
