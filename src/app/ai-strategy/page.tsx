import type { Metadata } from 'next';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { SiteNavigation } from '@/components/site-navigation';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  StrategyGuide,
} from '@/features/marketing/ui';
import { guideArea } from '@/features/marketing/domain';
import { createClient } from '@/lib/supabase/server';
import { Button, Container, Footer, Panel } from '@/shared/ui';
import { T } from '@/lib/i18n';

/**
 * /ai-strategy — what GlowBal Strategy is, and nothing else.
 *
 * ─── IT IS AREA 3 NOW, NOT THE WHOLE WALKTHROUGH (03/08, owner) ───────────────
 *
 * This route carried the entire fourteen-step explainer, which made it two
 * pages at once: "how GlowBal works" and "what the Strategy is". The owner
 * asked for the split. The general help page is /how-it-works, reached from the
 * top nav; this page is the third stage on its own — the two AI reports and the
 * improvement plan built from them.
 *
 * The content is the SAME source either way: `guideArea('strategy')` reads the
 * area out of features/marketing/domain/strategy-guide.ts, which is what
 * /how-it-works renders all three of. There is no second copy of this stage's
 * description to fall out of step, which matters here more than anywhere —
 * see the ⚠️ at the top of that file for what happened the last time a page
 * described the product in its own words.
 *
 * WHAT THIS PAGE IS NOT. It is not the Strategy itself. That is built for one
 * specific course and is entered from an application:
 * /ai-strategy/[applicationId]/strategy, off the "Ready to strengthen this
 * application?" prompt in the workspace. This page explains it and points
 * there; the steps below carry the real links where a student can act now.
 *
 * PAYWALL, WHEN IT COMES (owner, 01/08): it goes here — on the Strategy, after
 * the application stage, not before it. Deliberately not built while the
 * product is still being tested, and deliberately not mentioned in the guide
 * content, because no /ai-strategy route checks an entitlement today. GlowBal
 * Plus (Stripe, three tiers) and an entitlement service already exist and are
 * the pieces to build it from. When it lands, this page is the natural place
 * for the pricing line, because it is the last thing a student reads before the
 * gate.
 *
 * ⚠️ PUBLIC, AND THAT REVERSES AN EARLIER INSTRUCTION. The owner asked on 31/07
 * for this route to require sign-in, paired with the same rule on /apply. That
 * instruction was about a version of this page made entirely of one student's
 * own data — a list of their strategies, removed on 02/08. What is left is
 * marketing copy about a feature, so gating it would hide the explanation of
 * the thing we want them to sign up for. Say the word and it goes back behind
 * auth; the session is read here only to draw the right header.
 */

const AREA = guideArea('strategy');

export const metadata: Metadata = {
  title: 'GlowBal Strategy',
  description:
    'GlowBal Strategy: two AI reports — one about you, one about the course — and an ordered plan that closes the gap between them.',
};

export default async function AiStrategyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isSignedIn = Boolean(user);

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <SiteNavigation tone="light" />

      {/* Every string in this page body is localized explicitly with <T>.
          Keep the legacy DOM translator out: if it snapshots a hydrated
          Vietnamese <T> node as its English source, switching back to EN is
          immediately overwritten with Vietnamese. Header/footer stay outside
          this boundary until their remaining legacy copy is migrated. */}
      <main data-no-auto-translate>
        {/* Hero */}
        <section className="pt-gb-7xl">
          <Container className="flex max-w-3xl flex-col gap-gb-xl">
            <p className="text-gb-sm font-semibold uppercase tracking-wide text-fg-brand">
              <T k="Stage" /> {AREA.number} <T k="of 3 ·" /> <T k={AREA.title} />
            </p>
            <h1 className="font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg">
              <T k="The part that changes your odds" />
            </h1>
            <p className="text-gb-lg text-fg-tertiary"><T k={AREA.summary} /></p>
            <p className="text-gb-md text-fg-tertiary">
              {AREA.steps.length}{' '}<T k="steps, built for one specific course — so it can compare you against that course’s real requirements rather than a generic checklist. You start it from an application you have already planned." />
            </p>
            <div className="flex flex-wrap gap-gb-lg">
              <Button href="/apply" size="lg">
                <T k="Open My Portal" />
              </Button>
              <Button href="/how-it-works" variant="secondary" size="lg">
                <T k="See the whole journey" />
              </Button>
            </div>
          </Container>
        </section>

        {/* Area 3, step by step. Same component and same content file as
            /how-it-works — it is handed one area instead of three. */}
        <section className="pt-gb-6xl">
          <Container>
            <StrategyGuide areas={[AREA]} />
          </Container>
        </section>

        {/* Where the Strategy is actually started, said plainly. The steps
            above deliberately do not claim a link for the ones that have none. */}
        <section className="pt-gb-9xl">
          <Container>
            <Panel className="flex flex-col items-start gap-gb-lg">
              <h2 className="font-display text-gb-xl font-semibold text-fg">
                <T k="Where you start one" />
              </h2>
              <p className="max-w-2xl text-gb-md text-fg-tertiary">
                <T k="A Strategy belongs to a single course, so it opens from an application rather than from here. Plan one in My Portal, then use “Ready to strengthen this application?” at the bottom of it." />
              </p>
              <div className="flex flex-wrap gap-gb-lg">
                <Button href="/apply" size="lg">
                  <T k="Go to My Portal" />
                </Button>
                <Button href="/universities" variant="secondary" size="lg">
                  <T k="Find a university first" />
                </Button>
              </div>
            </Panel>
          </Container>
        </section>

        {/* Signed-out visitors get the sign-up close. */}
        {isSignedIn ? null : (
          <section className="pt-gb-3xl">
            <Container>
              <Panel className="flex flex-col items-start gap-gb-lg">
                <h2 className="font-display text-gb-xl font-semibold text-fg">
                  <T k="Ready to start yours?" />
                </h2>
                <p className="max-w-2xl text-gb-md text-fg-tertiary">
                  <T k="Create a free account to save universities, plan an application and build your first strategy." />
                </p>
                <div className="flex flex-wrap gap-gb-lg">
                  <Button href="/auth" size="lg">
                    <T k="Create an account" />
                  </Button>
                  <Button href="/how-it-works" variant="secondary" size="lg">
                    <T k="Read how GlowBal works" />
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
