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
 * The header/footer wrapper every page under /ai-strategy shares.
 *
 * WHY IT IS HERE AND NOT IN src/features/application-strategy/ui. It needs
 * MARKETING_NAV_ITEMS and the FOOTER_* constants from @/features/marketing, and
 * eslint's noCrossFeature rule forbids one feature importing another. The app
 * layer is the composition root that is allowed to reach both, so the chrome
 * belongs here. Same reason `reflection-chrome.tsx` was always in this folder.
 *
 * WHY IT IS SHARED RATHER THAN COPIED. `/ai-strategy` is listed in both
 * OWN_CHROME_ROUTES and OWN_CHROME_PREFIXES in nav-reveal.tsx, so no app chrome
 * is rendered for any descendant and every page has to carry its own. That is
 * exactly the condition under which two copies drift — one gains a nav item, the
 * other does not — so there is one.
 *
 * `containerWidth` exists because the CV content editor and the layout preview
 * genuinely need more room than the reflection form's max-w-4xl. It is a choice
 * between three named widths rather than a free className so a caller cannot
 * quietly invent a fourth.
 */

export type ChromeWidth = 'narrow' | 'wide' | 'full';

const WIDTH: Record<ChromeWidth, string> = {
  /** The reflection form and the target profile. One column of fields. */
  narrow: 'max-w-4xl',
  /** The overview and the statement editor. Room for two cards side by side. */
  wide: 'max-w-5xl',
  /** The CV content editor and the layout preview, which page a document. */
  full: 'max-w-6xl',
};

export function StrategyChrome({
  user,
  containerWidth = 'narrow',
  children,
}: {
  user: User | null;
  containerWidth?: ChromeWidth;
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
        <Container className={WIDTH[containerWidth]}>{children}</Container>
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
