import type { Metadata } from 'next';
import { getTeamMembers } from '@/lib/team';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { MarketingNavigation } from '@/components/marketing-navigation';
import {
  AboutTeam,
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  HomeFaq,
} from '@/features/marketing/ui';
import { Container, Footer } from '@/shared/ui';

/**
 * /about — net-new, built from Figma 153:11401 ("About us").
 *
 * The frame is an Untitled UI template, and two parts of it cannot ship as
 * drawn:
 *   - the hero reads "We're a distributed team… offices all around the world"
 *     over a world map dotted with foreign offices. GlowBal is a Vietnamese
 *     student startup with no such offices, so that is a false claim, not
 *     placeholder text. The hero here states what is true instead, and the map
 *     is dropped.
 *   - the team grid is eight identical "Khánh Linh / ex-Spotify" cards. Those
 *     are replaced with the REAL roster from lib/team.ts (the same source the
 *     old home page used), which is fail-soft: no rows → the section hides.
 *
 * The roster is no longer a wall of identical cards either. It is a grid of
 * photos with one detail card beneath it that resolves to whoever the pointer
 * is on — features/marketing/ui/about-team.tsx, which owns that interaction and
 * the #team anchor the footer links to.
 *
 * The FAQ block is the same component as Home (its answers are still awaiting
 * copy, so it shows MissingContent). Footer + nav match the other rebuilt pages.
 */

import { SITE_URL } from '@/lib/site-url';
import { buildLocaleAlternates } from '@/lib/seo/alternates';

export const metadata: Metadata = {
  title: 'About GlowBal — The Team Helping Students Study Abroad',
  description:
    'Meet the team behind GlowBal — passionate educators, engineers, and mentors helping Vietnamese students study globally.',
  openGraph: {
    title: 'About GlowBal — The Team Helping Students Study Abroad | GlowBal',
    description:
      'Meet the team behind GlowBal — passionate educators, engineers, and mentors helping Vietnamese students study globally.',
    url: `${SITE_URL}/about`,
  },
  alternates: buildLocaleAlternates('/about'),
};

// Team roster changes rarely; mirror the home page's 12h ISR.
export const revalidate = 43200;

export default async function AboutPage() {
  const team = await getTeamMembers();

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <MarketingNavigation />

      <main>
        {/* Hero — honest copy, no world map of offices GlowBal does not have. */}
        <section className="py-gb-9xl">
          <Container className="flex flex-col items-center gap-gb-xl text-center">
            <h1 className="max-w-gb-width-xl font-display text-gb-display-sm font-semibold md:text-gb-display-md">
              The team helping students go global
            </h1>
            <p className="max-w-gb-width-lg text-gb-lg text-fg-tertiary">
              GlowBal is built by students and advisors who have been through the study-abroad
              journey themselves — and want to make it clearer for everyone who comes next.
            </p>
          </Container>
        </section>

        {/* Team. AboutTeam carries the #team anchor in both states — with a
            roster and without one — so the footer link always resolves. */}
        <Container>
          <AboutTeam members={team} />
        </Container>

        {/* FAQ — shared with Home; answers await copy (MissingContent). */}
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
