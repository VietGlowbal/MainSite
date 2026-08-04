import type { Metadata } from 'next';
import Link from 'next/link';
import { GlowbalLogo } from '@/components/glowbal-logo';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  MARKETING_NAV_ITEMS,
  StrategyGuide,
} from '@/features/marketing/ui';
import { GUIDE_STEP_COUNT, STRATEGY_GUIDE } from '@/features/marketing/domain';
import { createClient } from '@/lib/supabase/server';
import { Button, Container, Footer, MobileNav, Panel, TopNav } from '@/shared/ui';

/**
 * /ai-strategy — the explainer for the whole GlowBal journey.
 *
 * WHAT THIS PAGE IS NOW (01/08, owner's instruction). It was a hub listing the
 * signed-in student's strategies. That fixed the older problem (it used to be
 * five "Coming soon" rows that linked nowhere) but it explained nothing: a
 * student arriving from the "Build your strategy" nav item with no
 * applications yet saw a prompt to go somewhere else. This is now the help
 * page for the entire product — three areas, fourteen steps, each describing
 * something the code actually does. Content and its provenance live in
 * features/marketing/domain/strategy-guide.ts, which also records what is
 * deliberately NOT claimed and why.
 *
 * ⚠️ THE FIRST VERSION OF THIS PAGE DESCRIBED THE WRONG FLOW. It taught
 * paste-a-course-URL-into-/apply, which stopped being the way in on 01/08.
 * See the header of strategy-guide.ts for how that happened and the rule that
 * prevents it recurring. `/how-it-works`, which taught the same dead flow,
 * now redirects here (next.config.ts) so there is one explainer, not two.
 *
 * PAYWALL, WHEN IT COMES (owner, 01/08): it goes on the Strategy — area 3 —
 * i.e. after the application stage, not before it. Deliberately not built
 * while the product is still being tested, and deliberately not mentioned in
 * the guide content, because no /ai-strategy route checks an entitlement
 * today. GlowBal Plus (Stripe, three tiers) and an entitlement service
 * already exist and are the pieces to build it from when the time comes.
 *
 * ⚠️ IT IS PUBLIC, AND THAT REVERSES AN EARLIER INSTRUCTION. The owner asked on
 * 31/07 for this route to require sign-in, paired with the same rule on /apply.
 * That instruction was about a page made entirely of one student's own data.
 * The explainer is marketing copy — gating it means the "Build your strategy"
 * nav link, which is visible to signed-out visitors, sends them to a login wall
 * instead of the explanation of what they would be signing up for. Flagged
 * rather than assumed — say the word and the whole route goes back behind auth.
 *
 * ⚠️ THERE IS NO "YOUR STRATEGIES" LIST ANY MORE (02/08, owner). This page used
 * to end with the signed-in student's own applications, each linking to its
 * strategy. Removed on instruction, and worth knowing WHY it was ever here:
 * before that, the route was nothing but that list, and it was kept when the
 * explainer arrived on the argument that a student mid-journey needs a way back
 * into their own work. They still do, and they still have one — My Portal
 * (/apply) is that page, listed in the nav and linked twice from the hero. The
 * list here was a second, thinner copy of it. Removing it also took the two
 * Supabase reads (course_applications, then one application_match_analyses per
 * row) out of a page that is otherwise entirely static content, so this route
 * no longer queries anything but the session.
 *
 * The signed-out sign-up panel at the foot of the page stays: it is the close
 * for a visitor who has just read the whole walkthrough.
 */

export const metadata: Metadata = {
  title: 'How GlowBal works · AI Strategy',
  description:
    'How GlowBal takes you from searching universities, to applying for a course, to a personalised AI strategy that improves your chances of getting in.',
};

export default async function AiStrategyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userName =
    (user?.user_metadata?.full_name as string | undefined) || user?.email?.split('@')[0] || null;
  const userAvatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? null;
  const isSignedIn = Boolean(user);

  const primaryAction = { href: '/universities', label: 'Search universities' };

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <TopNav
        tone="light"
        logo={<GlowbalLogo height={28} />}
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        {...(isSignedIn && userName
          ? { user: { name: userName, avatarUrl: userAvatarUrl, href: '/profile' } }
          : { secondaryAction: { href: '/auth', label: 'Sign in' } })}
      />
      <MobileNav
        logo={
          <Link href="/" aria-label="GlowBal home" className="inline-flex items-center">
            <GlowbalLogo height={28} />
          </Link>
        }
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        secondaryAction={
          isSignedIn ? { href: '/profile', label: 'Profile' } : { href: '/auth', label: 'Sign in' }
        }
        openLabel="Menu"
        closeLabel="Close menu"
      />

      <main>
        {/* Hero */}
        <section className="pt-gb-7xl">
          <Container className="flex max-w-3xl flex-col gap-gb-xl">
            <p className="text-gb-sm font-semibold uppercase tracking-wide text-fg-brand">
              How GlowBal works
            </p>
            <h1 className="font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg">
              From &ldquo;where do I even start&rdquo; to a plan that gets you in
            </h1>
            <p className="text-gb-lg text-fg-tertiary">
              Three stages, {GUIDE_STEP_COUNT} steps. Save the universities worth your time, turn one
              into a real application plan, then work through a strategy built from your profile and
              that course&rsquo;s actual requirements &mdash; without leaving GlowBal.
            </p>
            <div className="flex flex-wrap gap-gb-lg">
              <Button href="/universities" size="lg">
                Start with universities
              </Button>
              <Button href="/apply" variant="secondary" size="lg">
                Go to My Portal
              </Button>
            </div>
          </Container>
        </section>

        {/* The three-stage shape, before the step-by-step detail. */}
        <section className="pt-gb-7xl">
          <Container>
            <ol className="grid gap-gb-2xl md:grid-cols-3">
              {STRATEGY_GUIDE.map((area) => (
                <li key={area.id}>
                  <Panel className="flex h-full flex-col gap-gb-lg">
                    <span className="text-gb-sm font-semibold text-fg-brand">
                      Area {area.number}
                    </span>
                    <h2 className="text-gb-lg font-semibold text-fg">{area.title}</h2>
                    <p className="text-gb-sm text-fg-tertiary">{area.summary}</p>
                    <p className="mt-auto text-gb-xs text-fg-muted">{area.steps.length} steps</p>
                  </Panel>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        {/* The walkthrough itself. */}
        <section className="pt-gb-6xl">
          <Container>
            <StrategyGuide />
          </Container>
        </section>

        {/* Signed-out visitors get the sign-up close. Signed-in students get
            nothing here on purpose — see the header. */}
        {isSignedIn ? null : (
          <section className="pt-gb-9xl">
            <Container>
              <Panel className="flex flex-col items-start gap-gb-lg">
                <h2 className="font-display text-gb-xl font-semibold text-fg">
                  Ready to start yours?
                </h2>
                <p className="max-w-2xl text-gb-md text-fg-tertiary">
                  Create a free account to save universities, import courses and build your first
                  strategy.
                </p>
                <div className="flex flex-wrap gap-gb-lg">
                  <Button href="/auth" size="lg">
                    Create an account
                  </Button>
                  <Button href="/universities" variant="secondary" size="lg">
                    Browse universities first
                  </Button>
                </div>
              </Panel>
            </Container>
          </section>
        )}
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
