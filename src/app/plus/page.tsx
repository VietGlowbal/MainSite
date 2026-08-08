import type { Metadata } from 'next';
import Link from 'next/link';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { SiteNavigation } from '@/components/site-navigation';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
} from '@/features/marketing/ui';
import {
  FREE_FEATURES,
  GLOWBAL_FB_CHAT_URL,
  PLUS_SALES_ENABLED,
  getPlusPackage,
} from '@/lib/plus';
import { createClient } from '@/lib/supabase/server';
import {
  Badge,
  Button,
  Container,
  Footer,
  ICONS,
  KitIcon,
} from '@/shared/ui';
import { PlusPricing } from './plus-pricing';

/**
 * /plus — GlowBal Plus, rebuilt on the design system 2026-08-02.
 *
 * ⚠️ THERE IS NO FIGMA FRAME FOR THIS PAGE, and that is the whole reason it
 * looked out of date. docs/redesign-status.md files /plus under "designed but
 * not built" against 115:13253 / 132:9601 / 196:16799 / 115:17014 — four frames
 * on the RETIRED "Tính năng" canvas, drawing a free/$10/$100 split that
 * lib/plus.ts stopped matching long ago. Nothing was ever redrawn onto "Khanh
 * Linh - Chi", so the page kept its pre-redesign styling (slate/pink literals,
 * rounded-3xl, gradient pills) while every route around it moved to the tokens.
 * The owner confirmed the page was missed and asked for it to be brought up to
 * the current UI, with room to make it more interesting than the frames were.
 *
 * So this is built from `src/styles/tokens.css` and `src/shared/ui` only — the
 * same standing as `Panel`, `StatTile` and the admin console. Nothing here
 * invents a colour, a radius or a type step, and the three-band rhythm (black
 * hero → muted plans → white comparison → muted close) is the one Home already
 * uses. Two things beyond a straight restyle, both deliberate:
 *
 *  1. The plan cards straddle the hero's bottom edge. See the note in
 *     plus-pricing.tsx for why that is an absolutely positioned strip and not a
 *     negative margin.
 *  2. `?status=cancelled` is answered. Stripe's `cancel_url` has pointed here
 *     since checkout was written (src/app/api/plus/checkout/route.ts) and the
 *     page ignored it, so abandoning payment returned you to an unchanged
 *     pricing page with no confirmation that nothing had been charged.
 *
 * Page chrome is its own (SiteNavigation + Footer), so '/plus' had to be
 * added to OWN_CHROME_ROUTES in src/components/nav-reveal.tsx or the app header
 * renders on top of this one.
 */

export const metadata: Metadata = {
  title: 'GlowBal Plus | Unlock your full scholarship plan',
  description:
    'Upgrade to GlowBal Plus for more AI application strategies, full scholarship details, a document checklist, and priority student-supporter access.',
};

/** What Plus adds, as three claims short enough to read on the hero. */
const HERO_POINTS: readonly { icon: keyof typeof ICONS; label: string }[] = [
  { icon: 'zapFast', label: 'More AI strategy credits' },
  { icon: 'gift01', label: 'Full scholarship details' },
  { icon: 'messageChatCircle', label: 'Priority supporter access' },
];

/**
 * A frosted panel on the black band, for the four states the page can arrive
 * in: fresh from onboarding, back from a cancelled checkout, already on Plus,
 * or sent here by a gated application.
 *
 * Frosted rather than a white card: a white block on the hero reads as a modal
 * that failed to open, and three of the four states are informational.
 */
function HeroNotice({
  emphasis = false,
  children,
}: {
  /** Rose hairline instead of the white one — used for "you are on Plus". */
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex w-full max-w-gb-width-xl flex-col items-center gap-gb-xs rounded-gb-xl border bg-white/8 px-gb-3xl py-gb-2xl text-center ${
        emphasis ? 'border-brand' : 'border-white/12'
      }`}
    >
      {children}
    </div>
  );
}

export default async function PlusPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; application?: string; status?: string }>;
}) {
  const { welcome, application, status } = await searchParams;
  const isWelcome = welcome === '1';
  const isCancelled = status === 'cancelled';
  const applicationId = application ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isPlus = false;
  let planLabel: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('plus_status, plus_plan')
      .eq('user_id', user.id)
      .maybeSingle();
    isPlus = !!profile?.plus_status;
    planLabel = profile?.plus_plan ?? null;
  }

  const currentPlan = getPlusPackage(planLabel);

  const isSignedIn = !!user;

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <SiteNavigation showSaved />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────────
            The rose bloom is a radial gradient on the brand token rather than a
            blurred element: `filter` would make this a containing block for
            fixed descendants, which is exactly what the header dropdown's
            position note in shared/ui/top-nav.tsx warns about. */}
        <section className="relative isolate overflow-hidden bg-surface-inverse-strong pt-gb-9xl pb-gb-6xl">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-1/3 -z-10 h-[120%] bg-[radial-gradient(50%_45%_at_50%_45%,var(--color-gb-brand-600),transparent_70%)] opacity-25"
          />

          <Container className="flex flex-col items-center gap-gb-3xl text-center">
            {isWelcome ? (
              <HeroNotice>
                <p className="text-gb-md font-semibold text-white">
                  🎉 Your profile is set up
                </p>
                <p className="text-gb-sm text-fg-on-inverse-muted">
                  Get the most from GlowBal with Plus — or keep exploring for free.
                </p>
                <Link
                  href="/universities"
                  className="mt-gb-xs text-gb-sm font-semibold text-white underline-offset-4 hover:underline"
                >
                  Maybe later — see my matches →
                </Link>
              </HeroNotice>
            ) : null}

            {isCancelled ? (
              <HeroNotice>
                <p className="text-gb-md font-semibold text-white">Checkout cancelled</p>
                <p className="text-gb-sm text-fg-on-inverse-muted">
                  Nothing was charged. Your plan is unchanged — pick it up again whenever you are
                  ready.
                </p>
              </HeroNotice>
            ) : null}

            {isPlus ? (
              <HeroNotice emphasis>
                <p className="text-gb-md font-semibold text-white">You&rsquo;re on GlowBal Plus</p>
                <p className="text-gb-sm text-fg-on-inverse-muted">
                  Thanks for your support — you can extend your plan any time below.
                </p>
                {/* The stored plan id is not a label; only render a tier name we
                    can resolve, so a stale or unknown id shows nothing rather
                    than "plus-pro". */}
                {currentPlan ? <Badge variant="outline">{currentPlan.name}</Badge> : null}
              </HeroNotice>
            ) : null}

            <Badge variant="outline">GlowBal Plus</Badge>

            <h1 className="max-w-gb-width-xl font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-white md:text-gb-display-xl">
              Unlock your full scholarship plan
            </h1>

            <p className="max-w-gb-width-xl text-gb-md text-fg-on-inverse-muted md:text-gb-xl">
              Go beyond searching — more AI application strategies, full scholarship details, a
              document checklist, and priority student-supporter access. Designed to help you apply
              with a clearer, stronger strategy.
            </p>

            <ul className="flex flex-wrap items-center justify-center gap-gb-lg">
              {HERO_POINTS.map((point) => (
                <li
                  key={point.label}
                  className="inline-flex items-center gap-gb-md rounded-gb-full border border-white/12 bg-white/8 px-gb-2xl py-gb-lg text-gb-sm font-medium text-white"
                >
                  <span className="text-brand">
                    <KitIcon art={ICONS[point.icon]} frame={20} />
                  </span>
                  {point.label}
                </li>
              ))}
            </ul>

            {applicationId ? (
              <HeroNotice>
                <p className="text-gb-sm font-medium text-white">
                  Unlock the full application plan to keep building this application.
                </p>
                <Link
                  href={`/apply/${applicationId}?sop=1`}
                  className="text-gb-sm font-semibold text-fg-on-inverse-muted underline-offset-4 transition-colors hover:text-white hover:underline"
                >
                  Continue with limited plan →
                </Link>
              </HeroNotice>
            ) : null}

            {!PLUS_SALES_ENABLED ? (
              <HeroNotice>
                <p className="text-gb-sm font-semibold text-white">
                  GlowBal Plus is coming soon
                </p>
                <p className="text-gb-sm text-fg-on-inverse-muted">
                  The plans below are a preview — they are not on sale yet. Everything in the Free
                  plan is fully available in the meantime.
                </p>
              </HeroNotice>
            ) : null}
          </Container>
        </section>

        {/* Currency switcher (still on the black band) + tier cards + the
            Free-vs-paid comparison. */}
        <PlusPricing signedIn={isSignedIn} applicationId={applicationId} />

        {/* ── Free plan, and the way out of the funnel ───────────────────── */}
        <section className="bg-surface-muted py-gb-9xl">
          <Container className="flex flex-col gap-gb-4xl">
            <div className="flex flex-col gap-gb-4xl rounded-gb-2xl border border-line bg-surface p-gb-4xl md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 flex-col gap-gb-2xl">
                <div className="flex flex-col gap-gb-xs">
                  <h2 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
                    Continue with the Free plan
                  </h2>
                  <p className="text-gb-md text-fg-tertiary">
                    Everything you need to start — no payment required.
                  </p>
                </div>
                <ul className="grid gap-gb-lg sm:grid-cols-2">
                  {FREE_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-gb-md">
                      <span className="mt-gb-xxs shrink-0 text-brand">
                        <KitIcon art={ICONS.checkCircle} frame={20} />
                      </span>
                      <span className="text-gb-sm text-fg-tertiary">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button href="/universities" size="xl" className="shrink-0">
                Continue free
                <KitIcon art={ICONS.arrowRight} frame={20} />
              </Button>
            </div>

            {/* Talk to a person. The Messenger link is the only support channel
                that exists today, so it is a real destination, not a promise. */}
            <div className="flex flex-col items-center gap-gb-lg rounded-gb-2xl border border-line bg-brand-subtle p-gb-4xl text-center">
              <span className="flex size-gb-6xl items-center justify-center rounded-gb-full bg-brand text-on-brand">
                <KitIcon art={ICONS.messageSmileCircle} frame={24} />
              </span>
              <h2 className="font-display text-gb-xl font-semibold text-fg">
                Not sure which plan fits you?
              </h2>
              <Button
                href={GLOWBAL_FB_CHAT_URL}
                target="_blank"
                rel="noopener noreferrer"
                size="lg"
                variant="secondary"
              >
                Not sure? Chat with our in-house team for more info
              </Button>
            </div>

            {/* Fine print. With sales off nothing is being charged, so the
                payment reassurance is withheld rather than shown against a
                checkout that refuses. */}
            <div className="mx-auto flex max-w-gb-width-xl flex-col items-center gap-gb-md text-center text-gb-xs text-fg-muted">
              {PLUS_SALES_ENABLED ? (
                <>
                  <p className="inline-flex items-center gap-gb-sm">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Payments are processed securely by Stripe.
                  </p>
                  <p>
                    Choose your currency above — you&rsquo;ll be charged in the currency you select;
                    conversions from VND are approximate. GlowBal helps you discover opportunities
                    and prepare stronger applications; it does not guarantee scholarship outcomes.
                  </p>
                </>
              ) : (
                <p>
                  GlowBal helps you discover opportunities and prepare stronger applications; it
                  does not guarantee scholarship outcomes.
                </p>
              )}
            </div>
          </Container>
        </section>
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
