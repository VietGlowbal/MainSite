import type { Metadata } from 'next';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { SiteNavigation } from '@/components/site-navigation';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  StrategyHub,
} from '@/features/marketing/ui';
import { createClient } from '@/lib/supabase/server';
import { Footer } from '@/shared/ui';

/**
 * /ai-strategy — the Strategy Hub. Reached from the "Strategy Master" nav
 * action (`STRATEGY_ACTION` in `features/marketing/ui/nav-items.tsx`, still
 * pointed at this same route — no navigation change needed for this rebuild).
 *
 * ─── REBUILT FROM THE APPROVED PROTOTYPE (owner, 17/08) ──────────────────────
 *
 * Previously a plain explainer (Stage 3 of the `/how-it-works` walkthrough,
 * via `guideArea('strategy')`). The owner supplied a combined interactive
 * HTML/CSS/JS prototype ("GlowBal Strategy Hub — Combined Demo") and asked
 * for it rebuilt as the real landing page for every application, with its
 * animations and synthesized sound effects intact. `StrategyHub` and its
 * `strategy-hub/*` siblings are that rebuild — see their file comments for
 * what changed versus the prototype (real destinations instead of the
 * prototype's dead "#" links and toast-only demo buttons, `HeroGlobe` reused
 * instead of the prototype's static globe image, no fabricated testimonials).
 *
 * WHAT THIS PAGE IS NOT. It is not the Strategy itself. That is built for one
 * specific course and is entered from an application: "Continue applying" on
 * `/apply` bounces through `/apply/[applicationId]` to
 * `/ai-strategy/[applicationId]/strategy`. This page is the hub that sends a
 * student there; the reports section links to what's real today.
 *
 * PAYWALL — LANDED (owner, 17/08). `/ai-strategy/[applicationId]/layout.tsx`
 * now gates the whole per-application workspace behind GlowBal Plus
 * (`isPlusEntitlementActive`), redirecting to `/plus?application=<id>`. The
 * two user-level reports this page links to directly — Personal Report and,
 * once an application is open, Matching Report — stay free; only the
 * application-specific Strategy/planner sits behind the gate, per the standing
 * "paywall goes on the Strategy, after the application stage" call.
 *
 * ⚠️ STILL PUBLIC. Marketing copy about a feature should not require an
 * account to read — same reasoning as before this rebuild. The session is
 * read here only to decide whether to show the signed-out sign-up close.
 */

export const metadata: Metadata = {
  title: 'GlowBal Strategy Hub',
  description:
    'Build a strategy for wherever you apply. Open an application in My Portal and GlowBal builds the strategy around the exact university and course you picked.',
};

export default async function AiStrategyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isSignedIn = Boolean(user);

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <SiteNavigation tone="light" />

      {/* Every string in this page body is localized explicitly with <T>.
          Keep the legacy DOM translator out: if it snapshots a hydrated
          Vietnamese <T> node as its English source, switching back to EN is
          immediately overwritten with Vietnamese. Header/footer stay outside
          this boundary until their remaining legacy copy is migrated. */}
      <main data-no-auto-translate>
        <StrategyHub isSignedIn={isSignedIn} />
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
