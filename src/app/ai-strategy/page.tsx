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
import { Button, Container, Footer, MobileNav, Panel, ScoreRing, TopNav } from '@/shared/ui';

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
 * ⚠️ IT IS PUBLIC AGAIN, AND THAT REVERSES AN EARLIER INSTRUCTION. The owner
 * asked on 31/07 for this route to require sign-in, paired with the same rule
 * on /apply. That instruction was about a page made entirely of one student's
 * own data. The explainer is marketing copy — gating it means the "Build your
 * strategy" nav link, which is visible to signed-out visitors, sends them to a
 * login wall instead of the explanation of what they would be signing up for.
 * So the split is by content, not by route: the guide renders for everyone,
 * and the strategies list only renders when there is a session to read it
 * from. Nothing private is exposed. Flagged rather than assumed — say the word
 * and the whole route goes back behind auth.
 *
 * The strategies list is kept (not dropped) precisely because it is what the
 * previous version got right: a student mid-journey needs a way back into
 * their own work, and this route is where the nav points them.
 */

export const metadata: Metadata = {
  title: 'How GlowBal works · AI Strategy',
  description:
    'How GlowBal takes you from searching universities, to applying for a course, to a personalised AI strategy that improves your chances of getting in.',
};

type StrategyCard = {
  applicationId: string;
  universityName: string;
  courseName: string;
  matchPercent: number | null;
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

  /* Only read the student's own strategies when there is a student. The guide
     below renders identically either way. */
  const strategies: StrategyCard[] = [];
  if (user) {
    const { data: applications } = await supabase
      .from('course_applications')
      .select('id, university_name, course_name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    for (const app of applications ?? []) {
      const { data: match } = await supabase
        .from('application_match_analyses')
        .select('current_match_score')
        .eq('application_id', app.id)
        .eq('analysis_status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      strategies.push({
        applicationId: app.id,
        universityName: app.university_name,
        courseName: app.course_name,
        matchPercent: match?.current_match_score ?? null,
      });
    }
  }

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

        {/* The student's own strategies — signed in only. */}
        {isSignedIn ? (
          <section className="pt-gb-9xl">
            <Container className="flex flex-col gap-gb-3xl">
              <div className="flex flex-col gap-gb-md">
                <h2 className="font-display text-gb-display-xs font-semibold text-fg">
                  Your strategies
                </h2>
                <p className="max-w-2xl text-gb-md text-fg-tertiary">
                  {strategies.length > 0
                    ? 'Pick up where you left off, or start another course.'
                    : 'You have not started one yet. A strategy is built for one specific course, so it can compare you against that course’s real requirements.'}
                </p>
              </div>

              {strategies.length > 0 ? (
                <div className="grid gap-gb-2xl sm:grid-cols-2 lg:grid-cols-3">
                  {strategies.map((strategy) => (
                    <Link
                      key={strategy.applicationId}
                      href={`/ai-strategy/${strategy.applicationId}/strategy`}
                      className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      <Panel className="flex h-full flex-col justify-between gap-gb-2xl transition-colors hover:border-line-strong">
                        <div className="flex flex-col gap-gb-xs">
                          <p className="text-gb-sm text-fg-tertiary">{strategy.universityName}</p>
                          <p className="text-gb-lg font-semibold text-fg">{strategy.courseName}</p>
                        </div>
                        {strategy.matchPercent != null ? (
                          <ScoreRing value={strategy.matchPercent} measure="match" size="sm" />
                        ) : (
                          <p className="text-gb-sm text-fg-muted">Not analysed yet</p>
                        )}
                      </Panel>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-gb-lg">
                  <Button href="/universities" size="lg">
                    Search universities
                  </Button>
                  <Button href="/apply" variant="secondary" size="lg">
                    Open My Portal
                  </Button>
                </div>
              )}
            </Container>
          </section>
        ) : (
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
