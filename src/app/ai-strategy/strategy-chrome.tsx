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
 * The header/footer wrapper every page under /ai-strategy shares.
 *
 * WHY IT IS HERE AND NOT IN src/features/application-strategy/ui. It needs
 * SiteNavigation and the FOOTER_* constants from app-level features, and
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
  containerWidth = 'narrow',
  children,
}: {
  user: User | null;
  containerWidth?: ChromeWidth;
  children: React.ReactNode;
}) {
  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <SiteNavigation tone="light" />

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
