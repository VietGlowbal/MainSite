import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { GlowbalLogo } from '@/components/glowbal-logo';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  MARKETING_NAV_ITEMS,
} from '@/features/marketing/ui';
import { Container, Footer, MobileNav, TopNav } from '@/shared/ui';

/**
 * The header/footer wrapper both reflection steps share.
 *
 * `/ai-strategy/*` is suppressed in nav-reveal, so these pages carry their own
 * chrome — the same arrangement as /apply and /universities. Extracted rather
 * than repeated per step so the two cannot drift, which is the same reason the
 * step config is one file.
 */
export function ReflectionChrome({
  user,
  children,
}: {
  user: User | null;
  children: React.ReactNode;
}) {
  const userName =
    (user?.user_metadata?.full_name as string | undefined) || user?.email?.split('@')[0] || null;
  const userAvatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? null;
  const isSignedIn = Boolean(user);

  const primaryAction = { href: '/universities', label: 'Tìm trường đại học' };

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <TopNav
        tone="light"
        logo={<GlowbalLogo height={28} />}
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        {...(isSignedIn && userName
          ? { user: { name: userName, avatarUrl: userAvatarUrl, href: '/profile' } }
          : { secondaryAction: { href: '/auth', label: 'Đăng nhập' } })}
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
          isSignedIn ? { href: '/profile', label: 'Profile' } : { href: '/auth', label: 'Đăng nhập' }
        }
        openLabel="Menu"
        closeLabel="Close menu"
      />

      <main className="min-h-screen pb-gb-9xl pt-gb-5xl">
        <Container className="max-w-4xl">{children}</Container>
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
