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

export function ApplicationWorkspaceShell({
  children,
  nav,
  banner,
}: {
  children: React.ReactNode;
  nav?: React.ReactNode;
  banner: React.ReactNode;
  userName?: string | null;
  userAvatarUrl?: string | null;
}) {
  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <SiteNavigation tone="light" />

      {/* ApplicationNav is a full-bleed brand band with its own Container. */}
      {nav}

      <main className="min-h-screen pb-gb-9xl pt-gb-4xl">
        <Container className="flex flex-col gap-gb-5xl">
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
