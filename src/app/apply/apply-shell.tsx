import Link from 'next/link';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { SavedNavLink } from '@/components/saved-nav-link';
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

export function ApplyShell({
  children,
  userName,
  userAvatarUrl,
  isLoggedOut = false,
}: {
  children: React.ReactNode;
  userName?: string | null;
  userAvatarUrl?: string | null;
  isLoggedOut?: boolean;
}) {
  const isSignedIn = !isLoggedOut && Boolean(userName);
  const primaryAction = { href: '/universities', label: 'Search universities' };

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <TopNav
        tone="light"
        logo={<GlowbalLogo height={28} />}
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        utility={<SavedNavLink />}
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
        utility={<SavedNavLink variant="row" />}
        openLabel="Menu"
        closeLabel="Close menu"
      />

      <main className="relative min-h-screen pb-gb-9xl pt-gb-6xl">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[480px]"
          style={{
            background:
              'radial-gradient(70% 100% at 12% 0%, var(--color-gb-brand-50), transparent 72%)',
          }}
        />
        <Container className="relative flex flex-col gap-gb-7xl">{children}</Container>
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
