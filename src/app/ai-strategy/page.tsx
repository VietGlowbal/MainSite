import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { AI_JOURNEY, aiJourneySteps } from '@/features/apply/domain';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  MARKETING_NAV_ITEMS,
} from '@/features/marketing/ui';
import { createClient } from '@/lib/supabase/server';
import { Badge, Button, Container, Footer, MobileNav, Stepper, TopNav } from '@/shared/ui';

/**
 * /ai-strategy — the entry to the AI strategy journey.
 *
 * WHY THIS EXISTS AT ALL. The route did not, and "AI strategy" is in
 * MARKETING_NAV_ITEMS — so the header link on every rebuilt page, plus the
 * "Continue" CTA on the course workspace, both landed on a 404 rendered inside
 * the app shell, which reads as a blank page rather than as a missing one.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not fake the journey. Four of the
 * five steps have no page yet, so this shows what the journey is, marks each
 * step's state honestly, and points at the parts of the product that are real
 * today. Stub routes that render headings with nothing under them would be a
 * worse answer than a truthful overview — the student would click into them.
 */

export const metadata: Metadata = {
  title: 'AI strategy · GLOWBAL',
  description:
    'A guided pass over your profile: your reflection, a candidate portrait, university fit, and AI feedback on your essay and CV.',
};

export default async function AiStrategyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
   * SIGN IN TO SEE IT — owner's instruction, 31/07, paired with the same rule
   * on /apply.
   *
   * The LINK stays in the nav for everyone (see MARKETING_NAV_ITEMS): that is
   * how a visitor discovers the feature exists. The PAGE is the student's own
   * strategy journey — their reflection, their candidate portrait, their essay
   * and CV feedback — so it opens on the sign-in screen and comes back here
   * afterwards.
   *
   * Gated here rather than in src/proxy.ts to match /apply, which cannot use
   * PROTECTED_ROUTES because ?openCourseSearch has to stay reachable
   * signed-out. Two pages, one visible rule, in the file each belongs to.
   */
  if (!user) redirect('/auth?redirect=%2Fai-strategy');

  const userName =
    (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || null;
  const userAvatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;
  const isSignedIn = true;

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

      <main className="min-h-screen pb-gb-9xl pt-gb-6xl">
        <Container className="flex flex-col gap-gb-6xl">
          <header className="flex max-w-3xl flex-col gap-gb-lg">
            <h1 className="font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg">
              Application Strategy
            </h1>
            <p className="text-gb-lg text-fg-tertiary">
              A guided pass over your profile — what you have done, what it says about you, and how
              well it fits the courses you are aiming at.
            </p>
          </header>

          <Stepper steps={aiJourneySteps()} currentIndex={0} label="AI strategy journey" />

          <ol className="flex flex-col gap-gb-xl">
            {AI_JOURNEY.map((step, index) => (
              <li
                key={step.key}
                className="flex flex-col gap-gb-md rounded-gb-2xl border border-line p-gb-3xl sm:flex-row sm:items-center sm:justify-between sm:gap-gb-3xl"
              >
                <div className="flex min-w-0 flex-col gap-gb-xs">
                  <div className="flex flex-wrap items-center gap-gb-md">
                    <span className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                      Step {index + 1}
                    </span>
                    <h2 className="text-gb-md font-semibold text-fg">{step.label}</h2>
                    {step.paid ? <Badge variant="brand-subtle">GlowBal Plus</Badge> : null}
                  </div>
                  <p className="text-gb-sm text-fg-tertiary">{step.blurb}</p>
                </div>

                {/* No step has a route yet. Saying so is the honest state; a
                    button wired to nothing is the one thing worse than none. */}
                <span className="shrink-0 text-gb-sm text-fg-muted">Coming soon</span>
              </li>
            ))}
          </ol>

          <section className="flex flex-col gap-gb-lg rounded-gb-2xl border border-line bg-surface-muted p-gb-4xl">
            <h2 className="font-display text-gb-xl font-semibold text-fg">
              What you can do right now
            </h2>
            <p className="max-w-2xl text-gb-md text-fg-tertiary">
              While this journey is being built, the per-course side of GlowBal is live: paste a
              course URL and the AI reads the official page, builds your application checklist, and
              scores how well your profile matches.
            </p>
            <div className="flex flex-wrap gap-gb-lg">
              <Button href="/apply" size="lg">
                Plan a course application
              </Button>
              <Button href="/profile/documents" variant="secondary" size="lg">
                Add your CV and statement
              </Button>
            </div>
          </section>
        </Container>
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
