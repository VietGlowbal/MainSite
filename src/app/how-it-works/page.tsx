import type { Metadata } from 'next';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { SiteNavigation } from '@/components/site-navigation';
// The narrow slices, not the `marketing/ui` barrel: the barrel also re-exports
// the Home compositions, and `home-metrics` pulls framer-motion, so one barrel
// import puts 247 KB of animation library on a page that animates nothing.
// See docs/performance.md.
import { getLocalizedFooter } from '@/features/marketing/navigation';
import { StrategyGuide } from '@/features/marketing/strategy-guide';
import { GUIDE_STEP_COUNT, STRATEGY_GUIDE } from '@/features/marketing/domain';
import { getServerIdentity } from '@/server/auth/server-identity';
import { Button, Container, Footer, Panel } from '@/shared/ui';
import { getLocaleText, localizePath, type Locale } from '@/lib/i18n/locale';

/**
 * /how-it-works — the help page for the whole product. Three areas,
 * fourteen steps, each describing something the code actually does.
 *
 * ─── WHY THIS ROUTE EXISTS AGAIN (03/08, owner) ──────────────────────────────
 *
 * The full walkthrough used to live on /ai-strategy, which meant one page was
 * both "how GlowBal works" and "what the Strategy is". The owner asked for the
 * two split: this is the general help page, reached from the top nav, and
 * /ai-strategy is now area 3 — the Strategy — on its own.
 *
 * ⚠️ THIS PATH USED TO 308 TO /ai-strategy, AND THAT REDIRECT IS NOW GONE
 * (next.config.ts). It was added on 01/08 because an older /how-it-works page
 * taught a flow that no longer existed — paste a course URL into /apply — and
 * folding it into one explainer was the fix. The split reverses the shape but
 * not the lesson: there is still exactly one description of each stage, and
 * both pages render it from features/marketing/domain/strategy-guide.ts rather
 * than restating it. See the ⚠️ at the top of that file before editing copy.
 *
 * ⚠️ A permanent redirect is cached by the browser that followed it. Anyone who
 * loaded /how-it-works between 01/08 and now keeps getting sent to
 * /ai-strategy until that entry expires or they hard-reload. Acceptable
 * because the site has not launched; worth knowing if a link looks broken.
 *
 * PUBLIC, deliberately — it is the explanation of what signing up gets you, so
 * gating it would send the nav's own "How GlowBal works" link to a login wall.
 * The session is read only to draw the right header.
 */

import { SITE_URL } from '@/lib/site-url';
import { buildLocaleAlternates } from '@/lib/seo/alternates';

export const metadata: Metadata = {
  title: 'How GlowBal Works — AI & Mentor Study Abroad Guidance',
  description:
    'Discover how GlowBal takes you from university search to course applications, scholarship discovery, and personalized AI strategies.',
  openGraph: {
    title: 'How GlowBal Works — AI & Mentor Study Abroad Guidance | GlowBal',
    description:
      'Discover how GlowBal takes you from university search to course applications, scholarship discovery, and personalized AI strategies.',
    url: `${SITE_URL}/how-it-works`,
  },
  alternates: buildLocaleAlternates('/how-it-works'),
};

export default async function HowItWorksPage({ locale = 'en' }: { locale?: Locale } = {}) {
  const { identity: user } = await getServerIdentity();

  const isSignedIn = Boolean(user);
  const footer = getLocalizedFooter(locale);
  const t = (source: string, vars?: Record<string, string | number>) => getLocaleText(locale, source, vars);

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <SiteNavigation tone="light" locale={locale} />

      <main>
        {/* Hero */}
        <section className="pt-gb-7xl">
          <Container className="flex max-w-3xl flex-col gap-gb-xl">
            <p className="text-gb-sm font-semibold uppercase tracking-wide text-fg-brand">
              {t('How GlowBal works')}
            </p>
            <h1 className="font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg">
              {t('From “where do I even start” to a plan that gets you in')}
            </h1>
            <p className="text-gb-lg text-fg-tertiary">
              {t('Three stages, {count} steps. Save the universities worth your time, turn one into a real application plan, then work through a strategy built from your profile and that course’s actual requirements — without leaving GlowBal.', { count: GUIDE_STEP_COUNT })}
            </p>
            <div className="flex flex-wrap gap-gb-lg">
              <Button href={localizePath('/universities', locale)} size="lg">
                {t('Start with universities')}
              </Button>
              <Button href={localizePath('/apply', locale)} variant="secondary" size="lg">
                {t('Go to My Portal')}
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
                      {t('Area')} {area.number}
                    </span>
                    <h2 className="text-gb-lg font-semibold text-fg">{t(area.title)}</h2>
                    <p className="text-gb-sm text-fg-tertiary">{t(area.summary)}</p>
                    <p className="mt-auto text-gb-xs text-fg-muted">{area.steps.length} {t('steps')}</p>
                  </Panel>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        {/* The walkthrough itself — all three areas. */}
        <section className="pt-gb-6xl">
          <Container>
            <StrategyGuide locale={locale} />
          </Container>
        </section>

        {/* Signed-out visitors get the sign-up close. Signed-in students have
            nothing to sign up for.

            The top padding here was pt-gb-3xl while a "Just want the Strategy?"
            cross-link sat between this and the walkthrough above. That panel was
            removed on the owner's instruction (06/08), so this is now the first
            thing after the guide and takes the full section gap back. */}
        {isSignedIn ? null : (
          <section className="pt-gb-9xl">
            <Container>
              <Panel className="flex flex-col items-start gap-gb-lg">
                <h2 className="font-display text-gb-xl font-semibold text-fg">
                  {t('Ready to start yours?')}
                </h2>
                <p className="max-w-2xl text-gb-md text-fg-tertiary">
                  {t('Create a free account to save universities, plan an application and build your first strategy.')}
                </p>
                <div className="flex flex-wrap gap-gb-lg">
                  <Button href={localizePath('/auth', locale)} size="lg">
                    {t('Create an account')}
                  </Button>
                  <Button href={localizePath('/universities', locale)} variant="secondary" size="lg">
                    {t('Browse universities first')}
                  </Button>
                </div>
              </Panel>
            </Container>
          </section>
        )}
      </main>

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
