import type { User } from '@supabase/supabase-js';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { SiteNavigation } from '@/components/site-navigation';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
} from '@/features/marketing/ui';
import { Container, Footer } from '@/shared/ui';

/**
 * The header/footer wrapper both reflection steps share.
 *
 * `/ai-strategy/*` is suppressed in nav-reveal, so these pages carry their own
 * chrome — the same arrangement as /apply and /universities. Extracted rather
 * than repeated per step so the two cannot drift, which is the same reason the
 * step config is one file.
 */
export function ReflectionChrome({
  nav,
  stepper,
  containerClassName,
  children,
}: {
  user: User | null;
  /**
   * Full-bleed band between the header and the content — in practice
   * `ApplicationNav`, for the pages scoped to one application.
   *
   * A slot outside `<main>`'s `Container` rather than something callers put in
   * `children`, because the band spans the viewport and carries its own
   * measure. Passed through `children` it would land inside `max-w-4xl` and
   * render as an inset red box. The reflection steps pass nothing and get the
   * layout they had.
   */
  nav?: React.ReactNode | undefined;
  /**
   * The high-level "Application setup" stepper (✓ Profile ● Experiences
   * ○ Personal reflection ○ Review) — a different, coarser thing from the
   * per-page breadcrumb each step renders itself. Sits inside the content
   * measure (unlike `nav`), directly above whatever the page renders.
   */
  stepper?: React.ReactNode | undefined;
  containerClassName?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <SiteNavigation tone="light" />

      {nav}

      <main className="min-h-screen pb-gb-9xl pt-gb-5xl">
        <Container className={containerClassName ?? 'max-w-5xl'}>
          {stepper ? <div className="mb-gb-3xl">{stepper}</div> : null}
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
