import Link from 'next/link';
import { GlowbalLogo } from '@/components/glowbal-logo';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  MARKETING_NAV_ITEMS,
} from '@/features/marketing/navigation';
import { Container } from '@/shared/ui/container';
import { Footer } from '@/shared/ui/footer';
import { MobileNav } from '@/shared/ui/mobile-nav';
import { TopNav } from '@/shared/ui/top-nav';

export function ApplicationWorkspaceShell({
  children,
  nav,
  banner,
  userName,
  userAvatarUrl,
}: {
  children: React.ReactNode;
  nav?: React.ReactNode;
  banner: React.ReactNode;
  userName?: string | null;
  userAvatarUrl?: string | null;
}) {
  const primaryAction = { href: '/apply', label: 'My applications' };

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <TopNav
        tone="light"
        logo={<GlowbalLogo height={28} />}
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        {...(userName
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
        secondaryAction={userName ? { href: '/profile', label: 'Profile' } : { href: '/auth', label: 'Sign in' }}
        openLabel="Menu"
        closeLabel="Close menu"
      />

      <main className="min-h-screen pb-gb-9xl pt-gb-4xl">
        <Container className="flex flex-col gap-gb-5xl">
          {nav}
          {banner}
          {children}
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
