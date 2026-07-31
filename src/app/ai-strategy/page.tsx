import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  MARKETING_NAV_ITEMS,
} from '@/features/marketing/ui';
import { createClient } from '@/lib/supabase/server';
import { Button, Container, Footer, MobileNav, Panel, ScoreRing, TopNav } from '@/shared/ui';

/**
 * /ai-strategy — the entry to the AI Strategy Dashboard journey.
 *
 * WHY THIS CHANGED (31/07). The journey is per-course, not one flow shared by
 * every student (see .kiro/specs/ai-strategy-dashboard/requirements.md
 * Requirement 1.1) — a Strategy only means something once a course is
 * picked. This page previously showed all five journey steps as "Coming
 * soon" regardless of what the student had actually done, which read as
 * unfinished because it was: it never linked anywhere real, even after
 * `/ai-strategy/[applicationId]/strategy/*` started working.
 *
 * NOW: a signed-in student with existing course applications sees their
 * strategies (one card per application, its match % once analysed, a link
 * straight into that course's journey) — the "Multiple Strategies" switcher
 * from Requirement 15.3, promoted to the front door. A student with none
 * sees a plain prompt to pick a university and course first, because that
 * is the one thing this page genuinely cannot skip.
 */

export const metadata: Metadata = {
  title: 'AI strategy · GLOWBAL',
  description:
    'Your personalised strategy for each university course you’re applying to — a candidate portrait, a course-match score, and a live improvement roadmap.',
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

  /*
   * SIGN IN TO SEE IT — owner's instruction, 31/07, paired with the same rule
   * on /apply. The LINK stays in the nav for everyone (see
   * MARKETING_NAV_ITEMS): that is how a visitor discovers the feature exists.
   */
  if (!user) redirect('/auth?redirect=%2Fai-strategy');

  const userName =
    (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || null;
  const userAvatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  const { data: applications } = await supabase
    .from('course_applications')
    .select('id, university_name, course_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const strategies: StrategyCard[] = [];
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

  const primaryAction = { href: '/universities', label: 'Search universities' };

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <TopNav
        tone="light"
        logo={<GlowbalLogo height={28} />}
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        user={{ name: userName ?? 'You', avatarUrl: userAvatarUrl, href: '/profile' }}
      />
      <MobileNav
        logo={
          <Link href="/" aria-label="GlowBal home" className="inline-flex items-center">
            <GlowbalLogo height={28} />
          </Link>
        }
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        secondaryAction={{ href: '/profile', label: 'Profile' }}
        openLabel="Menu"
        closeLabel="Close menu"
      />

      <main className="min-h-screen pb-gb-9xl pt-gb-6xl">
        <Container className="flex flex-col gap-gb-6xl">
          <header className="flex max-w-3xl flex-col gap-gb-lg">
            <h1 className="font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg">
              AI Strategy
            </h1>
            <p className="text-gb-lg text-fg-tertiary">
              A personalised roadmap for each university course you&rsquo;re applying to — built from
              your profile, compared against the course, and updated as you improve.
            </p>
          </header>

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
            <section className="flex flex-col items-start gap-gb-lg rounded-gb-2xl border border-line bg-surface-muted p-gb-4xl">
              <h2 className="font-display text-gb-xl font-semibold text-fg">
                Pick a course to start your first strategy
              </h2>
              <p className="max-w-2xl text-gb-md text-fg-tertiary">
                A strategy is built for one specific university course, so it can compare you
                against that course&rsquo;s real requirements. Search for a university, open a course,
                and start an application to begin.
              </p>
              <Button href="/universities" size="lg">
                Search universities
              </Button>
            </section>
          )}

          <section className="flex flex-col gap-gb-lg rounded-gb-2xl border border-line bg-surface-muted p-gb-4xl">
            <h2 className="font-display text-gb-xl font-semibold text-fg">
              What you can do right now
            </h2>
            <p className="max-w-2xl text-gb-md text-fg-tertiary">
              Paste a course URL and the AI reads the official page, builds your application
              checklist, and scores how well your profile matches — the foundation every strategy
              above is built on.
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
