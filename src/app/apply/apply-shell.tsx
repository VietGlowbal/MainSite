import { GlowbalLogo } from '@/components/glowbal-logo';
import { SiteNavigation } from '@/components/site-navigation';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
} from '@/features/marketing/navigation';
import { Container } from '@/shared/ui/container';
import { Footer } from '@/shared/ui/footer';

export function ApplyShell({ children }: {
  children: React.ReactNode;
  userName?: string | null;
  userAvatarUrl?: string | null;
  isLoggedOut?: boolean;
}) {
  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <SiteNavigation tone="light" showSaved />

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
