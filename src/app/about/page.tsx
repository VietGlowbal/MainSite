import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getTeamMembers, type TeamMember } from '@/lib/team';
import { GlowbalLogo } from '@/components/glowbal-logo';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  HomeFaq,
  MARKETING_NAV_ITEMS,
} from '@/features/marketing/ui';
import { Avatar, Container, Footer, MobileNav, TopNav } from '@/shared/ui';

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
 * The FAQ block is the same component as Home (its answers are still awaiting
 * copy, so it shows MissingContent). Footer + nav match the other rebuilt pages.
 */

export const metadata: Metadata = {
  title: 'About GlowBal | The team helping students study abroad',
  description:
    'Meet the team behind GlowBal — the people helping students find global universities, scholarships, and application strategies.',
};

// Team roster changes rarely; mirror the home page's 12h ISR.
export const revalidate = 43200;

function TeamCard({ member }: { member: TeamMember }) {
  const contactHref = member.linkedin_url ?? (member.email ? `mailto:${member.email}` : null);
  return (
    <article className="flex flex-col gap-gb-lg">
      <div className="aspect-square w-full overflow-hidden rounded-gb-xl bg-surface-muted">
        {member.photo_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={member.photo_url}
            alt={member.full_name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Avatar name={member.full_name} className="size-gb-9xl" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-gb-xs">
        <h3 className="text-gb-lg font-semibold text-fg">{member.full_name}</h3>
        <p className="text-gb-sm font-medium text-fg-brand">{member.role}</p>
        {member.short_bio ? (
          <p className="text-gb-sm text-fg-tertiary">{member.short_bio}</p>
        ) : null}
      </div>
      {contactHref ? (
        <a
          href={contactHref}
          {...(member.linkedin_url ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
          className="text-gb-sm font-semibold text-fg-brand underline-offset-4 hover:underline"
        >
          Contact →
        </a>
      ) : null}
    </article>
  );
}

export default async function AboutPage() {
  const supabase = await createClient();
  const [{ data: { user } }, team] = await Promise.all([
    supabase.auth.getUser(),
    getTeamMembers(),
  ]);

  const userName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    null;
  const userAvatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? null;
  const isSignedIn = !!user;

  const primaryAction = { href: '/onboarding', label: 'Plan your studies' };

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
        logo={<GlowbalLogo height={28} />}
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        secondaryAction={
          isSignedIn ? { href: '/profile', label: 'Profile' } : { href: '/auth', label: 'Sign in' }
        }
        openLabel="Menu"
        closeLabel="Close menu"
      />

      <main>
        {/* Hero — honest copy, no world map of offices GlowBal does not have. */}
        <section className="py-gb-9xl">
          <Container className="flex flex-col items-center gap-gb-xl text-center">
            <h1 className="max-w-gb-width-xl font-display text-gb-display-sm font-semibold md:text-gb-display-md">
              The team helping students go global
            </h1>
            <p className="max-w-gb-width-lg text-gb-lg text-fg-tertiary">
              GlowBal is built by students and mentors who have been through the study-abroad
              journey themselves — and want to make it clearer for everyone who comes next.
            </p>
          </Container>
        </section>

        {/* Team */}
        {team.length > 0 ? (
          <section className="pb-gb-9xl">
            <Container className="flex flex-col gap-gb-6xl">
              <div className="mx-auto max-w-gb-width-xl text-center">
                <h2 className="font-display text-gb-display-xs font-semibold md:text-gb-display-sm">
                  Meet our team
                </h2>
                <p className="mt-gb-lg text-gb-md text-fg-tertiary">
                  The people behind GlowBal, and the experience they bring to your application.
                </p>
              </div>
              {/* id="team" is the anchor the footer's "Our team" link points at. */}
              <div
                id="team"
                className="grid scroll-mt-gb-9xl grid-cols-1 gap-gb-4xl sm:grid-cols-2 lg:grid-cols-4"
              >
                {team.map((member) => (
                  <TeamCard key={member.id} member={member} />
                ))}
              </div>
            </Container>
          </section>
        ) : (
          // Anchor still has to resolve even before the roster is seeded.
          <div id="team" className="scroll-mt-gb-9xl" />
        )}

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
