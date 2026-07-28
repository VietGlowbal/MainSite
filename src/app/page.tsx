import type { Metadata } from 'next';
import { GlowbalLogo } from '@/components/glowbal-logo';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  HomeContact,
  HomeFeatures,
  HomeHero,
  HomeHowItWorks,
  HomeMetrics,
  HomePartners,
  HomeScholarships,
  MARKETING_NAV_ACTIONS,
  MARKETING_NAV_ITEMS,
  type ContactState,
} from '@/features/marketing/ui';
import { recordWaitlistSignup } from '@/features/marketing/api';
import { waitlistConfirmationEmail } from '@/lib/emails/waitlist-confirmation';
import { sendEmail } from '@/lib/send-email';
import { Footer, MobileNav, TopNav } from '@/shared/ui';
import Link from 'next/link';

/**
 * "/" — Home, rebuilt from Figma 375:9844 on the "Khanh Linh - Chi" canvas.
 *
 * This replaced the 976-line legacy landing at src/components/landing/home,
 * which was the last big page still built on globals.css class names. The
 * composition is the one that was proven at /dev/home first; that route stays
 * as the design preview and is now the ONLY place the unwritten sections are
 * still visible.
 *
 * ⚠️ TWO SECTIONS ARE NOT HERE, and their absence is deliberate:
 *
 *   HomeTestimonials  quotes need real students and their consent
 *   HomeFaq           every answer is a claim about pricing, staffing or process
 *
 * Both render `MissingContent` until the owner writes them, and a dashed "copy
 * missing" box is not something a real visitor should see. Two more sections are
 * here but told to drop their placeholders:
 *
 *   HomeFeatures      showPlaceholders={false} — blocks 2 and 3 have no copy,
 *                     and no block has a mockup asset
 *   HomeScholarships  showPlaceholders={false} — the card needs an awarding
 *                     body and `scholarships.provider` is null on all 2,877
 *                     published rows, so the heading and "See more" ship
 *                     without cards. See the note on that component.
 *
 * Adding any of them back is one line once the data or copy lands — /dev/home
 * keeps the full composition, placeholders included.
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

// Nothing on this page reads per-request state, so it prerenders. The 12h
// window is kept from the previous landing page, ready for the first section
// that does take a Supabase read.
export const revalidate = 43200;

/**
 * The consultation form (Figma 104:7361).
 *
 * It writes to `waitlist_signups`, the same table the pre-launch /coming-soon
 * gate uses, through the marketing repository rather than a second inline
 * admin-client insert. That is what took this file off ADMIN_CLIENT_DEBT in
 * eslint.config.mjs — a list that may shrink and must never grow.
 *
 * ⚠️ The table has three columns (email, first_name, notes) and the form has
 * six fields. Last name is joined onto the first, and the phone number is
 * appended to the notes, so nothing the student typed is silently dropped. The
 * real fix is columns; until then this is lossy-but-visible rather than lossy-
 * and-silent.
 */
async function submitContact(
  _prevState: ContactState,
  formData: FormData,
): Promise<ContactState> {
  'use server';

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
  const noteLines = [notes, phone ? `Phone: ${dialCode} ${phone}`.trim() : ''].filter(Boolean);

  const result = await recordWaitlistSignup({
    email,
    firstName: fullName,
    notes: noteLines.join('\n\n'),
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

export default function Home() {
  return (
    /* gb-page-full-bleed tells globals.css to drop the sidebar gutter and the
       mobile header offset — this page owns its own chrome. It also has to be
       listed in OWN_CHROME_ROUTES in src/components/nav-reveal.tsx, or the
       legacy app sidebar renders on top of it. */
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface-inverse-strong">
      <TopNav
        logo={<GlowbalLogo height={28} />}
        items={MARKETING_NAV_ITEMS}
        secondaryAction={MARKETING_NAV_ACTIONS.secondary}
        primaryAction={MARKETING_NAV_ACTIONS.primary}
      />
      {/* TopNav is desktop-only (hidden below md). Without this the landing
          page has NO navigation on a phone at all: "/" is in OWN_CHROME_ROUTES,
          so the legacy mobile nav is suppressed too. `gb-has-mobile-header` on
          the wrapper is what offsets the content past the fixed 64px bar. */}
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
        <HomeFeatures showPlaceholders={false} />
        <HomeHowItWorks />
        <HomeScholarships showPlaceholders={false} />
        <HomeContact action={submitContact} />
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
